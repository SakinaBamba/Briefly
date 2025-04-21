// pages/api/saveClarification.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { opportunity_id, ai_question, user_response } = req.body
  if (!opportunity_id || !ai_question) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const { error } = await supabase.from('clarifications').insert({
    opportunity_id,
    ai_question,
    user_response: user_response || null
  })

  if (error) {
    return res.status(500).json({ error: 'Failed to save clarification', details: error.message })
  }

  return res.status(200).json({ message: 'Clarification saved successfully' })
}
