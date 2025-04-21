// pages/api/generateProposal.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Document, Packer, Paragraph, TextRun } from 'docx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { opportunity_id } = req.body
  if (!opportunity_id) return res.status(400).json({ error: 'Missing opportunity_id' })

  try {
    // Fetch meetings for the opportunity
    const { data: meetings, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('opportunity_id', opportunity_id)

    if (meetingError || !meetings || meetings.length === 0) {
      return res.status(404).json({ error: 'No meetings found for this opportunity' })
    }

    // Fetch the opportunity
    const { data: opportunity } = await supabase
      .from('opportunities')
      .select('name, client_id')
      .eq('id', opportunity_id)
      .single()

    // Fetch the client
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', opportunity.client_id)
      .single()

    // Merge summaries and proposal items
    const mergedSummary = meetings.map(m => m.summary).join('\n\n')
    const mergedItems: string[] = meetings.flatMap(m => m.proposal_items || [])

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${client.name}`, bold: true, size: 28 }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Proposal for ${opportunity.name}`,
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Date: ${new Date().toLocaleDateString()}`, size: 20 }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [new TextRun({ text: 'Overall Summary:', bold: true, underline: {} })],
            }),
            new Paragraph({ text: mergedSummary || 'No summary available.' }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [new TextRun({ text: 'Proposal Items:', bold: true, underline: {} })],
            }),
            ...mergedItems.map(item => new Paragraph({ text: `- ${item.replace(/^-/, '').trim()}` })),
          ],
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', 'attachment; filename=proposal.docx')
    res.send(buffer)
  } catch (err: any) {
    res.status(500).json({ error: 'Proposal generation failed', details: err.message })
  }
}
