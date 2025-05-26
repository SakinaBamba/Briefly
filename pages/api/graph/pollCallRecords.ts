// pages/api/graph/pollCallRecords.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getGraphAccessToken } from '../../../utils/getGraphToken'



const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Must use service role to insert
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const accessToken = await getGraphAccessToken()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (!accessToken) {
    return res.status(500).json({ error: 'Failed to get Graph API token' })
  }

  try {
    // 1. Fetch ended meetings
    const meetingsRes = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
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

      // 2. Skip if already summarized
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

      // 3. Fetch transcript metadata
      const transcriptRes = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}/transcripts`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      const transcriptData = await transcriptRes.json()
      const transcriptItems = transcriptData.value || []

      if (transcriptItems.length === 0) {
        results.push({ meetingId, status: 'No transcript yet' })
        continue
      }

      const transcriptId = transcriptItems[0].id

      // 4. Get transcript content
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
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
          user_id: 'dummy-user-id' // Replace later with dynamic user detection
        })
      })

      const summarizeResult = await summarizeRes.json()

      // 6. Store meeting in Supabase
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

