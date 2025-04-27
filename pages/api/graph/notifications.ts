// File: /pages/api/graph/notifications.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const EXPECTED_CLIENT_STATE = 'secretClientValue12345';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

        let transcriptUris: string[] = [];
        let attempts = 0;

        while (attempts < MAX_RETRIES && transcriptUris.length === 0) {
          const callRecordRes = await fetch(`https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (!callRecordRes.ok) {
            console.error('Failed to fetch call record', await callRecordRes.text());
            break;
          }

          const callRecordData = await callRecordRes.json();

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
            attempts++;
            if (attempts < MAX_RETRIES) {
              console.log(`Transcript not found. Retrying in ${RETRY_DELAY_MS / 1000} seconds... (Attempt ${attempts})`);
              await delay(RETRY_DELAY_MS);
            }
          }
        }

        if (transcriptUris.length === 0) {
          console.log('No transcripts found after retries for meeting:', meetingId);
          continue;
        }

        const transcriptContent = await fetch(transcriptUris[0], {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        const transcriptText = await transcriptContent.text();

        await fetch('https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript', {
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


