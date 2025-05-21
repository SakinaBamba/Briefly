// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

// Validate required environment variables
const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env

if (
  !AZURE_TENANT_ID ||
  !AZURE_CLIENT_ID ||
  !AZURE_CLIENT_SECRET ||
  !NEXT_PUBLIC_SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  console.error('Missing one or more required environment variables:', {
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  })
}

// In‐memory last‐poll timestamp; resets on cold start
let lastPoll = new Date(Date.now() - 60 * 60 * 1000).toISOString()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only accept GET requests
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // 1) Acquire an app‐only token
    const cca = new ConfidentialClientApplication({
      auth: {
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        clientId: AZURE_CLIENT_ID,
        clientSecret: AZURE_CLIENT_SECRET
      }
    })
    const tokenResp = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    })
    if (!tokenResp?.accessToken) {
      throw new Error('Failed to acquire Graph access token')
    }

    // 2) Initialize Graph client
    const graph = Client.init({
      authProvider: done => done(null, tokenResp.accessToken!)
    })

    // 3) Query for new callRecords since lastPoll, up to 50
    const response = await graph
      .api('/communications/callRecords')
      .version('beta')
      .filter(`lastModifiedDateTime ge ${lastPoll}`)
      .top(50)
      .get()

    const records = Array.isArray(response.value) ? response.value : []

    // 4) Forward each record’s transcript to your Supabase function
    for (const rec of records) {
      const id = rec.id
      try {
        const transcripts = await graph
          .api(`/communications/callRecords/${id}/transcripts`)
          .version('beta')
          .get()

        await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/uploadTranscript`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ meetingId: id, transcript: transcripts })
        })
      } catch (innerErr) {
        console.error(`Failed to process callRecord ${id}:`, innerErr)
      }
    }

    // 5) Update lastPoll timestamp
    lastPoll = new Date().toISOString()

    // 6) Return success JSON
    return res.status(200).json({ polled: records.length })
  } catch (err: any) {
    console.error('🔥 pollCallRecords handler error:', err)
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5)
    })
  }
}
