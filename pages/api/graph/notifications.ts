// File: pages/api/graph/notifications.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const EXPECTED_CLIENT_STATE = 'secretClientValue12345';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Echo back validationToken (GET or POST)
  const vtq = typeof req.query.validationToken === 'string' ? req.query.validationToken : undefined;
  const vtb = req.body?.validationToken;
  const validationToken = vtq || vtb;
  if (validationToken) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(validationToken);
  }

  // 2) Only accept POSTs from Graph
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notifications = Array.isArray(req.body.value) ? req.body.value : [];

    for (const notification of notifications) {
      // 3) Security check
      if (notification.clientState !== EXPECTED_CLIENT_STATE) {
        console.warn('Ignoring invalid clientState:', notification.clientState);
        continue;
      }

      // 4) Handle the new transcript‐ready event
      if (notification.resource === '/communications/onlineMeetings/getAllTranscripts') {
        // resourceData holds the details for this transcript
        const rd = (notification as any).resourceData;
        if (!rd?.contentUrl || !rd?.meetingId) {
          console.warn('Missing resourceData on transcript event', rd);
          continue;
        }

        // Fetch the transcript content directly
        const token = await getAccessToken();
        const tRes = await fetch(rd.contentUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const transcriptText = tRes.ok ? await tRes.text() : '';

        // Upload to Supabase
        await fetch(
          'https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meetingId: rd.meetingId,
              transcript: transcriptText
            })
          }
        );

        continue; // done with this notification
      }

      // 5) Fallback: old callRecords flow
      const parts = (notification.resource as string).split('/');
      const meetingId = parts[parts.length - 1];
      if (!meetingId) {
        console.warn('Could not parse meetingId from resource:', notification.resource);
        continue;
      }

      // 6) Acquire Graph token
      const token = await getAccessToken();

      // 7) Retry fetching callRecord until transcript URL appears
      let transcriptText = '';
      for (let i = 0; i < MAX_RETRIES; i++) {
        const crRes = await fetch(
          `https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!crRes.ok) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        const cr = await crRes.json();
        const records = cr.sessions?.flatMap((s: any) => s.records ?? []) ?? [];
        const rec = records.find((r: any) => r.contentType === 'transcript');
        if (rec?.contentUrl) {
          const tRes = await fetch(rec.contentUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (tRes.ok) transcriptText = await tRes.text();
          break;
        }
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      // 8) Upload to Supabase
      await fetch(
        'https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId, transcript: transcriptText })
        }
      );
    }

    // 9) Acknowledge all notifications
    return res.status(200).json({ status: 'processed' });
  } catch (err: any) {
    console.error('notifications handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

