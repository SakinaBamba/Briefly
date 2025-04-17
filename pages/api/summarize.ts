// pages/api/summarize.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req, res) {
  console.log("▶️ Starting summarize API route");

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, user_id } = req.body;
  console.log("📝 Incoming body:", { transcript, user_id });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes meetings and extracts proposal items. Return the summary as a paragraph. Return the proposal items as a bullet list, each on its own line starting with a dash. Do not include section headers like "### Meeting Summary'
          },
          {
            role: 'user',
            content: `Here's the meeting transcript:\n\n${transcript}\n\nPlease provide a short summary of the meeting and a bullet point list of any proposal items discussed.`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const data = await response.json();
    console.log("🤖 OpenAI response:", data);

    if (!data.choices || !data.choices[0]?.message?.content) {
      console.error("❌ Invalid OpenAI response");
      return res.status(500).json({ error: 'Invalid response from OpenAI', details: data });
    }

    const gptMessage = data.choices[0].message.content;

    // Extract summary and proposal items
    const [summaryPart, itemsPart] = gptMessage.split("Proposal items:");
    const summary = summaryPart?.trim() || 'Summary unavailable.';

    let proposal_items: string[] = [];

    if (itemsPart) {
      const bulletItems = itemsPart.split("\n").filter(line => line.trim().startsWith("-"));

      if (bulletItems.length > 0) {
        proposal_items = bulletItems.map(item => item.trim());
      } else {
        // fallback: try comma-separated
        proposal_items = itemsPart
          .split(",")
          .map(i => `- ${i.trim()}`)
          .filter(i => i !== "-");
      }
    }

    console.log("✅ Parsed summary:", summary);
    console.log("✅ Parsed proposal items:", proposal_items);

    const { error: insertError } = await supabase
      .from('meetings')
      .insert([
        {
          user_id,
          transcript,
          summary,
          proposal_items,
          title: 'Untitled Meeting'
        }
      ]);

    if (insertError) {
      console.error("❌ Supabase insert error:", insertError);
      return res.status(500).json({ error: 'Failed to insert into Supabase', details: insertError });
    }

    return res.status(200).json({
      summary,
      proposal_items
    });

  } catch (err) {
    console.error("🔥 API error:", err);
    return res.status(500).json({ error: 'Request failed', details: err.message });
  }
}
