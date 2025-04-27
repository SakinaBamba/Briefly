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

        const meetingRes = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!meetingRes.ok) {
          console.error('Failed to fetch meeting', await meetingRes.text());
          continue;
        }

        const meetingData = await meetingRes.json();

        if (meetingData.endDateTime) {
          await fetch('https://briefly-theta.vercel.app/api/uploadTranscript', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              meetingId,
              transcript: meetingData.transcripts || 'No transcript data available'
            })
          });
        }
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

