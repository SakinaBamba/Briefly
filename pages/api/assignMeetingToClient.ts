import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { meetingId, clientId } = req.body

  if (!meetingId || !clientId) {
    return res.status(400).json({ error: 'Missing meetingId or clientId' })
  }

  const { error } = await supabase
    .from('meetings')
    .update({ client_id: clientId })
    .eq('id', meetingId)

  if (error) {
    console.error('Supabase update error:', error)
    return res.status(500).json({ error: 'Failed to assign meeting to client' })
  }

  return res.status(200).json({ success: true })
}
