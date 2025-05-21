// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

// In-memory — reset on server restart.
// For production, store lastPoll in your database.
let lastPoll = new Date(Date.now() - 60 * 60 * 1000).toISOString()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Acquire app-only token
  const cca = new ConfidentialClientApplication({
    auth: {
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!
    }
  })
  const tokenResp = await cca.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  })
  if (!tokenResp?.accessToken) {
    return res.status(500).json({ error: 'Could not acquire Graph token' })
  }

  const graph = Client.init({
    authProvider: done => done(null, tokenResp.accessToken!)
  })

  // Pull callRecords modified since lastPoll
  const resp = await graph
    .api('/communications/callRecords')
    .version('beta')
    .query({
      '$filter': `lastModifiedDateTime ge ${lastPoll}`,
      '$top': '50'
    })
    .get()

  const records = resp.value || []

  // Forward each new record’s transcript into your summarizer
  for (const rec of records) {
    const id = rec.id
    const transcripts = await graph
      .api(`/communications/callRecords/${id}/transcripts`)
      .version('beta')
      .get()

    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/uploadTranscript`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ meetingId: id, transcript: transcripts })
      }
    )
  }

  // Update lastPoll to now
  lastPoll = new Date().toISOString()
  return res.status(200).json({ polled: records.length })
}
