// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET
} = process.env

// In-memory lastPoll; cold starts reset this.
// For production, persist in your DB instead.
let lastPoll = new Date(Date.now() - 60 * 60 * 1000).toISOString()

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

    // 3) Fetch callRecords since lastPoll
    const resp: any = await graph
      .api('/communications/callRecords')
      .version('beta')
      .get()

    const records = Array.isArray(resp.value) ? resp.value : []

    let processedCount = 0

    // 4) Process each new record
    for (const rec of records) {
      const recordTime = new Date(rec.lastModifiedDateTime)
      if (recordTime < new Date(lastPoll)) {
        continue
      }

      const id = rec.id

      try {
        // 4a) Fetch sessions under this callRecord
        const sessResp: any = await graph
          .api(`/communications/callRecords/${id}/sessions`)
          .version('beta')
          .get()
        const sessions = Array.isArray(sessResp.value) ? sessResp.value : []

        // 4b) For each session, fetch its segments
        const allSegments: any[] = []
        for (const sess of sessions) {
          const segResp: any = await graph
            .api(`/communications/callRecords/${id}/sessions/${sess.id}/segments`)
            .version('beta')
            .get()
          if (Array.isArray(segResp.value)) {
            allSegments.push(...segResp.value)
          }
        }

        // 4c) Forward segments to your upload function
        await fetch(
          `https://briefly-theta.vercel.app/api/uploadTranscript`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meetingId: id,
              transcript: allSegments
            })
          }
        )

        processedCount++
      } catch (innerErr) {
        console.error(`Error processing record ${rec.id}:`, innerErr)
      }
    }

    // 5) Update lastPoll
    lastPoll = new Date().toISOString()

    // 6) Return how many were processed
    return res.status(200).json({ polled: processedCount })
  } catch (err: any) {
    console.error('🔥 pollCallRecords handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}

