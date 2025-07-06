// /pages/api/generate-document.ts
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

  const { opportunity_id, type, meetings, overrides } = req.body

  if (!opportunity_id || !type || !meetings || !Array.isArray(meetings)) {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('summary')
      .in('id', meetings)

    if (error || !data) throw error || new Error('No summaries found.')

    const summaries = data.map(m => m.summary)

    let finalSummary = summaries[0]

    if (summaries.length > 1) {
      const consolidateRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/consolidate-summaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaries, overrides }),
      })

      const consolidateJson = await consolidateRes.json()

      if (!consolidateRes.ok) {
        console.error('Failed to consolidate summaries:', consolidateJson)
        return res.status(500).json({ error: 'Failed to consolidate summaries' })
      }

      finalSummary = consolidateJson.proposedSummary
    }

    const prompt = `
You are an assistant that generates ${type === 'proposal' ? 'business proposals' : 'contracts'} based on meeting summaries.
Write a well-structured ${type} using the following content:

${finalSummary}
`.trim()

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    })

    const content = chatResponse.choices[0]?.message?.content?.trim() || ''

    return res.status(200).json({ content })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to generate document' })
  }
}

