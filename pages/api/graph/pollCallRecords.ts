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

const BATCH_SIZE = 5  // adjust up/down to fit within Vercel's 10s timeout

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 1) Acquire Graph app-only token
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

    // 2) Initialize Graph client
    const graph = Client.init({
      authProvider: done => done(null, tokenResp.accessToken!)
    })

    // 3) Fetch all callRecords
    const listResp: any = await graph
      .api('/communications/callRecords')
      .version('beta')
      .get()
    const records = Array.isArray(listResp.value) ? listResp.value : []
    console.log(`🔍 Total callRecords available: ${records.length}`)

    // 4) Only process the first BATCH_SIZE
    const toProcess = records.slice(0, BATCH_SIZE)
    let processed = 0

    for (const rec of toProcess) {
      const id = rec.id

      // 4a) Fetch sessions (ignore 404)
      let sessions: any[] = []
      try {
        const sResp: any = await graph
          .api(`/communications/callRecords/${id}/sessions`)
          .version('beta')
          .get()
        sessions = Array.isArray(sResp.value) ? sResp.value : []
      } catch (e: any) {
        if (e.statusCode !== 404) console.error(`Error fetching sessions for ${id}:`, e)
      }

      // 4b) Fetch segments from each session
      const segments: any[] = []
      for (const sess of sessions) {
        try {
          const segResp: any = await graph
            .api(`/communications/callRecords/${id}/sessions/${sess.id}/segments`)
            .version('beta')
            .get()
          if (Array.isArray(segResp.value)) segments.push(...segResp.value)
        } catch {
          // ignore missing segments
        }
      }

      // 4c) Upload to Supabase Edge Function
      try {
        const upl = await fetch(
          `https://rpcypbgyhlidifpqckgl.functions.supabase.co/uploadTranscript`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ meetingId: id, transcript: segments })
          }
        )
        if (!upl.ok) {
          const text = await upl.text()
          console.error(`Upload failed for ${id}:`, upl.status, text)
        } else {
          console.log(`✅ Uploaded record ${id} (${segments.length} segments)`)
        }
      } catch (err) {
        console.error(`Error uploading record ${id}:`, err)
      }

      processed++
    }

    // 5) Return summary
    return res.status(200).json({
      totalAvailable: records.length,
      batchSize: BATCH_SIZE,
      processed
    })
  } catch (err: any) {
    console.error('🔥 pollCallRecords error:', err)
    return res.status(500).json({ error: err.message })
  }
}

