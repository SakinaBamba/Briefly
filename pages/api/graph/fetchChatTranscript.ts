import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@supabase/auth-helpers-nextjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for server-side
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { meetingId, transcriptUrl } = req.body;

    if (!meetingId || !transcriptUrl) {
      return res.status(400).json({ error: 'Missing meetingId or transcriptUrl' });
    }

    // Fetch the transcript file (assumes .vtt or text format)
    const transcriptResponse = await fetch(transcriptUrl, {
      headers: {
        Authorization: `Bearer ${process.env.MS_GRAPH_ACCESS_TOKEN}`
      }
    });

    if (!transcriptResponse.ok) {
      return res.status(500).json({ error: 'Failed to fetch transcript from Microsoft Graph' });
    }

    const transcriptText = await transcriptResponse.text();

    // Store in Supabase (assumes you have a `meetings` table)
    const { error } = await supabase.from('meetings').insert([
      {
        meeting_id: meetingId,
        transcript: transcriptText
      }
    ]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Transcript stored successfully' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

