// pages/api/graph/subscribe.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = await getAccessToken();
  const notificationUrl = 'https://briefly-theta.vercel.app/api/graph/notifications';
  const expirationDateTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // <<< CHANGE: subscribe to transcripts instead of callRecords
  const response = await fetch('https://graph.microsoft.com/beta/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      changeType: 'created, updated',
      notificationUrl,
      resource: '/communications/onlineMeetings/getAllTranscripts',
      expirationDateTime,
      clientState: 'secretClientValue12345'
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Graph subscribe error:', data);
    return res.status(response.status).json({ error: 'Graph subscription failed', details: data });
  }

  return res.status(201).json(data);
}

