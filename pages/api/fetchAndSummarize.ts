import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Small helper to parse VTT format into clean text
function parseVTTtoText(vtt: string): string {
  return vtt
    .split('\n')
    .filter(line => line && !line.match(/^[0-9]+$/) && !line.match(/^\d\d:\d\d/))
    .join(' ')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { meeting_id, user_id } = req.body

    // 1️⃣ Get MS access token from ms_tokens table
    const { data: tokenRow, error: tokenError } = await supabase
      .from('ms_tokens')
      .select('ms_access_token')
      .eq('user_id', user_id)
      .single()

    if (tokenError || !tokenRow?.ms_access_token) {
      return res.status(400).json({ error: 'Missing MS access token for user' })
    }

    const token = tokenRow.ms_access_token

    // 2️⃣ Get external_meeting_id from your meetings table (we use it as joinWebUrl identifier)
    const { data: meetingRow, error: meetingError } = await supabase
      .from('meetings')
      .select('external_meeting_id')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meetingRow?.external_meeting_id) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    const externalMeetingId = meetingRow.external_meeting_id

    // 3️⃣ Call Microsoft Graph to get callRecords
    const callRecordsResp = await axios.get(
      `https://graph.microsoft.com/v1.0/communications/callRecords`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    // 4️⃣ Try to match the correct callRecord by external meeting id
    const callRecord = callRecordsResp.data.value.find((record: any) =>
      record.joinWebUrl.includes(externalMeetingId)
    )

    if (!callRecord) {
      return res.status(404).json({ error: 'No call record found for this meeting' })
    }

    const joinWebUrl = callRecord.joinWebUrl
    const encodedUrl = encodeURIComponent(joinWebUrl)

    // 5️⃣ Use joinWebUrl to get onlineMeetingId
    const onlineMeetingsResp = await axios.get(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=joinWebUrl eq '${encodedUrl}'`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const onlineMeetingId = onlineMeetingsResp.data.value[0]?.id
    if (!onlineMeetingId) {
      return res.status(404).json({ error: 'No onlineMeetingId found' })
    }

    // 6️⃣ Get transcripts for that meeting
    const transcriptsResp = await axios.get(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const transcriptId = transcriptsResp.data.value[0]?.id
    if (!transcriptId) {
      return res.status(404).json({ error: 'No transcript found' })
    }

    // 7️⃣ Fetch transcript content as VTT
    const contentResp = await axios.get(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const vttText = contentResp.data
    const plainTranscript = parseVTTtoText(vttText)

    // 8️⃣ Call your Supabase Edge Function summarizeMeeting
    const summarizeResp = await axios.post(
      `${process.env.SUPABASE_URL}/functions/v1/summarizeMeeting`,
      { payload: { text: plainTranscript, user_id } },
      { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }
    )

    const { summary, proposal_items } = summarizeResp.data

    // 9️⃣ Store transcript + summary + proposals into meetings table
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: plainTranscript,
        summary,
        proposal_items
      })
      .eq('id', meeting_id)

    if (updateError) throw updateError

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error', details: err?.response?.data || err })
  }
}
