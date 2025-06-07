import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get MS token for user from ms_tokens table
async function getMicrosoftTokenForUser(userId: string) {
  const { data, error } = await supabase
    .from('ms_tokens')
    .select('ms_access_token')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error(`No Microsoft token found for user: ${userId}`);
  }

  return data.ms_access_token;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id in request body' });
    }

    const msAccessToken = await getMicrosoftTokenForUser(user_id);

    // Step 1️⃣ — Get call records
    const callRecordsResp = await axios.get(
      'https://graph.microsoft.com/v1.0/communications/callRecords',
      { headers: { Authorization: `Bearer ${msAccessToken}` } }
    );

    const callRecords = callRecordsResp.data.value;

    // Process all call records
    for (const call of callRecords) {
      try {
        const joinWebUrl = call.joinWebUrl;

        // Step 2️⃣ — Get OnlineMeetingId from joinWebUrl
        const encodedUrl = encodeURIComponent(joinWebUrl);

        const meetingResp = await axios.get(
          `https://graph.microsoft.com/v1.0/users/${user_id}/onlineMeetings?$filter=joinWebUrl eq '${encodedUrl}'`,
          { headers: { Authorization: `Bearer ${msAccessToken}` } }
        );

        if (!meetingResp.data.value || meetingResp.data.value.length === 0) {
          console.log('No onlineMeeting found for callRecord ID', call.id);
          continue;
        }

        const onlineMeetingId = meetingResp.data.value[0].id;

        // Step 3️⃣ — Get transcript ID
        const transcriptResp = await axios.get(
          `https://graph.microsoft.com/v1.0/users/${user_id}/onlineMeetings/${onlineMeetingId}/transcripts`,
          { headers: { Authorization: `Bearer ${msAccessToken}` } }
        );

        if (!transcriptResp.data.value || transcriptResp.data.value.length === 0) {
          console.log('No transcripts found for meeting', onlineMeetingId);
          continue;
        }

        const transcriptId = transcriptResp.data.value[0].id;

        // Step 4️⃣ — Get transcript text content
        const transcriptContentResp = await axios.get(
          `https://graph.microsoft.com/v1.0/users/${user_id}/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
          { headers: { Authorization: `Bearer ${msAccessToken}` } }
        );

        const transcriptText = transcriptContentResp.data;

        // Step 5️⃣ — Insert into Supabase
        const { error: insertError } = await supabase.from("meetings").insert({
          external_meeting_id: onlineMeetingId,
          user_id: user_id,
          transcript: transcriptText,
          summary: null,
          proposal_items: null,
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error("❌ Supabase insert failed:", insertError);
          continue;
        } else {
          console.log("✅ Supabase insert succeeded for meeting:", onlineMeetingId);
        }
      } catch (subError) {
        console.error("❌ Error processing call record:", subError);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Fatal ingestion error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
