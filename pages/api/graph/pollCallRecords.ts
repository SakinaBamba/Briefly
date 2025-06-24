// File: pages/api/graph/pollCallRecords.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { access_token, user_id } = req.body

  if (!access_token || !user_id) {
    return res.status(400).json({ error: 'Missing access_token or user_id' })
  }

  try {
    const headers = {
      Authorization: `Bearer ${access_token}`
    }

    const meetingsUrl = `https://graph.microsoft.com/v1.0/users/${user_id}/onlineMeetings?$orderby=startDateTime desc&$top=5`

    const msResp = await fetch(meetingsUrl, { headers })
    const msData = await msResp.json()

    if (!msData.value || !Array.isArray(msData.value)) {
      return res.status(500).json({ error: 'Microsoft Graph response invalid', details: msData })
    }

    const results = []

    for (const meeting of msData.value) {
      const joinUrl = meeting.joinWebUrl
      const meetingId = meeting.id
      const startTime = meeting.startDateTime
      const endTime = meeting.endDateTime
      const title = meeting.subject || 'Untitled Meeting'

      const transcriptResp = await fetch(`https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}/sessions`, { headers })
      const transcriptData = await transcriptResp.json()

      const transcript = transcriptData.value?.[0]?.transcript?.content || ''

      const { data: existing, error: existError } = await supabase
        .from('meetings')
        .select('id')
        .eq('ms_meeting_id', meetingId)
        .maybeSingle()

      if (existError) throw existError
      if (existing) continue

      const { data: insertData, error: insertError } = await supabase.from('meetings').insert([
        {
          title,
          transcript,
          ms_meeting_id: meetingId,
          start_time: startTime,
          end_time: endTime,
          user_id
        }
      ]).select()

      if (insertError) throw insertError

      const meetingRowId = insertData?.[0]?.id
      if (meetingRowId) {
        await fetch(`${appBaseUrl}/api/processTranscript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meeting_id: meetingRowId, user_id })
        })
      }

      results.push({ meetingId, added: true })
    }

    return res.status(200).json({ results })
  } catch (err) {
    console.error('pollCallRecords error:', err)
    return res.status(500).json({ error: 'Internal server error', details: err })
  }
}

