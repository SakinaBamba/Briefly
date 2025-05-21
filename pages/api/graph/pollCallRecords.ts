// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env

// Start one hour ago; serverless cold restarts reset this.
let lastPoll = '2000-01-01T00:00:00Z'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // 1) Acquire app-only token
    const cca = new ConfidentialClientApplication({
      auth: {
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        clientId: AZURE_CLIENT_ID!,
        clientSecret: AZURE_CLIENT_SECRET!
      }
    })
    const token = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    })
    if (!token?.accessToken) {
      throw new Error('Failed to acquire Graph token')
    }

    // 2) Init Graph client
    const graph = Client.init({
      authProvider: done => done(null, token.accessToken!)
    })

    // 3) Fetch the first page of callRecords (no filter)
    const resp = await graph
      .api('/communications/callRecords')
      .version('beta')
      .get()

    const allRecords = Array.isArray(resp.value) ? resp.value : []

    // 4) Client-side filter by lastModifiedDateTime
    const newRecords = allRecords.filter(rec => {
      return new Date(rec.lastModifiedDateTime) >= new Date(lastPoll)
    })

    // 5) Forward each new record’s transcript
    for (const rec of newRecords) {
      try {
        const transcripts = await graph
          .api(`/communications/callRecords/${rec.id}/transcripts`)
          .version('beta')
          .get()

        await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/uploadTranscript`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            meetingId: rec.id,
            transcript: transcripts
          })
        })
      } catch (innerErr) {
        console.error(`Error processing record ${rec.id}:`, innerErr)
      }
    }

    // 6) Advance lastPoll
    lastPoll = new Date().toISOString()

    return res.status(200).json({ polled: newRecords.length })
  } catch (err: any) {
    console.error('🔥 pollCallRecords error:', err)
    return res.status(500).json({ error: err.message })
  }
}

