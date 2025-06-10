// File: /pages/api/processTranscript.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import crypto from 'crypto'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { transcript, user_id } = req.body

    // Sanity check
    if (!transcript || !user_id) {
      return res.status(400).json({ error: 'Missing transcript or user_id' })
    }

    // Call OpenAI to summarize
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes meeting transcripts and extracts proposal items if mentioned.'
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        max_tokens: 1000,
        temperature: 0.5
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const summary = openaiResponse.data.choices[0].message.content

    // Insert into Supabase meetings table
    const { error: dbError } = await supabaseClient.from('meetings').insert([
      {
        external_meeting_id: crypto.randomUUID(),
        user_id,
        transcript,
        summary,
        proposal_items: null // You can enhance this later to extract structured items
      }
    ])

    if (dbError) {
      console.error('Supabase insert error:', dbError)
      return res.status(500).json({ error: 'Failed to insert into Supabase' })
    }

    res.status(200).json({ summary })
  } catch (error) {
    console.error('API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

