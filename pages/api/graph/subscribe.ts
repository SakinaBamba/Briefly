// File: pages/api/graph/notifications.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const EXPECTED_CLIENT_STATE = 'secretClientValue12345';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) ALWAYS handle the Graph validation handshake first (Graph sends POST with ?validationToken=…)
  const validationToken = req.query.validationToken as string | undefined;
  if (validationToken) {
    // Must echo back the token as plain text, no JSON
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(validationToken);
  }

  // 2) Only accept real notifications via POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notifications = Array.isArray(req.body.value) ? req.body.value : [];

    for (const notification of notifications) {
      // 3) Verify clientState for security
      if (notification.clientState !== EXPECTED_CLIENT_STATE) {
        console.warn('⚠️ Ignoring notification with invalid clientState:', notification.clientState);
        continue;
      }

      // 4) Parse meetingId from the resource string "/communications/callRecords/{meetingId}"
      const resource: string = notification.resource;
      const meetingId = resource.split('/').pop();
      if (!meetingId) {
        console.warn('⚠️ Could not parse meetingId from resource:', resource);
        continue;
      }

      // 5) Get an app-only token to call Graph
      const token = await getAccessToken();

      // 6) Fetch the callRecord and retry until we find a transcript URL
      let transcriptText = '';
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const crRes = await fetch(
          `https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!crRes.ok) {
          console.warn(`Attempt ${attempt}: callRecord fetch failed`, await crRes.text());
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        const cr = await crRes.json();
        const records = cr.sessions?.flatMap((s: any) => s.records ?? []) ?? [];
        const transcriptRec = records.find((r: any) => r.contentType === 'transcript');
        if (transcriptRec?.contentUrl) {
          const tRes = await fetch(transcriptRec.contentUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (tRes.ok) {
            transcriptText = await tRes.text();
          } else {
            console.warn(`Attempt ${attempt}: transcript download failed`);
          }
          break;
        }
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      // 7) Upload the transcript to Supabase
      await fetch(
        'https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId, transcript: transcriptText })
        }
      );
    }

    // 8) Acknowledge receipt of notifications
    return res.status(200).json({ status: 'processed' });
  } catch (err: any) {
    console.error('🔥 /api/graph/notifications error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

