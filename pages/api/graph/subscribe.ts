// File: pages/api/graph/subscribe.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Log method and env to help debug
  console.log('🔔 /api/graph/subscribe called with method:', req.method);
  console.log('🔑 ENV:', {
    TENANT: process.env.AZURE_TENANT_ID,
    CLIENT: process.env.AZURE_CLIENT_ID,
    SECRET_PRESENT: !!process.env.AZURE_CLIENT_SECRET,
    NOTIF_URL: process.env.VERCEL_URL
  });

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Acquire an app-only token
    const token = await getAccessToken();
    console.log('🔑 Retrieved access token, length:', token.length);

    // Build the notification URL
    const host = process.env.VERCEL_URL || 'briefly-theta.vercel.app';
    const notificationUrl = `https://${host}/api/graph/notifications`;
    console.log('🔔 Using notificationUrl:', notificationUrl);

    // Set expiration ~48 hours from now
    const expiration = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Create subscription
    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changeType: 'updated',
        notificationUrl,
        resource: '/communications/callRecords',
        expirationDateTime: expiration,
        clientState: 'secretClientValue12345'
      })
    });

    const data = await response.json();
    console.log('🗂 Graph subscription response status:', response.status, data);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Graph subscription failed', details: data });
    }

    // Success!
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('🔥 /api/graph/subscribe error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

