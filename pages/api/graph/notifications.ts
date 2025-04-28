// File: pages/api/graph/notifications.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const EXPECTED_CLIENT_STATE = 'secretClientValue12345';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Handle subscription validation (GET or POST with validationToken)
  const tokenFromQuery = typeof req.query.validationToken === 'string'
    ? req.query.validationToken
    : undefined;
  const tokenFromBody = req.body?.validationToken;
  const validationToken = tokenFromQuery || tokenFromBody;

  if (validationToken) {
    // Graph expects exactly the raw token, as plain text
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(validationToken);
  }

  // 2) Only real notifications via POST
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

      // 4) Parse the meeting ID
      const parts = (notification.resource as string).split('/');
      const meetingId = parts[parts.length - 1];
      if (!meetingId) continue;

      // 5) Get Graph token
      const token = await getAccessToken();

      // 6) Fetch callRecord & retry looking for transcript URL
      let transcript = '';
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
          if (tRes.ok) transcript = await tRes.text();
          break;
        }
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      // 7) Upload to Supabase
      await fetch(
        'https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId, transcript })
        }
      );
    }

    return res.status(200).json({ status: 'processed' });
  } catch (err: any) {
    console.error('notifications error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

