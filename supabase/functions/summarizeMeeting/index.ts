import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  const { transcript, user_id } = await req.json();

  const openai_key = Deno.env.get("OPENAI_API_KEY");
  const supabase_url = Deno.env.get("SUPABASE_URL");
  const supabase_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabase_url, supabase_key);

  const summaryPrompt = `
You are a helpful assistant for presales engineers.

Summarize the following call transcript. Then extract any services or items the client asked for in a proposal.

Transcript:
${transcript}

Reply in JSON like:
{
  "summary": "short summary here",
  "proposal_items": ["Managed services", "Firewall", "Onboarding"]
}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openai_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: summaryPrompt }],
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);

    const { error } = await supabase.from("meetings").insert({
      user_id,
      transcript,
      summary: parsed.summary,
      proposal_items: parsed.proposal_items,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to parse or insert", details: err }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

