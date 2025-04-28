// File: pages/api/graph/notifications.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const EXPECTED_CLIENT_STATE = 'secretClientValue12345';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Validation handshake: Graph does a GET with ?validationToken=...
  if (req.method === 'GET' && typeof req.query.validationToken === 'string') {
    const token = req.query.validationToken as string;
    // Must echo back the token as plain text
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(token);
    return;
  }

  // Only accept POST from here on
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notifications = Array.isArray(req.body.value) ? req.body.value : [];

    for (const notification of notifications) {
      // 2) Verify our clientState
      if (notification.clientState !== EXPECTED_CLIENT_STATE) {
        console.warn('⚠️ Ignoring invalid clientState:', notification.clientState);
        continue;
      }

      // 3) Extract meetingId from resource string
      const resource: string = notification.resource; 
      const meetingId = resource.split('/').pop();
      if (!meetingId) {
        console.warn('⚠️ Could not parse meetingId from resource:', resource);
        continue;
      }

      // 4) Get an app-only Graph token
      const token = await getAccessToken();

      // 5) Fetch callRecord to locate transcript URL
      let transcriptText = '';
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const crRes = await fetch(
          `https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!crRes.ok) {
          console.warn(`Attempt ${attempt}: callRecord fetch failed:`, await crRes.text());
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        const cr = await crRes.json();
        const sessions = cr.sessions ?? [];
        const records = sessions.flatMap((s: any) => s.records ?? []);
        const tr = records.find((r: any) => r.contentType === 'transcript');
        if (tr?.contentUrl) {
          const tRes = await fetch(tr.contentUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (tRes.ok) transcriptText = await tRes.text();
          else console.warn(`Attempt ${attempt}: transcript download failed`);
          break;
        }
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      // 6) Upload into Supabase
      await fetch(
        'https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId, transcript: transcriptText })
        }
      );
    }

    // 7) Tell Graph we processed it
    res.status(200).json({ status: 'processed' });
  } catch (err: any) {
    console.error('🔥 notifications handler error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

