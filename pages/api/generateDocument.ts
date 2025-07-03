import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { opportunity_id, type, meetings } = req.body

  if (!opportunity_id || !type || !meetings || !Array.isArray(meetings)) {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('summary')
      .in('id', meetings)

    if (error || !data) throw error || new Error('No summaries found.')

    const joinedSummaries = data.map((m, i) => `Meeting ${i + 1} Summary:\n${m.summary}`).join('\n\n')

    const prompt = `
You are an assistant that generates ${type === 'proposal' ? 'business proposals' : 'contracts'} based on meeting summaries.
Write a well-structured ${type} using the following meeting content:
${joinedSummaries}
`.trim()

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    })

    const content = chatResponse.choices[0]?.message?.content?.trim() || ''
    return res.status(200).json({ content })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to generate document' })
  }
}
