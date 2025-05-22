// pages/api/graph/pollCallRecords.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const accessToken = process.env.GRAPH_ACCESS_TOKEN // This must be a fresh token
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (!accessToken) {
    return res.status(500).json({ error: 'Missing GRAPH_ACCESS_TOKEN env var' })
  }

  try {
    // 1. Fetch all online meetings
    const meetingsRes = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const meetingsData = await meetingsRes.json()

    if (!meetingsData.value) {
      return res.status(200).json({ message: 'No meetings found' })
    }

    const endedMeetings = meetingsData.value.filter(
      (meeting: any) => meeting.endDateTime && new Date(meeting.endDateTime) < new Date()
    )

    const results: any[] = []

    for (const meeting of endedMeetings) {
      const meetingId = meeting.id

      // 2. Fetch available transcripts for this meeting
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

      // 3. Get the actual transcript content
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      const contentData = await contentRes.json()
      const transcriptText = contentData?.content || ''

      if (!transcriptText) {
        results.push({ meetingId, status: 'Transcript content missing' })
        continue
      }

      // 4. Trigger summarization
      const summarizeRes = await fetch(`${baseUrl}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          user_id: 'dummy-user-id' // Replace with actual user ID if available
        })
      })

      const summarizeResult = await summarizeRes.json()

      results.push({
        meetingId,
        status: 'Summarized',
        summarizeResult
      })
    }

    return res.status(200).json({ results })
  } catch (error: any) {
    console.error('Polling error:', error)
    return res.status(500).json({ error: 'Failed to poll meetings', details: error.message })
  }
}


