import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { meeting_id, prompt } = req.body
  if (!meeting_id || !prompt) {
    return res.status(400).json({ success: false, error: 'Missing data' })
  }

  const { data: meeting, error: fetchError } = await supabase
    .from('meetings')
    .select('transcript, summary')
    .eq('id', meeting_id)
    .single()

  if (fetchError || !meeting) {
    return res.status(500).json({ success: false, error: 'Meeting not found' })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an assistant improving a meeting summary.' },
        { role: 'user', content: `Original summary: ${meeting.summary}\nTranscript: ${meeting.transcript}\n\nInstruction: ${prompt}` },
      ],
    })

    const newSummary = completion.choices[0].message.content

    const { error: updateError } = await supabase
      .from('meetings')
      .update({ summary: newSummary })
      .eq('id', meeting_id)

    if (updateError) throw updateError

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, error: 'AI or database error' })
  }
}
