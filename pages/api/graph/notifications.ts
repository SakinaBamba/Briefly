// File: pages/api/graph/notifications.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const EXPECTED_CLIENT_STATE = 'secretClientValue12345';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Handle the Graph validation handshake
  const vtq = typeof req.query.validationToken === 'string'
    ? req.query.validationToken
    : undefined;
  const vtb = req.body?.validationToken;
  const validationToken = vtq || vtb;
  if (validationToken) {
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
      // 3) Security: verify clientState
      if (notification.clientState !== EXPECTED_CLIENT_STATE) {
        console.warn('Ignoring invalid clientState:', notification.clientState);
        continue;
      }

      // 4) Dummy-test guard: skip heavy work for your FAKE payload
      if (notification.subscriptionId === 'DUMMY' || notification.resource?.endsWith('FAKE_MEETING_ID')) {
        console.log('🏷️  Dummy notification received – skipping processing');
        continue;
      }

      // 5) Parse the real meetingId
      const parts = (notification.resource as string).split('/');
      const meetingId = parts[parts.length - 1];
      if (!meetingId) {
        console.warn('Could not parse meetingId from resource:', notification.resource);
        continue;
      }

      // 6) Acquire Graph token
      const token = await getAccessToken();

      // 7) Fetch callRecord & look for transcript URL
      let transcriptText = '';
      for (let i = 0; i < MAX_RETRIES; i++) {
        const crRes = await fetch(
          `https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!crRes.ok) {
          console.warn(`Attempt ${i+1}: callRecord fetch failed (status ${crRes.status})`);
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
          else console.warn(`Transcript download failed (status ${tRes.status})`);
          break;
        }
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      // 8) Upload the real transcript to Supabase
      await fetch(
        'https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId, transcript: transcriptText })
        }
      );
    }

    // 9) Acknowledge receipt
    return res.status(200).json({ status: 'processed' });
  } catch (err: any) {
    console.error('notifications handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

