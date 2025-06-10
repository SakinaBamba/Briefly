import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getGraphAccessToken } from "../../../utils/getGraphToken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const accessToken = await getGraphAccessToken();
  // ID of a user in the `auth.users` table. Required for inserting meeting
  // records.
  const userId = process.env.GRAPH_USER_ID;

  if (!userId)
    return res.status(500).json({ error: "GRAPH_USER_ID not configured" });
  if (!accessToken)
    return res.status(500).json({ error: "Failed to get Graph API token" });

  try {
    const results: any[] = [];

    // Previously a test row was inserted on each run to verify Supabase
    // connectivity. This caused foreign key violations if GRAPH_USER_ID did not
    // match an existing `auth.users` entry. The test insert has been removed.

    // Read the timestamp of the last processed call from Supabase.
    // The `processing_state` table keeps simple key/value pairs.
    const { data: stateRow } = await supabase
      .from("processing_state")
      .select("value")
      .eq("key", "last_call_end")
      .maybeSingle();

    const lastProcessed: string | undefined = stateRow?.value;

    // 1️⃣ Fetch call records after the last processed timestamp
    const url = new URL(
          "https://graph.microsoft.com/v1.0/communications/callRecords",
    );
    if (lastProcessed) {
      url.searchParams.set("$filter", `endDateTime gt ${lastProcessed}`);
    } else {
      url.searchParams.set("$top", "1");
      url.searchParams.set("$orderby", "endDateTime desc");
    }

    const recordsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const recordsData = await recordsRes.json();
    const records = recordsData.value || [];

    for (const record of records) {
      // Process only ended calls
      if (!record.endDateTime || new Date(record.endDateTime) > new Date())
        continue;
      const joinWebUrl: string | undefined = record.joinWebUrl;
      if (!joinWebUrl) continue;

      // 2️⃣ Find the online meeting using the join URL
      // Insert the join URL directly in the filter. Any single quotes in the
      // URL must be escaped by doubling them per the OData specification.
      const escapedUrl = joinWebUrl.replace(/'/g, "''");
      const meetingsRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings?$filter=joinWebUrl%20eq%20'${escapedUrl}'`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const meetingsData = await meetingsRes.json();
      const onlineMeeting = meetingsData.value?.[0];
      if (!onlineMeeting) {
        results.push({
          recordId: record.id,
          status: "Online meeting not found",
        });
        continue;
      }
      const meetingId: string = onlineMeeting.id;

      // Check if meeting already stored
      const { data: existing } = await supabase
        .from("meetings")
        .select("id")
        .eq("external_meeting_id", meetingId)
        .maybeSingle();
      if (existing) {
        results.push({ meetingId, status: "Already processed" });
        continue;
      }

      // 3️⃣ Fetch transcript list
      const transcriptsRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingId}/transcripts`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const transcriptsData = await transcriptsRes.json();
      const transcript = transcriptsData.value?.[0];
      if (!transcript) {
        results.push({ meetingId, status: "No transcript available" });
        continue;
      }
      const transcriptId: string = transcript.id;

      // 4️⃣ Download transcript content
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const transcriptText = await contentRes.text();
      if (!transcriptText) {
        results.push({ meetingId, status: "Empty transcript" });
        continue;
      }

      // 5️⃣ Store in Supabase
      const { error } = await supabase.from("meetings").insert({
        external_meeting_id: meetingId,
        user_id: userId,
        transcript: transcriptText,
        summary: null,
        proposal_items: null,
        created_at: new Date().toISOString(),
      });

      if (error) {
        results.push({ meetingId, status: "Supabase insert failed", error });
        continue;
      }

      // Update last processed timestamp in Supabase
      if (record.endDateTime) {
        await supabase.from("processing_state").upsert({
          key: "last_call_end",
          value: record.endDateTime,
        });
      }

      results.push({ meetingId, status: "Stored transcript" });
    }

    return res.status(200).json({ results });
  } catch (err: any) {
    console.error("Polling error:", err);
    return res
      .status(500)
      .json({ error: "Polling failed", details: err.message });
  }
}

