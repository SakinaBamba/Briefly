import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { meeting_id, user_id } = req.body

    // 1️⃣ Fetch transcript from Supabase
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('transcript')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting?.transcript) {
      return res.status(404).json({ error: 'Transcript not found for this meeting' })
    }

    const transcriptText = meeting.transcript

    // 2️⃣ Call your summarizeMeeting Edge Function
    const summarizeResp = await axios.post(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/summarizeMeeting`,
      {
        payload: { text: transcriptText, user_id }
      },
      {
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
      }
    )

    const { summary, proposal_items } = summarizeResp.data

    // 3️⃣ Update Supabase with summary + proposals
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ summary, proposal_items })
      .eq('id', meeting_id)

    if (updateError) throw updateError

    res.status(200).json({ success: true })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error', details: err?.response?.data || err })
  }
}

