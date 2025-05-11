// pages/api/graph/subscribe.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  try {
    // Acquire app-only token
    const cca = new ConfidentialClientApplication(msalConfig);
    const tokenResponse = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    });
    if (!tokenResponse?.accessToken) {
      throw new Error('Failed to acquire Graph token');
    }

    const graph = Client.init({
      authProvider: (done) => done(null, tokenResponse.accessToken)
    });

    // Create or renew subscription
    const result = await graph.api('/subscriptions').post({
      changeType: 'created',
      notificationUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/graph/notifications`,
      resource: '/communications/callRecords',
      expirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      clientState: 'briefly-secret'
    });

    return res.status(200).json({ subscriptionId: result.id, expires: result.expirationDateTime });
  } catch (error: any) {
    console.error('Subscription error:', error);
    return res.status(500).json({ error: error.message });
  }
}
