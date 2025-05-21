// File: pages/api/graph/notifications/index.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  NEXT_PUBLIC_APP_URL,              // e.g. https://briefly-theta.vercel.app
  NEXT_PUBLIC_SUPABASE_URL
} = process.env

const CLIENT_STATE = 'briefly-secret'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Validation handshake: echo back the validationToken in plain text
  if (req.method === 'GET' && typeof req.query.validationToken === 'string') {
    res.setHeader('Content-Type', 'text/plain')
    res.status(200).send(req.query.validationToken)
    return
  }

  // 2) Only accept POST notifications
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end()
  }

  // Parse notifications array
  const notifications = Array.isArray(req.body.value) ? req.body.value : []
  // 3) Validate clientState
  if (!notifications.every(n => n.clientState === CLIENT_STATE)) {
    console.warn('Invalid clientState in notifications')
    return res.status(403).end()
  }

  // 4) Acquire an app-only token via MSAL
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: AZURE_CLIENT_ID!,
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
      clientSecret: AZURE_CLIENT_SECRET!
    }
  })

  const tokenResponse = await cca.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  })
  if (!tokenResponse?.accessToken) {
    console.error('Failed to acquire Graph token', tokenResponse)
    return res.status(500).end()
  }

  // 5) Initialize Graph client
  const graph = Client.init({
    authProvider: done => done(null, tokenResponse.accessToken!)
  })

  // 6) Process each notification
  for (const note of notifications) {
    const recordId = note.resource.split('/').pop()!
    try {
      // Fetch the transcript from Graph (beta endpoint)
      const transcripts = await graph
        .api(`/communications/callRecords/${recordId}/transcripts`)
        .version('beta')
        .get()

      // Forward to your summarization endpoint
      await fetch(
        `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/uploadTranscript`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            meetingId: recordId,
            transcript: transcripts
          })
        }
      )
    } catch (err) {
      console.error(`Error processing callRecord ${recordId}:`, err)
    }
  }

  // 7) Acknowledge receipt
  res.status(202).end()
}
