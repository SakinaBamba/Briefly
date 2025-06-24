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

    // Loop through the top 5 call records
    const results = [];

    for (const record of records.slice(0, 5)) {
      const joinWebUrl: string | undefined = record.joinWebUrl;
      if (!joinWebUrl) continue;

      const filterUrl = new URL(`https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings`);
      filterUrl.searchParams.set("$filter", `JoinWebUrl eq '${joinWebUrl}'`);

      const meetingRes = await fetch(filterUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const meetingData = await meetingRes.json();
      const meeting = meetingData.value?.[0];
      if (!meeting) continue;

      const meetingId: string = meeting.id;

      const { data: existing } = await supabase
        .from('meetings')
        .select('id')
        .eq('external_meeting_id', meetingId)
        .maybeSingle();

      if (existing) continue;

      const transcriptsRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings/${meetingId}/transcripts`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const transcriptsData = await transcriptsRes.json();
      const transcript = transcriptsData.value?.[0];
      if (!transcript) continue;

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
          user_id: supabaseUserId
        }
      ]).select();

      if (insertError) {
        console.error('Insert error:', insertError);
        continue;
      }

      const meetingRowId = insertData?.[0]?.id;
      if (meetingRowId) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/processTranscript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meeting_id: meetingRowId, user_id: supabaseUserId })
        });
      }

      results.push({ meetingId, added: true });
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error('pollCallRecords error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err });
  }
}
