// pages/api/summarize.ts

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, user_id } = req.body;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` // Set this in Vercel
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview', // GPT-4.1 Mini's model ID
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes meetings and extracts proposal items.'
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

    // Optional: log OpenAI response for debugging
    console.log("OpenAI response:", data);

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({ error: 'Invalid response from OpenAI', details: data });
    }

    const gptMessage = data.choices[0].message.content;

    // Extract summary and proposal items
    const [summaryPart, itemsPart] = gptMessage.split("Proposal items:");
    const summary = summaryPart?.trim() || 'Summary unavailable.';
    const proposal_items = itemsPart
      ? itemsPart.split("\n").filter(line => line.trim().startsWith("-"))
      : [];

    // Return the summary and items to your frontend
    return res.status(200).json({
      summary,
      proposal_items
    });

  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: 'Request failed', details: err });
  }
}

console.log("Starting summarize API route");

const { transcript, user_id } = req.body;
console.log("Incoming body:", { transcript, user_id });
