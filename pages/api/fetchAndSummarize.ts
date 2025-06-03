// pages/api/fetchAndSummarize.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// UTIL: parse VTT file to plain text
function parseVTTtoText(vtt: string): string {
  return vtt
    .split('\n')
    .filter(line => line && !line.match(/^[0-9]+$/) && !line.match(/^\d\d:\d\d/))
    .join(' ')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { meeting_id, user_id } = req.body

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('ms_access_token')
    .eq('id', user_id)
    .single()

  if (userError || !user?.ms_access_token) {
    return res.status(400).json({ error: 'Missing MS access token for user' })
  }

  const token = user.ms_access_token

  try {
    // 1️⃣ Get callRecords
    const callRecordsResp = await axios.get(
      `https://graph.microsoft.com/v1.0/communications/callRecords`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const callRecord = callRecordsResp.data.value.find((record: any) =>
      record.joinWebUrl.includes(meeting_id)
    )

    if (!callRecord) {
      return res.status(404).json({ error: 'Meeting not found in callRecords' })
    }

    const joinWebUrl = callRecord.joinWebUrl

    // 2️⃣ Get onlineMeetingId
    const encodedUrl = encodeURIComponent(joinWebUrl)
    const onlineMeetingsResp = await axios.get(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=joinWebUrl eq '${encodedUrl}'`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const onlineMeetingId = onlineMeetingsResp.data.value[0]?.id
    if (!onlineMeetingId) {
      return res.status(404).json({ error: 'No onlineMeetingId found' })
    }

    // 3️⃣ Get transcripts list
    const transcriptsResp = await axios.get(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const transcriptId = transcriptsResp.data.value[0]?.id
    if (!transcriptId) {
      return res.status(404).json({ error: 'No transcript found' })
    }

    // 4️⃣ Fetch transcript content (VTT)
    const contentResp = await axios.get(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const vttText = contentResp.data
    const plainTranscript = parseVTTtoText(vttText)

    // 5️⃣ Call summarizeMeeting edge function
    const summarizeResp = await axios.post(
      `${process.env.SUPABASE_URL}/functions/v1/summarizeMeeting`,
      {
        payload: {
          text: plainTranscript,
          user_id
        }
      },
      {
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
      }
    )

    const { summary, proposal_items } = summarizeResp.data

    // 6️⃣ Insert into Supabase meetings table
    const { error: insertError } = await supabase.from('meetings').update({
      transcript: plainTranscript,
      summary,
      proposal_items
    }).eq('id', meeting_id)

    if (insertError) throw insertError

    res.status(200).json({ success: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error', details: err?.response?.data || err })
  }
}
