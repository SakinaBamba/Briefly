// pages/api/graph/notifications.ts

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

const CLIENT_STATE = 'briefly-secret';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Validation handshake
  if (req.method === 'GET' && req.query.validationToken) {
    return res.status(200).send(req.query.validationToken as string);
  }

  // 2) Only POST notifications
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  const notifications = Array.isArray(req.body.value) ? req.body.value : [];
  // 3) Validate clientState
  if (!notifications.every(n => n.clientState === CLIENT_STATE)) {
    console.warn('Invalid clientState in notifications');
    return res.status(403).end();
  }

  // 4) Acquire app-only token
  const cca = new ConfidentialClientApplication(msalConfig);
  const tokenResp = await cca.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });
  if (!tokenResp?.accessToken) {
    console.error('Failed to acquire Graph token');
    return res.status(500).end();
  }

  const graph = Client.init({
    authProvider: done => done(null, tokenResp.accessToken!)
  });

  // 5) Process each notification
  for (const note of notifications) {
    const recordId = note.resource.split('/').pop()!;
    try {
      // Fetch the transcript
      const transcripts = await graph
        .api(`/communications/callRecords/${recordId}/transcripts`)
        .version('beta')
        .get();

      // Forward to your summarization endpoint
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/summarizeMeeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callRecordId: recordId, transcripts })
      });
    } catch (e) {
      console.error(`Error fetching transcripts for ${recordId}`, e);
    }
  }

  return res.status(202).end();
}

