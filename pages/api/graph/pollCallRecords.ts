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

    const queueInsertions: any[] = [];

    for (const record of records.slice(0, 15)) {
      const joinWebUrl = record.joinWebUrl;
      if (!joinWebUrl) continue;

      const filterUrl = new URL(`https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings`);
      filterUrl.searchParams.set("$filter", `JoinWebUrl eq '${joinWebUrl}'`);

      const meetingRes = await fetch(filterUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const meetingData = await meetingRes.json();
      const meeting = meetingData.value?.[0];
      if (!meeting) continue;

      const meetingId = meeting.id;

      const { data: existingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('external_meeting_id', meetingId)
        .maybeSingle();
      if (existingMeeting) continue;

      const { data: alreadyQueued } = await supabase
        .from('meeting_queue')
        .select('id')
        .eq('external_meeting_id', meetingId)
        .maybeSingle();
      if (alreadyQueued) continue;

      queueInsertions.push({
        external_meeting_id: meetingId,
        join_url: joinWebUrl,
        start_time: meeting.startDateTime,
        end_time: meeting.endDateTime
      });

      if (queueInsertions.length >= 5) break;
    }

    if (queueInsertions.length > 0) {
      const { error: insertError } = await supabase.from('meeting_queue').insert(queueInsertions);
      if (insertError) {
        console.error("Error inserting into meeting_queue:", insertError);
        return res.status(500).json({ error: 'Failed to insert into queue', details: insertError });
      }
    }

    return res.status(200).json({ queued: queueInsertions.length });
  } catch (err) {
    console.error('pollCallRecords error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err });
  }
}

