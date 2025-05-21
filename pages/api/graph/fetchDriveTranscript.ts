// pages/api/graph/fetchChatTranscript.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_SERVICE_URL,
} = process.env;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  const { meetingId } = req.body;
  if (!meetingId) {
    return res.status(400).json({ error: 'Missing meetingId' });
  }

  // 1) Acquire Graph token
  const cca = new ConfidentialClientApplication({
    auth: {
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
      clientId: AZURE_CLIENT_ID!,
      clientSecret: AZURE_CLIENT_SECRET!,
    },
  });
  const tokenResp = await cca.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!tokenResp?.accessToken) {
    return res.status(500).json({ error: 'Could not get token' });
  }
  const graph = Client.init({
    authProvider: done => done(null, tokenResp.accessToken!),
  });

  try {
    // 2) Get callRecord to find joinWebUrl
    const callRec: any = await graph
      .api(`/communications/callRecords/${meetingId}`)
      .version('beta')
      .get();

    const parts = callRec.joinWebUrl.split('/');
    const rawId = parts[parts.length - 1];
    const threadId = decodeURIComponent(rawId);

    // 3) Fetch all chat messages
    const chatResp: any = await graph
      .api(`/chats/${encodeURIComponent(threadId)}/messages`)
      .get();
    const messages = Array.isArray(chatResp.value) ? chatResp.value : [];

    // 4) Extract transcript lines
    const transcript = messages
      .map((m: any) => ({
        timestamp: m.createdDateTime,
        text: m.body.content.replace(/<[^>]+>/g, '').trim(),
      }))
      .filter((l: any) => /\d{2}:\d{2}:\d{2}/.test(l.timestamp)); 

    // 5) Send to your Supabase Edge Function
    const upl = await fetch(`${SUPABASE_SERVICE_URL}/uploadTranscript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ meetingId, transcript }),
    });
    if (!upl.ok) {
      const err = await upl.text();
      throw new Error(`Supabase upload failed: ${err}`);
    }

    return res.status(200).json({
      message: 'Chat transcript fetched & uploaded',
      linesCount: transcript.length,
    });
  } catch (err: any) {
    console.error('fetchChatTranscript error:', err);
    return res.status(500).json({ error: err.message });
  }
}

