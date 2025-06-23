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
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!graphUserId || !supabaseUserId || !appBaseUrl) {
    return res.status(500).json({ error: 'Missing GRAPH_USER_ID, SUPABASE_USER_ID, or NEXT_PUBLIC_APP_URL' });
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
    const records = (recordsData.value || [])
      .sort((a, b) => new Date(b.endDateTime).getTime() - new Date(a.endDateTime).getTime())
      .slice(0, 5);

    if (records.length === 0) {
      return res.status(200).json({ results: ['No call records found'] });
    }

    const results: any[] = [];

    for (const record of records) {
      const joinWebUrl = record.joinWebUrl;
      if (!joinWebUrl) {
        results.push('Skipped: No joinWebUrl');
        continue;
      }

      const filterUrl = new URL(`https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings`);
      filterUrl.searchParams.set("$filter", `JoinWebUrl eq '${joinWebUrl}'`);

      const meetingRes = await fetch(filterUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const meetingData = await meetingRes.json();
      const meeting = meetingData.value?.[0];
      if (!meeting) {
        results.push('Skipped: Meeting not found');
        continue;
      }

      const meetingId = meeting.id;

      const { data: existing } = await supabase
        .from('meetings')
        .select('id')
        .eq('external_meeting_id', meetingId)
        .maybeSingle();

      if (existing) {
        results.push(`Skipped: Meeting ${meetingId} already in Supabase`);
        continue;
      }

      const transcriptsRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings/${meetingId}/transcripts`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const transcriptsData = await transcriptsRes.json();
      const transcript = transcriptsData.value?.[0];
      if (!transcript) {
        results.push(`Skipped: No transcript for meeting ${meetingId}`);
        continue;
      }

      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings/${meetingId}/transcripts/${transcript.id}/content?$format=text/vtt`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const transcriptText = await contentRes.text();
      if (!transcriptText) {
        results.push(`Skipped: Empty transcript for ${meetingId}`);
        continue;
      }

      const payload = {
        external_meeting_id: meetingId,
        user_id: supabaseUserId,
        transcript: transcriptText,
        summary: null,
        proposal_items: null,
        created_at: new Date().toISOString(),
      };

      const insertResult = await supabase
        .from('meetings')
        .insert(payload)
        .select(); // ✅ FIX: ensures .data is correctly typed

      if (insertResult.data && insertResult.data.length > 0) {
        const meetingRowId = insertResult.data[0].id;

        await fetch(`${appBaseUrl}/api/processTranscript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meeting_id: meetingRowId }),
        });

        results.push(`✅ Inserted & triggered summary for ${meetingId}`);
      } else {
        results.push(`⚠️ Inserted ${meetingId}, but no row ID returned`);
      }
    }

    return res.status(200).json({ results });
  } catch (err: any) {
    return res.status(500).json({ error: 'Polling failed', details: err.message });
  }
}


