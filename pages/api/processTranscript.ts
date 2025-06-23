import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createSummaryFromTranscript } from '../../../utils/summarize';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { meeting_id } = req.body;

  if (!meeting_id) {
    return res.status(400).json({ error: 'Missing meeting_id' });
  }

  try {
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meeting_id)
      .maybeSingle();

    if (error || !meeting) {
      return res.status(404).json({ error: 'Meeting not found', details: error?.message });
    }

    const { summary, proposal_items } = await createSummaryFromTranscript(meeting.transcript);

    const { error: updateError } = await supabase
      .from('meetings')
      .update({ summary, proposal_items })
      .eq('id', meeting_id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update summary', details: updateError.message });
    }

    return res.status(200).json({ result: 'Summary updated successfully', summary });
  } catch (err: any) {
    return res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}


