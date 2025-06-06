import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import fetch from 'node-fetch'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

interface ChatCompletionResponse {
  choices?: {
    message?: {
      content?: string
    }
  }[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { opportunity_id } = req.body
  if (!opportunity_id) return res.status(400).json({ error: 'Missing opportunity_id' })

  try {
    const { data: meetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('opportunity_id', opportunity_id)

    const { data: opportunity } = await supabase
      .from('opportunities')
      .select('name, client_id')
      .eq('id', opportunity_id)
      .single()

    const { data: client } = await supabase
      .from('clients')
@@ -92,51 +100,51 @@ export default async function handler(req: NextApiRequest, res: NextApiResponse)
      .join('\n')

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that summarizes meetings and uploaded documents and extracts proposal items.\n\nYou must:\n- Generate a summary of the conversation and documents\n- List proposal items as bullet points starting with "-"\n- If any later document or upload contradicts earlier content, flag it clearly.\n- Respect user clarifications if provided.`
          },
          {
            role: 'user',
            content: `Here is the full chronological record:\n${combinedText}\n\n${clarificationText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    const data: ChatCompletionResponse = await gptResponse.json()
    const gptMessage = data.choices?.[0]?.message?.content || ''
    const [summaryPart, itemsPart] = gptMessage.split(/(?:Proposal items:)/i)
    const summary = summaryPart?.trim() || 'Summary unavailable.'

    let proposal_items: string[] = []
    if (itemsPart) {
      const bulletItems = itemsPart.split("\n").filter(line => line.trim().startsWith("-"))
      proposal_items = bulletItems.length > 0
        ? bulletItems.map(item => item.trim())
        : itemsPart.split(",").map(i => `- ${i.trim()}`).filter(i => i !== "-")
    }

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: `${client!.name}`, bold: true, size: 28 })] }),
            new Paragraph({ children: [new TextRun({ text: `Proposal for ${opportunity!.name}`, bold: true, size: 24 })] }),
            new Paragraph({ text: '' }),
            new Paragraph({ children: [new TextRun({ text: 'Overall Summary:', bold: true, underline: {} })] }),
            new Paragraph({ text: summary }),
            new Paragraph({ text: '' }),
            new Paragraph({ children: [new TextRun({ text: 'Proposal Items:', bold: true, underline: {} })] }),
            ...proposal_items.map(item => new Paragraph({ text: `- ${item.replace(/^-/, '').trim()}` }))
          ]
  } catch (err: any) {
    res.status(500).json({ error: 'Proposal generation failed', details: err.message })
  }
}
