// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env

// ALWAYS pull everything by seeding far in the past:
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
    const tokenResp = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default']
    })
    if (!tokenResp?.accessToken) {
      throw new Error('Could not get Graph token')
    }

    // 2) Init Graph client
    const graph = Client.init({
      authProvider: done => done(null, tokenResp.accessToken!)
    })

    // 3) List all callRecords (first page)
    const resp: any = await graph
      .api('/communications/callRecords')
      .version('beta')
      .get()

    const records = Array.isArray(resp.value) ? resp.value : []
    let processed = 0

    // 4) For each record, pull sessions→segments and upload
    for (const rec of records) {
      const id = rec.id
      try {
        // fetch sessions
        const sess: any = await graph
          .api(`/communications/callRecords/${id}/sessions`)
          .version('beta')
          .get()
        const sessions = Array.isArray(sess.value) ? sess.value : []

        // fetch all segments
        const segments: any[] = []
        for (const s of sessions) {
          const seg: any = await graph
            .api(`/communications/callRecords/${id}/sessions/${s.id}/segments`)
            .version('beta')
            .get()
          if (Array.isArray(seg.value)) segments.push(...seg.value)
        }

        // upload to Supabase Edge Function
        await fetch(
          `https://<YOUR-PROJECT-REF>.functions.supabase.co/uploadTranscript`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
              meetingId: id,
              transcript: segments
            })
          }
        )

        processed++
      } catch (e) {
        console.error(`Error processing ${id}:`, e)
      }
    }

    // 5) Return how many we sent
    return res.status(200).json({ polled: processed })
  } catch (err: any) {
    console.error('pollCallRecords error:', err)
    return res.status(500).json({ error: err.message })
  }
}

