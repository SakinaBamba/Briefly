// File: pages/api/graph/subscribe.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  NEXT_PUBLIC_APP_URL
} = process.env

const msalConfig = {
  auth: {
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    clientId: AZURE_CLIENT_ID!,
    clientSecret: AZURE_CLIENT_SECRET!
  }
}

// This must match what your notifications handler checks
const CLIENT_STATE = 'briefly-secret'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  try {
    // 1) Acquire an app-only token
    const cca = new ConfidentialClientApplication(msalConfig)
    const tokenResponse = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    })
    if (!tokenResponse?.accessToken) {
      throw new Error('Failed to acquire Graph token')
    }

    // 2) Initialize Graph client
    const graph = Client.init({
      authProvider: (done) => done(null, tokenResponse.accessToken!)
    })

    // 3) Compute an expiration within 72h
    const expires = new Date(Date.now() + 24 * 3600 * 1000)
    const expirationDateTime = expires.toISOString().replace(/\.\d{3}Z$/, 'Z')

    // 4) Create the subscription via the beta endpoint
    const result = await graph
      .api('/beta/subscriptions')
      .post({
        changeType: 'created',
        notificationUrl: `${NEXT_PUBLIC_APP_URL}/api/graph/notifications`,
        resource: '/communications/callRecords',
        expirationDateTime,
        clientState: CLIENT_STATE
      })

    return res.status(200).json({
      subscriptionId: result.id,
      expires: result.expirationDateTime
    })
  } catch (error: any) {
    console.error('Subscription error:', error)
    return res.status(500).json({ error: error.message })
  }
}

