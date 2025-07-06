// /pages/api/consolidate-summaries.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { OpenAI } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { summaries, overrides } = req.body

  if (!Array.isArray(summaries) || summaries.length < 2) {
    return res.status(400).json({ error: 'At least two summaries are required' })
  }

  try {
    const prompt = `You are a professional proposal assistant generating summaries for client-facing proposal documents. Compare the following meeting summaries. Identify contradictions (e.g., differences in quantities, vendors, timelines) that matter for business proposals. Be detailed but professional. List each flagged item clearly, then generate a unified version of the summary that resolves contradictions, using user selections if provided. Respond ONLY in this JSON format:

{
  "flags": [
    { "description": "Meeting 1 said 10 APs, Meeting 2 said 15 APs", "options": ["10", "15"], "key": "AP_COUNT" }
  ],
  "proposedSummary": "Final summary with resolved info."
}

If overrides are provided, incorporate them and skip contradiction listing. Keep proposedSummary clear, concise, and client-ready.

Meeting Summaries:
${summaries.map((s, i) => `Meeting ${i + 1}: ${s}`).join('\n\n')}

Overrides:
${overrides ? JSON.stringify(overrides) : 'None'}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-0613',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that compares meeting summaries for client proposals, flags contradictions, and generates final summaries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const raw = completion.choices[0].message.content
    console.log('[GPT RESPONSE]', raw)

    let parsed
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (jsonErr) {
      console.error('Failed to parse GPT response as JSON:', jsonErr)
      return res.status(500).json({ error: 'Invalid JSON returned by OpenAI' })
    }

    res.status(200).json(parsed)
  } catch (err) {
    console.error('Consolidation error:', err)
    res.status(500).json({ error: 'Failed to consolidate summaries' })
  }
}


