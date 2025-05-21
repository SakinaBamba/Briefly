// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

// Required env‐vars
const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env

// In‐memory last‐poll (resets on cold start)
let lastPoll = new Date(Date.now() - 60 * 60 * 1000).toISOString()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // 1) Acquire app‐only token
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
      throw new Error('Failed to acquire Graph access token')
    }

    // 2) Init Graph client
    const graph = Client.init({
      authProvider: done => done(null, tokenResp.accessToken!)
    })

    // 3) Fetch callRecords updated since lastPoll
    //    Note: no $top or disallowed options
    const query = `/communications/callRecords?$filter=lastModifiedDateTime ge ${lastPoll}`
    const response = await graph
      .api(query)
      .version('beta')
      .get()

    const records = Array.isArray(response.value) ? response.value : []

    // 4) Process each record
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

    // 5) Advance lastPoll
    lastPoll = new Date().toISOString()

    return res.status(200).json({ polled: records.length })
  } catch (err: any) {
    console.error('🔥 pollCallRecords error:', err)
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5)
    })
  }
}

