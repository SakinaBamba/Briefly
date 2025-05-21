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
  SUPABASE_SERVICE_URL,
  ONE_DRIVE_USER_PRINCIPAL_NAME,
} = process.env;

/** Simple VTT parser: returns [{ start, end, text }] */
function parseVtt(vtt: string) {
  const cues: { start: string; end: string; text: string }[] = [];
  const lines = vtt.split('\n').map(l => l.trim());
  let i = 0;
  while (i < lines.length) {
    // skip numeric cue index
    if (/^\d+$/.test(lines[i])) {
      i++;
      continue;
    }
    const match = lines[i].match(
      /(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/
    );
    if (match) {
      const [, start, end] = match;
      i++;
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
  if (!ONE_DRIVE_USER_PRINCIPAL_NAME) {
    return res.status(500).json({ error: 'ONE_DRIVE_USER_PRINCIPAL_NAME not configured' });
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
      authProvider: done => done(null, tokenResp.accessToken!),
    });

    // 3) Search for the latest .vtt file in the user’s OneDrive
    const upn = encodeURIComponent(ONE_DRIVE_USER_PRINCIPAL_NAME);
    const searchResp: any = await graph
      .api(`/users/${upn}/drive/root/search(q='.vtt')`)
      .get();

    const files = Array.isArray(searchResp.value) ? searchResp.value : [];
    if (files.length === 0) {
      return res.status(404).json({ error: 'No .vtt transcripts found in OneDrive' });
    }

    // pick the newest by lastModifiedDateTime
    files.sort(
      (a: any, b: any) =>
        new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime()
    );
    const newest = files[0];

    // 4) Download its content via the pre-signed downloadUrl
    const downloadRes = await fetch(newest['@microsoft.graph.downloadUrl']);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download VTT: ${downloadRes.status}`);
    }
    const vttText = await downloadRes.text();

    // 5) Parse VTT into segments
    const segments = parseVtt(vttText);

    // 6) Forward to Supabase Edge Function
    const upl = await fetch(`${SUPABASE_SERVICE_URL}/uploadTranscript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ meetingId, transcript: segments }),
    });
    if (!upl.ok) {
      const errText = await upl.text();
      throw new Error(`Supabase upload failed: ${upl.status} ${errText}`);
    }

    return res.status(200).json({
      message: 'Transcript fetched & uploaded',
      segmentsCount: segments.length,
    });
  } catch (err: any) {
    console.error('fetchDriveTranscript error:', err);
    return res.status(500).json({ error: err.message });
  }
}

