import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getGraphAccessToken } from "../../../utils/getGraphToken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const graphUserId = process.env.GRAPH_USER_ID;
  const supabaseUserId = process.env.SUPABASE_USER_ID;

  if (!graphUserId)
    return res.status(500).json({ error: "GRAPH_USER_ID not configured" });
  if (!supabaseUserId)
    return res.status(500).json({ error: "SUPABASE_USER_ID not configured" });

  const accessToken = await getGraphAccessToken();
  if (!accessToken)
    return res.status(500).json({ error: "Failed to get Graph API token" });

  try {
    const results: any[] = [];
    let hasInsertError = false;

    // Read the last processed timestamp
    const { data: stateRow } = await supabase
      .from("processing_state")
      .select("value")
      .eq("key", "last_call_end")
      .maybeSingle();

    const lastProcessed: string | undefined = stateRow?.value;

    // Fetch call records
    const url = new URL("https://graph.microsoft.com/v1.0/communications/callRecords");
    if (lastProcessed) {
      url.searchParams.set("$filter", `endDateTime gt ${lastProcessed}`);
    } else {
      url.searchParams.set("$top", "1");
      url.searchParams.set("$orderby", "endDateTime desc");
    }

    const recordsRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const recordsData = await recordsRes.json();
    const records = recordsData.value || [];

    console.log("📞 Total call records fetched:", records.length);

    for (const record of records) {
      console.log(`➡️ Processing record ${record.id} ended at ${record.endDateTime}`);

      if (!record.endDateTime || new Date(record.endDateTime) > new Date()) {
        console.log("⏭️ Skipped: Future or missing endDateTime");
        continue;
      }

      const joinWebUrl: string | undefined = record.joinWebUrl;
      if (!joinWebUrl) {
        console.log("⏭️ Skipped: No joinWebUrl");
        continue;
      }

      const escapedUrl = encodeURIComponent(joinWebUrl.replace(/'/g, "''"));
      const meetingsUrl = new URL(
        `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings`
      );
      meetingsUrl.search = `$filter=joinWebUrl%20eq%20'${escapedUrl}'`;

      const meetingsRes = await fetch(meetingsUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const meetingsData = await meetingsRes.json();
      const onlineMeeting = meetingsData.value?.[0];
      if (!onlineMeeting) {
        console.log("❌ No matching online meeting for join URL.");
        results.push({ recordId: record.id, status: "Online meeting not found" });
        continue;
      }

      const meetingId: string = onlineMeeting.id;

      const { data: existing } = await supabase
        .from("meetings")
        .select("id")
        .eq("external_meeting_id", meetingId)
        .maybeSingle();
      if (existing) {
        console.log("🟡 Already processed meeting:", meetingId);
        results.push({ meetingId, status: "Already processed" });
        continue;
      }

      const transcriptsRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings/${meetingId}/transcripts`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const transcriptsData = await transcriptsRes.json();
      const transcript = transcriptsData.value?.[0];
      if (!transcript) {
        console.log("📭 No transcript found for meeting:", meetingId);
        results.push({ meetingId, status: "No transcript available" });
        continue;
      }

      const transcriptId: string = transcript.id;
      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const transcriptText = await contentRes.text();
      if (!transcriptText) {
        console.log("📭 Transcript content is empty");
        results.push({ meetingId, status: "Empty transcript" });
        continue;
      }

      console.log(`📝 Transcript preview (${meetingId}):`, transcriptText.slice(0, 300));

      const payload = {
        external_meeting_id: meetingId,
        user_id: supabaseUserId,
        transcript: transcriptText,
        summary: null,
        proposal_items: null,
        created_at: new Date().toISOString(),
      };

      console.log("📤 Inserting into Supabase:", payload);

      const { error } = await supabase.from("meetings").insert(payload);

      if (error) {
        console.error("❌ Supabase insert failed:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        hasInsertError = true;
        results.push({ meetingId, status: "Supabase insert failed", error });
        continue;
      }

      console.log("✅ Successfully inserted meeting:", meetingId);

      if (record.endDateTime) {
        await supabase.from("processing_state").upsert({
          key: "last_call_end",
          value: record.endDateTime,
        });
        console.log("🕒 Updated processing_state with:", record.endDateTime);
      }

      results.push({ meetingId, status: "Stored transcript" });
    }

    if (results.length === 0) {
      results.push({ status: "No new meetings to process" });
    }

    const statusCode = hasInsertError ? 500 : 200;
    return res.status(statusCode).json({ results });
  } catch (err: any) {
    console.error("💥 Polling error:", err);
    return res.status(500).json({ error: "Polling failed", details: err.message });
  }
}


