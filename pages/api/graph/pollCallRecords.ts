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
    const recordsRes = await fetch("https://graph.microsoft.com/v1.0/communications/callRecords", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const recordsData = await recordsRes.json();
    const records = (recordsData.value || []).sort((a, b) =>
      new Date(b.endDateTime).getTime() - new Date(a.endDateTime).getTime()
    );

    if (records.length === 0) {
      return res.status(200).json({ results: ['No call records found'] });
    }

    const record = records[0];
    const joinWebUrl: string | undefined = record.joinWebUrl;

    if (!joinWebUrl) {
      return res.status(200).json({ results: ['No joinWebUrl in latest record'] });
    }

    const filterUrl = new URL(`https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings`);
    filterUrl.searchParams.set("$filter", `JoinWebUrl eq '${joinWebUrl}'`);

    const meetingRes = await fetch(filterUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const meetingData = await meetingRes.json();
    const meeting = meetingData.value?.[0];
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found via JoinWebUrl filter' });
    }

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

    const { data: insertData, error: insertError } = await supabase.from('meetings').insert([
      {
        title: meeting.subject || 'Untitled Meeting',
        transcript: transcriptText,
        external_meeting_id: meetingId,
        start_time: meeting.startDateTime,
        end_time: meeting.endDateTime,
        user_id: supabaseUserId
      }
    ]).select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to insert meeting' });
    }

    const meetingRowId = insertData?.[0]?.id;
    if (meetingRowId) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/processTranscript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingRowId, user_id: supabaseUserId })
      });
    }

    return res.status(200).json({ results: ['Meeting processed and summary triggered.'] });
  } catch (err) {
    console.error('pollCallRecords error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err });
  }
}

