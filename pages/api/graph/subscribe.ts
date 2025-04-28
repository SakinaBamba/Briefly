// File: pages/api/graph/subscribe.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1) Get an app-only token
    const token = await getAccessToken();

    // 2) Build your notification URL
    const notificationUrl = 'https://briefly-theta.vercel.app/api/graph/notifications';

    // 3) Set expiration to 1 hour from now (max without lifecycleNotificationUrl)
    const expirationDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // 4) Create the subscription (using beta or v1 endpoint as appropriate)
    const graphRes = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changeType: 'created,updated',
        notificationUrl,
        resource: '/communications/onlineMeetings/getAllTranscripts',
        expirationDateTime,
        clientState: 'secretClientValue12345'
      })
    });

    const data = await graphRes.json();
    if (!graphRes.ok) {
      console.error('Graph subscribe error:', data);
      return res.status(graphRes.status).json({ error: 'Graph subscription failed', details: data });
    }

    // 5) Return the subscription object
    return res.status(201).json(data);
  } catch (err: any) {
    console.error('Subscribe handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

