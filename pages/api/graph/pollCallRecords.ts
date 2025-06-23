// File: pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getGraphAccessToken } from '../../../utils/getGraphToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const graphUserId = process.env.GRAPH_USER_ID;
  const supabaseUserId = process.env.SUPABASE_USER_ID;

  if (!graphUserId || !supabaseUserId) {
    return res.status(500).json({ error: 'GRAPH_USER_ID or SUPABASE_USER_ID not configured' });
  }

  const accessToken = await getGraphAccessToken();
  if (!accessToken) {
    return res.status(500).json({ error: 'Failed to get Graph API token' });
  }

  try {
    const results: any[] = [];
    let hasInsertError = false;

    const recordsRes = await fetch("https://graph.microsoft.com/v1.0/communications/callRecords", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const recordsData = await recordsRes.json();
    const records = (recordsData.value || []).sort((a: any, b: any) =>
      new Date(b.endDateTime).getTime() - new Date(a.endDateTime).getTime()
    );

    console.log("📞 Total call records fetched:", records.length);
    if (records.length === 0) return res.status(200).json({ results: ['No call records found'] });

    const record = records[0]; // Only process most recent
    const joinWebUrl: string | undefined = record.joinWebUrl;
    if (!joinWebUrl) return res.status(200).json({ results: ['No joinWebUrl in latest record'] });

    const meetingRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings/getByJoinWebUrl`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ joinWebUrl }),
      }
    );

    if (!meetingRes.ok) {
      const errText = await meetingRes.text();
      return res.status(500).json({ error: 'Meeting lookup failed', details: errText });
    }

    const meeting = await meetingRes.json();
    const meetingId: string = meeting.id;

    const { data: existing } = await supabase
      .from('meetings')
      .select('id')
      .eq('external_meeting_id', meetingId)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ results: ['Meeting already processed'] });
    }

    const transcriptsRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings/${meetingId}/transcripts`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const transcriptsData = await transcriptsRes.json();
    const transcript = transcriptsData.value?.[0];
    if (!transcript) {
      return res.status(200).json({ results: ['No transcript found for meeting'] });
    }

    const contentRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings/${meetingId}/transcripts/${transcript.id}/content?$format=text/vtt`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const transcriptText = await contentRes.text();
    if (!transcriptText) {
      return res.status(200).json({ results: ['Empty transcript content'] });
    }

    const payload = {
      external_meeting_id: meetingId,
      user_id: supabaseUserId,
      transcript: transcriptText,
      summary: null,
      proposal_items: null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('meetings').insert(payload);
    if (error) {
      console.error("❌ Supabase insert failed:", error);
      return res.status(500).json({ error: 'Failed to insert into Supabase', details: error });
    }

    return res.status(200).json({ results: ['Stored latest transcript to Supabase'] });
  } catch (err: any) {
    console.error("💥 Polling error:", err);
    return res.status(500).json({ error: 'Polling failed', details: err.message });
  }
}


