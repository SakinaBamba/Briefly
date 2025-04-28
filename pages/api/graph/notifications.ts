// File: pages/api/graph/notifications.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const EXPECTED_CLIENT_STATE = 'secretClientValue12345';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Handle subscription validation handshake
  if (req.method === 'GET' && typeof req.query.validationToken === 'string') {
    // Echo back the validationToken in plain text
    res.status(200).send(req.query.validationToken);
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notifications = Array.isArray(req.body.value) ? req.body.value : [];

    for (const notification of notifications) {
      // 2) Verify clientState
      if (notification.clientState !== EXPECTED_CLIENT_STATE) {
        console.warn('⚠️ Ignoring notification with invalid clientState:', notification.clientState);
        continue;
      }

      // 3) Extract meetingId from resource
      //    resource comes as "/communications/callRecords/{meetingId}"
      const resource: string = notification.resource;
      const meetingId = resource.split('/').pop();
      if (!meetingId) {
        console.warn('⚠️ Could not parse meetingId from resource:', resource);
        continue;
      }

      // 4) Get an app-only token
      const token = await getAccessToken();

      // 5) Fetch the callRecord to find the transcript URL
      let transcriptText = '';
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const callRecRes = await fetch(
          `https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (!callRecRes.ok) {
          console.warn(`Attempt ${attempt}: Failed to fetch callRecord`, await callRecRes.text());
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }

        const callRecJson = await callRecRes.json();
        const sessions = callRecJson.sessions ?? [];
        const records = sessions.flatMap((s: any) => s.records ?? []);
        const transcriptRecord = records.find((r: any) => r.contentType === 'transcript');

        if (transcriptRecord?.contentUrl) {
          const transcriptRes = await fetch(transcriptRecord.contentUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (transcriptRes.ok) {
            transcriptText = await transcriptRes.text();
          } else {
            console.warn(`Attempt ${attempt}: Failed to download transcript`, await transcriptRes.text());
          }
          break;
        }

        // wait before retrying
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      // 6) Upload the transcript to Supabase
      await fetch(
        'https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingId,
            transcript: transcriptText
          })
        }
      );
    }

    // 7) Acknowledge receipt
    return res.status(200).json({ status: 'processed' });
  } catch (err: any) {
    console.error('🔥 /api/graph/notifications error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}


