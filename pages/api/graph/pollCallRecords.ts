// pages/api/graph/pollCallRecords.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // needs service role to read all user rows
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const accessToken = process.env.GRAPH_ACCESS_TOKEN // Must be fresh
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const userId = '8162fe61-751c-4543-8f5e-a4e1eb2ca1bc' // Replace with your real user GUID

  if (!accessToken) {
    return res.status(500).json({ error: 'Missing GRAPH_ACCESS_TOKEN env var' })
  }

  try {
    // 1. Fetch ended meetings from Graph
    const meetingsRes = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const meetingsData = await meetingsRes.json()

    if (!meetingsData.value) {
      return res.status(200).json({ message: 'No meetings found' })
    }

    const endedMeetings = meetingsData.value.filter(
      (m: any) => m.endDateTime && new Date(m.endDateTime) < new Date()
    )

    const results: any[] = []

    for (const meeting of endedMeetings) {
      const meetingId = meeting.id

      // 2. Check if we've already summarized this meeting
      const { data: existing, error: checkError } = await supabase
        .from('meetings')
        .select('id')
        .eq('external_meeting_id', meetingId)
        .maybeSingle()

      if (checkError) {
        console.error('Supabase check error:', checkError)
        results.push({ meetingId, status: 'Check failed', error: checkError.message })
        continue
      }

      if (existing) {
        results.push({ meetingId, status: 'Already summarized' })
        continue
      }

      // 3. Get transcript ID
      const transcriptRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingId}/transcripts`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )

      const transcriptData = await transcriptRes.json()
      const transcriptItems = transcriptData.value || []

      if (transcriptItems.length === 0) {
        results.push({ meetingId, status: 'No transcript yet' })
        continue
      }

      const transcriptId = transcriptItems[0].id

      // 4. Get transcript content
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      const contentData = await contentRes.json()
      const transcriptText = contentData?.content || ''

      if (!transcriptText) {
        results.push({ meetingId, status: 'Transcript content missing' })
        continue
      }

      // 5. Trigger summarization
      const summarizeRes = await fetch(`${baseUrl}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          user_id: 'dummy-user-id' // Replace with actual user ID if available
        })
      })

      const summarizeResult = await summarizeRes.json()

      // 6. Store meeting as processed
      await supabase.from('meetings').insert({
        external_meeting_id: meetingId,
        transcript: transcriptText,
        summary: summarizeResult.summary || '',
        proposal_items: summarizeResult.proposal_items || [],
        created_at: new Date().toISOString()
      })

      results.push({
        meetingId,
        status: 'Summarized',
        summarizeResult
      })
    }

    return res.status(200).json({ results })
  } catch (error: any) {
    console.error('Polling error:', error)
    return res.status(500).json({ error: 'Polling failed', details: error.message })
  }
}
