// File: pages/api/graph/subscribe.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import 'isomorphic-fetch'

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  NEXT_PUBLIC_APP_URL  // e.g. https://briefly-theta.vercel.app
} = process.env

const CLIENT_STATE = 'briefly-secret'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  try {
    // 1) Get an app-only token
    const cca = new ConfidentialClientApplication({
      auth: {
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        clientId: AZURE_CLIENT_ID!,
        clientSecret: AZURE_CLIENT_SECRET!
      }
    })
    const tokenResp = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    })
    if (!tokenResp?.accessToken) {
      throw new Error('Failed to acquire Graph token')
    }

    // 2) Compute a UTC expiration ≤72h out
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h for testing
    const expirationDateTime = expires.toISOString().replace(/\.\d{3}Z$/, 'Z')

    // 3) POST directly to the Beta subscriptions endpoint
    const response = await fetch('https://graph.microsoft.com/beta/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResp.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changeType: 'created',  // or "created,updated" if you want updates too
        notificationUrl: `${NEXT_PUBLIC_APP_URL}/api/graph/notifications`,
        resource: '/communications/callRecords',
        expirationDateTime,
        clientState: CLIENT_STATE
      })
    })

    const body = await response.json()
    if (!response.ok) {
      console.error('Subscription creation failed:', body)
      return res.status(response.status).json({ error: body })
    }

    // Success
    return res.status(200).json({
      subscriptionId: body.id,
      expires: body.expirationDateTime
    })

  } catch (err: any) {
    console.error('Subscribe handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
