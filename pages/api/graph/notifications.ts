// File: /pages/api/graph/notifications.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const EXPECTED_CLIENT_STATE = 'secretClientValue12345';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const validationToken = req.query.validationToken as string;
    if (validationToken) {
      res.status(200).send(validationToken);
    } else {
      res.status(400).send('Missing validation token');
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const notifications = req.body.value;

      for (const notification of notifications) {
        if (notification.clientState !== EXPECTED_CLIENT_STATE) {
          console.warn('ClientState mismatch. Skipping notification.');
          continue;
        }

        const resource = notification.resource;
        const meetingId = resource.split('/').pop();

        const accessToken = await getAccessToken();

        // Fetch callRecord after meeting ends
        const callRecordRes = await fetch(`https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!callRecordRes.ok) {
          console.error('Failed to fetch call record', await callRecordRes.text());
          continue;
        }

        const callRecordData = await callRecordRes.json();

        const transcriptUris: string[] = [];

        if (callRecordData.sessions) {
          for (const session of callRecordData.sessions) {
            if (session.records) {
              for (const record of session.records) {
                if (record.recordingType === 'transcript' && record.contentUri) {
                  transcriptUris.push(record.contentUri);
                }
              }
            }
          }
        }

        if (transcriptUris.length === 0) {
          console.log('No transcripts found for meeting:', meetingId);
          continue;
        }

        // Fetch transcript content
        const transcriptContent = await fetch(transcriptUris[0], {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        const transcriptText = await transcriptContent.text();

        // Upload transcript to Briefly
        await fetch('https://briefly-theta.vercel.app/api/uploadTranscript', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            meetingId,
            transcript: transcriptText
          })
        });
      }

      res.status(202).send('Accepted');
    } catch (error) {
      console.error('Notification handling error', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(405).send('Method not allowed');
  }
}
