// File: pages/api/processTranscript.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { meeting_id, user_id } = req.body

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('transcript')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting?.transcript) {
      return res.status(404).json({ error: 'Transcript not found for this meeting' })
    }

    const summarizeResp = await axios.post(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/summarizeMeeting`,
      {
        payload: {
          text: meeting.transcript,
          meeting_id,
          user_id
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    )

    const { summary, proposal_items } = summarizeResp.data

    const { error: updateError } = await supabase
      .from('meetings')
      .update({ summary, proposal_items })
      .eq('id', meeting_id)

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update summary', details: updateError })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error', details: err?.response?.data || err })
  }
}


