import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getGraphAccessToken } from '../../../utils/getGraphToken'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const accessToken = await getGraphAccessToken()
  const userId = process.env.GRAPH_USER_ID

  if (!userId) return res.status(500).json({ error: 'GRAPH_USER_ID not configured' })
  if (!accessToken) return res.status(500).json({ error: 'Failed to get Graph API token' })

  try {
    // 1️⃣ Fetch call records for the tenant/user
    const recordsRes = await fetch('https://graph.microsoft.com/v1.0/communications/callRecords', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const recordsData = await recordsRes.json()
    const records = recordsData.value || []

    const results: any[] = []

    for (const record of records) {
      // Process only ended calls
      if (!record.endDateTime || new Date(record.endDateTime) > new Date()) continue
      const joinWebUrl: string | undefined = record.joinWebUrl
      if (!joinWebUrl) continue

      // 2️⃣ Find the online meeting using the join URL
      const encodedUrl = encodeURIComponent(joinWebUrl)
      const meetingsRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings?$filter=joinWebUrl%20eq%20'${encodedUrl}'`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const meetingsData = await meetingsRes.json()
      const onlineMeeting = meetingsData.value?.[0]
      if (!onlineMeeting) {
        results.push({ recordId: record.id, status: 'Online meeting not found' })
        continue
      }
      const meetingId: string = onlineMeeting.id

      // Check if meeting already stored
      const { data: existing } = await supabase
        .from('meetings')
        .select('id')
        .eq('external_meeting_id', meetingId)
        .maybeSingle()
      if (existing) {
        results.push({ meetingId, status: 'Already processed' })
        continue
      }

      // 3️⃣ Fetch transcript list
      const transcriptsRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingId}/transcripts`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const transcriptsData = await transcriptsRes.json()
      const transcript = transcriptsData.value?.[0]
      if (!transcript) {
        results.push({ meetingId, status: 'No transcript available' })
        continue
      }
      const transcriptId: string = transcript.id

      // 4️⃣ Download transcript content
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const transcriptText = await contentRes.text()
      if (!transcriptText) {
        results.push({ meetingId, status: 'Empty transcript' })
        continue
      }

      // 5️⃣ Store in Supabase
      const { error } = await supabase.from('meetings').insert({
        external_meeting_id: meetingId,
        user_id: userId,
        transcript: transcriptText,
        summary: null,
        proposal_items: null,
        created_at: new Date().toISOString()
      })

      if (error) {
        results.push({ meetingId, status: 'Supabase insert failed', error })
        continue
      }

      results.push({ meetingId, status: 'Stored transcript' })
    }

    return res.status(200).json({ results })
  } catch (err: any) {
    console.error('Polling error:', err)
    return res.status(500).json({ error: 'Polling failed', details: err.message })
  }
}
