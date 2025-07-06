// /pages/api/consolidate-summaries.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { OpenAI } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { summaries, userSelections } = req.body

  if (!Array.isArray(summaries) || summaries.length < 2) {
    return res.status(400).json({ error: 'At least two summaries are required' })
  }

  try {
    // PART 1: Contradiction detection prompt
    const contradictionPrompt = `You are a solution proposal assistant comparing multiple sales meeting summaries.

Your goal is to identify ONLY meaningful contradictions that affect a client's proposal. This includes differences in hardware quantities, vendors, responsibilities, timelines, or site coverage.

DO NOT include minor rewordings, phrasing differences, or small elaborations.

Each contradiction must be clearly and professionally described. Use this strict JSON format:

{
  "flags": [
    {
      "description": "Discrepancy in AP count: Meeting 1 proposes 5 Aruba APs, Meeting 2 proposes 10 Cisco APs.",
      "options": ["5 Aruba APs", "10 Cisco APs"],
      "key": "AP_COUNT"
    }
  ],
  "proposedSummary": "Do not fill this in yet."
}

Meeting Summaries:
${summaries.map((s, i) => `Meeting ${i + 1}: ${s}`).join('\n\n')}`

    const contradictionResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that compares meeting summaries and identifies contradictions for proposals.'
        },
        {
          role: 'user',
          content: contradictionPrompt
        }
      ]
    })

    const contradictionRaw = contradictionResponse.choices[0].message.content
    console.log('[GPT CONTRADICTION RESPONSE]', contradictionRaw)

    let parsed
    try {
      parsed = typeof contradictionRaw === 'string' ? JSON.parse(contradictionRaw) : contradictionRaw
    } catch (jsonErr) {
      console.error('Failed to parse contradiction response as JSON:', jsonErr)
      return res.status(500).json({ error: 'Invalid JSON returned by OpenAI (contradiction step)' })
    }

    // PART 2: If user has confirmed selections, build final summary
    if (userSelections && typeof userSelections === 'object') {
      const resolutionPrompt = `You are a professional proposal writer. Using the following meeting summaries and the user's confirmed resolution choices for contradictions, generate a clean, professional, and unified summary suitable for a client proposal.

Meeting Summaries:
${summaries.map((s, i) => `Meeting ${i + 1}: ${s}`).join('\n\n')}

Confirmed Choices:
${Object.entries(userSelections).map(([key, value]) => `${key}: ${value}`).join('\n')}`

      const summaryResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional proposal assistant.'
          },
          {
            role: 'user',
            content: resolutionPrompt
          }
        ]
      })

      const finalSummary = summaryResponse.choices[0].message.content?.trim()

      return res.status(200).json({ flags: parsed.flags || [], proposedSummary: finalSummary || '' })
    }

    // If no userSelections yet, return the flags only
    return res.status(200).json({ flags: parsed.flags, proposedSummary: '' })
  } catch (err) {
    console.error('Consolidation error:', err)
    res.status(500).json({ error: 'Failed to consolidate summaries' })
  }
}


