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

  const { meetingId, organizerEmail } = req.body;

  if (!meetingId || !organizerEmail) {
    return res.status(400).json({ error: 'Missing meetingId or organizerEmail' });
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
    // 2) Convert the meetingId to a Graph meeting object
    const meeting = await graph
      .api(`/users/${organizerEmail}/onlineMeetings/getByMeetingId`)
      .post({ meetingId });

    const chatId = meeting.chatInfo?.threadId;
    if (!chatId) {
      return res.status(404).json({ error: 'Could not find chat thread for this meeting' });
    }

    // 3) Fetch chat messages from the meeting chat
    const chatResp = await graph
      .api(`/chats/${encodeURIComponent(chatId)}/messages`)
      .get();

    const messages = Array.isArray(chatResp.value) ? chatResp.value : [];

    // 4) Extract and clean messages
    const transcript = messages.map((m: any) => ({
      timestamp: m.createdDateTime,
      text: m.body?.content?.replace(/<[^>]+>/g, '').trim() || '',
    })).filter((l: any) => !!l.text);

    // 5) Upload to Supabase Edge Function
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
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

