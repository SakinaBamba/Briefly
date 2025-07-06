import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { meeting_id, user_prompt } = req.body

  if (!meeting_id || !user_prompt) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Fetch current summary
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('summary')
      .eq('id', meeting_id)
      .single()

    if (error || !meeting) {
      console.error('Failed to fetch summary:', error)
      return res.status(404).json({ error: 'Meeting not found or no summary' })
    }

    const currentSummary = meeting.summary

    // Ask GPT to revise it
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that improves meeting summaries based on user suggestions.'
        },
        {
          role: 'user',
          content: `Here is the current summary:\n\n${currentSummary}\n\nPlease revise it based on this user correction:\n"${user_prompt}".\n\nRespond only with the updated summary.`
        }
      ]
    })

    const updatedSummary = completion.choices[0].message.content?.trim() || ''

    // Update Supabase
    await supabase
      .from('meetings')
      .update({ summary: updatedSummary })
      .eq('id', meeting_id)

    return res.status(200).json({ updatedSummary })
  } catch (err) {
    console.error('Update summary failed:', err)
    return res.status(500).json({ error: 'Something went wrong while updating the summary' })
  }
}

