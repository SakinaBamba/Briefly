// File: pages/api/graph/fetchDriveTranscript.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_SERVICE_URL,             // e.g. https://<project>.functions.supabase.co
} = process.env;

/** Simple VTT parser: returns [{ start, end, text }] */
function parseVtt(vtt: string) {
  const cues: { start: string; end: string; text: string }[] = [];
  const lines = vtt.split('\n').map(l => l.trim());
  let i = 0;
  while (i < lines.length) {
    // skip numeric cue index
    if (/^\d+$/.test(lines[i])) i++;
    // timecode line → "00:00:03.500 --> 00:00:07.000"
    const match = lines[i].match(
      /(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/
    );
    if (match) {
      const [, start, end] = match;
      i++;
      // accumulate text until blank line
      let text = '';
      while (i < lines.length && lines[i] !== '') {
        text += (text ? ' ' : '') + lines[i++];
      }
      cues.push({ start, end, text });
    } else {
      i++;
    }
  }
  return cues;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { meetingId } = req.body;
  if (!meetingId) {
    return res.status(400).json({ error: 'Missing meetingId in body' });
  }

  try {
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
      throw new Error('Failed to acquire Graph token');
    }

    // 2) Init Graph client
    const graph = Client.init({
      authProvider: (done) => done(null, tokenResp.accessToken!),
    });

    // 3) Search for the latest .vtt file in OneDrive root
    const search: any = await graph
      .api('/me/drive/root/search(q=\'.vtt\')')
      .get();

    if (!Array.isArray(search.value) || search.value.length === 0) {
      return res.status(404).json({ error: 'No .vtt transcripts found in OneDrive' });
    }

    // pick the newest by lastModifiedDateTime
    search.value.sort(
      (a: any, b: any) =>
        new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime()
    );
    const newest = search.value[0];

    // 4) Download its content
    const downloadRes = await fetch(newest['@microsoft.graph.downloadUrl']);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download VTT: ${downloadRes.status}`);
    }
    const vttText = await downloadRes.text();

    // 5) Parse VTT into segments
    const segments = parseVtt(vttText);

    // 6) Forward to your Supabase Edge Function (uploadTranscript)
    const uploadRes = await fetch(`${SUPABASE_SERVICE_URL}/uploadTranscript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ meetingId, transcript: segments }),
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Supabase upload failed: ${uploadRes.status} ${errText}`);
    }

    return res.status(200).json({ message: 'Transcript fetched & uploaded', segmentsCount: segments.length });
  } catch (err: any) {
    console.error('fetchDriveTranscript error:', err);
    return res.status(500).json({ error: err.message });
  }
}
