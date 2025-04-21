import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import fetch from 'node-fetch'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // SERVICE ROLE for private bucket access
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { opportunity_id } = req.body
  if (!opportunity_id) return res.status(400).json({ error: 'Missing opportunity_id' })

  try {
    // Fetch meetings
    const { data: meetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('opportunity_id', opportunity_id)

    // Fetch opportunity and client
    const { data: opportunity } = await supabase
      .from('opportunities')
      .select('name, client_id')
      .eq('id', opportunity_id)
      .single()

    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', opportunity.client_id)
      .single()

    // Fetch uploaded files
    const { data: files } = await supabase
      .from('opportunity_files')
      .select('*')
      .eq('opportunity_id', opportunity_id)

    // Extract text from files
    const extractedFiles = await Promise.all(
      (files || []).map(async file => {
        const { data: signed } = await supabase.storage
          .from('opportunity-files')
          .createSignedUrl(file.storage_path, 60)

        if (!signed?.signedUrl) return null

        const response = await fetch(signed.signedUrl)
        const buffer = await response.buffer()

        let content = ''
        if (file.file_name.endsWith('.pdf')) {
          const parsed = await pdfParse(buffer)
          content = parsed.text
        } else if (file.file_name.endsWith('.docx')) {
          const { value } = await mammoth.extractRawText({ buffer })
          content = value
        } else {
          content = 'Unsupported file type'
        }

        return {
          type: 'file',
          date: file.source_date || new Date().toISOString(),
          text: `📎 ${file.file_name} (uploaded ${file.source_date}):\n${content}`
        }
      })
    )

    // Combine all sources
    const timeline = [
      ...meetings.map(m => ({
        type: 'meeting',
        date: m.created_at,
        text: `🗣 Meeting on ${new Date(m.created_at).toDateString()}:\n${m.transcript}`
      })),
      ...(extractedFiles.filter(Boolean) as { date: string, text: string }[])
    ]

    // Sort by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const combinedText = timeline.map(item => item.text).join('\n\n---\n\n')

    // Send to GPT-4
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
            content: `You are a helpful assistant that summarizes meetings and uploaded documents and extracts proposal items. 
You must:
- Generate a summary of the conversation and documents
- List proposal items as bullet points starting with "-"
- If any later document or upload contradicts or modifies earlier content, flag it clearly.
- Add a section at the end with your questions or items needing clarification from the user.`
          },
          {
            role: 'user',
            content: `Here are the chronological contents for proposal generation:\n\n${combinedText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    const data = await gptResponse.json()
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

    // Save to meetings table as new entry (optional — you can comment this out)
    const { error: insertError } = await supabase.from('meetings').insert([{
      user_id: null,
      transcript: combinedText,
      summary,
      proposal_items,
      client_id: opportunity.client_id,
      opportunity_id,
      title: 'Auto-generated Proposal Draft'
    }])

    if (insertError) {
      return res.status(500).json({ error: 'Failed to insert into Supabase', details: insertError })
    }

    // Generate docx proposal
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: `${client.name}`, bold: true, size: 28 })] }),
            new Paragraph({ children: [new TextRun({ text: `Proposal for ${opportunity.name}`, bold: true, size: 24 })] }),
            new Paragraph({ text: '' }),
            new Paragraph({ children: [new TextRun({ text: 'Overall Summary:', bold: true, underline: {} })] }),
            new Paragraph({ text: summary }),
            new Paragraph({ text: '' }),
            new Paragraph({ children: [new TextRun({ text: 'Proposal Items:', bold: true, underline: {} })] }),
            ...proposal_items.map(item => new Paragraph({ text: `- ${item.replace(/^-/, '').trim()}` }))
          ]
        }
      ]
    })

    const buffer = await Packer.toBuffer(doc)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', 'attachment; filename=proposal.docx')
    res.send(buffer)
  } catch (err: any) {
    res.status(500).json({ error: 'Proposal generation failed', details: err.message })
  }
}

