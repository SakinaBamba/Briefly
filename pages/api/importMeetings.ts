import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { user_id } = req.body

    // 1️⃣ Load user's MS token from Supabase
    const { data: tokenRow, error: tokenError } = await supabase
      .from('ms_tokens')
      .select('ms_access_token')
      .eq('user_id', user_id)
      .single()

    if (tokenError || !tokenRow?.ms_access_token) {
      return res.status(400).json({ error: 'Missing MS access token for user' })
    }

    const token = tokenRow.ms_access_token

    // 2️⃣ Call callRecords directly
    const callRecordsResp = await axios.get(
      `https://graph.microsoft.com/v1.0/communications/callRecords`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const callRecords = callRecordsResp.data.value

    for (const record of callRecords) {
      const callRecordId = record.id
      const externalMeetingId = record.joinWebUrl // we can still save the join URL for reference

      // 3️⃣ Check if meeting exists in Supabase already
      const { data: existingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('external_meeting_id', externalMeetingId)
        .maybeSingle()

      if (existingMeeting) {
        console.log(`Meeting ${externalMeetingId} already exists.`)
        continue
      }

      // 4️⃣ Now query sessions inside this call record
      const sessionsResp = await axios.get(
        `https://graph.microsoft.com/v1.0/communications/callRecords/${callRecordId}/sessions`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const sessions = sessionsResp.data.value

      let fullTranscript = ''

      for (const session of sessions) {
        if (!session.transcription || !session.transcription.transcript) continue

        fullTranscript += session.transcription.transcript + ' '
      }

      if (!fullTranscript) {
        console.log(`No transcript found for ${externalMeetingId}`)
        continue
      }

      // 5️⃣ Insert into Supabase
      const { error: insertError } = await supabase.from('meetings').insert({
        external_meeting_id: externalMeetingId,
        user_id,
        transcript: fullTranscript,
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
