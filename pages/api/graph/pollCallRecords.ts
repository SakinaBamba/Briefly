// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

// Pull in and validate all env-vars up front
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
  console.error('Missing one or more required environment variables:')
  console.error({ AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })
}

// In-memory last-poll time; resets if the serverless function cold-starts
let lastPoll = new Date(Date.now() - 60 * 60 * 1000).toISOString()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow GET
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Acquire app-only token
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

    // Init Graph client
    const graph = Client.init({
      authProvider: done => done(null, tokenResp.accessToken!)
    })

    // Query for new callRecords since lastPoll
    const response = await graph
      .api('/communications/callRecords')
      .version('beta')
      .query({
        '$filter': `lastModifiedDateTime ge ${lastPoll}`,
        '$top': '50'
      })
      .get()

    const records = response.value || []

    // Forward each one to your Summarizer
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
        console.error(`Failed to process record ${rec.id}:`, innerErr)
      }
    }

    // Update lastPoll
    lastPoll = new Date().toISOString()

    // Success
    return res.status(200).json({ polled: records.length })
  } catch (err: any) {
    // Log & return JSON error
    console.error('🔥 pollCallRecords handler error:', err)
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5)  // first few lines
    })
  }
}
