// /pages/api/update-summary.ts
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for write access
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { meetingId, newSummary } = req.body

  if (!meetingId || !newSummary) {
    return res.status(400).json({ error: 'Missing meetingId or newSummary' })
  }

  const { error } = await supabase
    .from('meetings')
    .update({ summary: newSummary })
    .eq('id', meetingId)

  if (error) {
    console.error('Failed to update summary:', error)
    return res.status(500).json({ error: 'Failed to update summary' })
  }

  return res.status(200).json({ success: true, updatedSummary: newSummary })
}
