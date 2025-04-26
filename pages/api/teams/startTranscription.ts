// pages/api/teams/startTranscription.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

const msalConfig = {
  auth: {
    clientId: process.env.MS_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}`,
    clientSecret: process.env.MS_CLIENT_SECRET!,
  }
};

const cca = new ConfidentialClientApplication(msalConfig);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Extract SSO token from Teams task/fetch
    const authHeader = req.headers.authorization || '';
    const ssoToken = authHeader.split(' ')[1];
    if (!ssoToken) {
      return res.status(401).json({ error: 'Missing SSO token' });
    }

    // 2. Acquire a Graph token On-Behalf-Of the user
    const oboResponse = await cca.acquireTokenOnBehalfOf({
      oboAssertion: ssoToken,
      scopes: ['https://graph.microsoft.com/.default']
    });
    if (!oboResponse || !oboResponse.accessToken) {
      throw new Error('Failed to acquire Graph access token');
    }

    // 3. Initialize Graph client
    const graphClient = Client.init({
      authProvider: (done) => {
        done(null, oboResponse.accessToken);
      }
    });

    // 4. Kick off transcription
    const { meetingId, callId } = req.body;
    await graphClient
      .api(`/communications/calls/${callId}/startTranscription`)
      .post({
        meetingInfo: {
          organizer: { identity: { user: { id: meetingId } } },
          id: callId
        },
        transcriptionInfo: {
          locale: 'en-US'
        }
      });

    // 5. Respond back to Teams
    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Error starting transcription:', error);
    return res.status(500).json({ error: error.message });
  }
}
