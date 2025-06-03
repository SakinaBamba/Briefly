import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Parse VTT to text
function parseVTTtoText(vtt: string): string {
  return vtt
    .split('\n')
    .filter(line => line && !line.match(/^[0-9]+$/) && !line.match(/^\d\d:\d\d/))
    .join(' ')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { user_id } = req.body

    // Load user's MS Graph token
    const { data: tokenRow, error: tokenError } = await supabase
      .from('ms_tokens')
      .select('ms_access_token')
      .eq('user_id', user_id)
      .single()

    if (tokenError || !tokenRow?.ms_access_token) {
      return res.status(400).json({ error: 'Missing MS access token for user' })
    }

    const token = tokenRow.ms_access_token

    // STEP 1: List recent callRecords
    const callRecordsResp = await axios.get(
      `https://graph.microsoft.com/v1.0/communications/callRecords`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const callRecords = callRecordsResp.data.value

    for (const record of callRecords) {
      const joinWebUrl: string = record.joinWebUrl

      if (!joinWebUrl) continue

      // Extract external meeting ID from joinWebUrl
      const match = joinWebUrl.match(/19%3ameeting_[^%]+/)
      if (!match) continue
      const encodedExternalMeetingId = match[0].replace('%3a', ':')
      const externalMeetingId = encodedExternalMeetingId // should look like: 19:meeting_xxxxx

      // STEP 2: Check if meeting already exists in Supabase
      const { data: existingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('external_meeting_id', externalMeetingId)
        .maybeSingle()

      if (existingMeeting) {
        console.log(`Meeting ${externalMeetingId} already exists.`)
        continue // skip duplicates
      }

      // STEP 3: Get onlineMeetingId from MS Graph
      const encodedJoinWebUrl = encodeURIComponent(joinWebUrl)
      const onlineMeetingsResp = await axios.get(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=joinWebUrl eq '${encodedJoinWebUrl}'`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const onlineMeetingId = onlineMeetingsResp.data.value[0]?.id
      if (!onlineMeetingId) continue

      // STEP 4: Get transcripts
      const transcriptsResp = await axios.get(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const transcriptId = transcriptsResp.data.value[0]?.id
      if (!transcriptId) continue

      // STEP 5: Fetch transcript content (VTT)
      const contentResp = await axios.get(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const vttText = contentResp.data
      const plainTranscript = parseVTTtoText(vttText)

      // STEP 6: Insert into Supabase
      const { error: insertError } = await supabase.from('meetings').insert({
        external_meeting_id: externalMeetingId,
        user_id,
        transcript: plainTranscript,
        summary: null,
        proposal_items: null
      })

      if (insertError) console.error(insertError)
      else console.log(`Inserted meeting ${externalMeetingId}`)
    }

    res.status(200).json({ success: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error', details: err?.response?.data || err })
  }
}
