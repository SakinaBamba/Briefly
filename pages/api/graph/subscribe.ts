// File: /pages/api/graph/subscribe.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth'; // Assume you have a helper to get app-only token

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = await getAccessToken();

    const subscription = {
      changeType: 'updated',
      notificationUrl: 'https://yourdomain.com/api/graph/notifications',
      resource: '/me/onlineMeetings',
      expirationDateTime: new Date(Date.now() + 3600 * 1000 * 23).toISOString(),
      clientState: 'secretClientValue12345'
    };

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Subscription failed', data);
      return res.status(500).json({ error: 'Failed to create subscription' });
    }

    res.status(200).json({ message: 'Subscription created', subscription: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
