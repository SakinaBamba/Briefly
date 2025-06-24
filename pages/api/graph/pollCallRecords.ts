// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const callRecordsResp = await axios.get(`${GRAPH_API_BASE}/communications/callRecords`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const callRecords = callRecordsResp.data.value || [];
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

    let inserted = 0;

    for (const record of callRecords.slice(0, 5)) {
      const msMeetingId = record?.joinWebUrl || record?.id;
      if (!msMeetingId) continue;

      // Check if meeting already exists
      const { data: existing, error: existingErr } = await supabase
        .from('meetings')
        .select('id')
        .eq('ms_teams_meeting_id', msMeetingId)
        .maybeSingle();

      if (existing || existingErr) continue;

      const { data: insertData, error: insertErr } = await supabase.from('meetings').insert([
        {
          ms_teams_meeting_id: msMeetingId,
          transcript: record.transcription ? record.transcription.text : null,
          title: record.subject || 'Untitled Meeting'
        }
      ]).select();

      if (insertErr || !insertData || !insertData.length) continue;

      const meetingRowId = insertData[0].id;
      inserted++;

      await fetch(`${appBaseUrl}/api/processTranscript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: meetingRowId,
          user_id: record?.organizer?.identity?.user?.id ?? null
        })
      });
    }

    return res.status(200).json({ inserted });
  } catch (err: any) {
    console.error('pollCallRecords error:', err?.response?.data || err);
    return res.status(500).json({ error: 'Internal Server Error', details: err?.response?.data || err.message });
  }
}

