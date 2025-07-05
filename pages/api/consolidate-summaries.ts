import { NextApiRequest, NextApiResponse } from 'next'
import { OpenAI } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { summaries } = req.body

  if (!Array.isArray(summaries) || summaries.length < 2) {
    return res.status(400).json({ error: 'At least two summaries are required' })
  }

  try {
    const prompt = `You are a proposal assistant. Compare the following meeting summaries. Identify any contradictions (e.g., differences in quantities, vendors, timelines). List each flagged item clearly, then generate a unified version of the summary after resolving contradictions. Respond ONLY in this JSON format:

{
  "flags": [
    { "description": "Meeting 1 said 10 APs, Meeting 2 said 15 APs", "options": ["10", "15"], "key": "AP_COUNT" }
  ],
  "proposedSummary": "Final summary with resolved info."
}

Meeting Summaries:
${summaries.map((s, i) => `Meeting ${i + 1}: ${s}`).join('\n\n')}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that compares meeting summaries and identifies contradictions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const response = completion.choices[0].message.content
    const parsed = JSON.parse(response || '{}')

    res.status(200).json(parsed)
  } catch (err) {
    console.error('Consolidation error:', err)
    res.status(500).json({ error: 'Failed to consolidate summaries' })
  }
}

