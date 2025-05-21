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

// Seed far in the past for testing
let lastPoll = '2000-01-01T00:00:00Z'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 1) Get app-only token
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

    // 3) List all callRecords
    const resp: any = await graph
      .api('/communications/callRecords')
      .version('beta')
      .get()
    const records = Array.isArray(resp.value) ? resp.value : []
    console.log(`❗️ Raw callRecords count: ${records.length}`)

    // Only test the first record
    const toProcess = records.slice(0, 1)
    let processed = 0

    for (const rec of toProcess) {
      const id = rec.id
      processed++

      // Default to no sessions
      let sessions: any[] = []

      // 4a) Try fetching sessions; if 404, ignore
      try {
        const sessResp: any = await graph
          .api(`/communications/callRecords/${id}/sessions`)
          .version('beta')
          .get()
        sessions = Array.isArray(sessResp.value) ? sessResp.value : []
      } catch (sessErr: any) {
        if (sessErr.statusCode === 404) {
          console.warn(`⚠️ No sessions for record ${id}; proceeding with empty sessions.`)
        } else {
          console.error(`❌ Error fetching sessions for ${id}:`, sessErr)
        }
      }
      console.log(`📝 Record ${id} has ${sessions.length} session(s)`)

      // 4b) Fetch segments for each session (segments=[] if none)
      const segments: any[] = []
      for (const s of sessions) {
        try {
          const segResp: any = await graph
            .api(`/communications/callRecords/${id}/sessions/${s.id}/segments`)
            .version('beta')
            .get()
          if (Array.isArray(segResp.value)) segments.push(...segResp.value)
        } catch (segErr) {
          console.error(`❌ Error fetching segments for session ${s.id}:`, segErr)
        }
      }
      console.log(`  → Total segments for ${id}: ${segments.length}`)

      // 4c) Always upload (even if segments is empty)
      try {
        const uploadRes = await fetch(
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
        if (!uploadRes.ok) {
          const text = await uploadRes.text()
          throw new Error(`Upload failed ${uploadRes.status}: ${text}`)
        }
        console.log(`  ✅ Uploaded record ${id}`)
      } catch (uplErr) {
        console.error(`❌ Error uploading record ${id}:`, uplErr)
      }
    }

    // 5) Return diagnostics
    return res.status(200).json({
      rawCount: records.length,
      processed
    })
  } catch (err: any) {
    console.error('🔥 pollCallRecords error:', err)
    return res.status(500).json({ error: err.message })
  }
}


