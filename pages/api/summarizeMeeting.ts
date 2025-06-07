// File: supabase/functions/uploadTranscript/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { meetingId, transcript } = await req.json();

    if (!meetingId || !transcript) {
      return new Response(JSON.stringify({ error: "Missing meetingId or transcript" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("meetings")
      .insert([
        {
          id: meetingId,
          transcript: transcript,
          summary: null,
          proposal_items: [],
          client_id: null,
          title: "Untitled Meeting",
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to insert meeting", details: error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Transcript uploaded successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Upload function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
