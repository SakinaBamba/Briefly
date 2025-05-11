// pages/api/generateProposal.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import fetch from 'node-fetch';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OpenAIResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileUrl } = req.body;
  if (!fileUrl) return res.status(400).json({ error: 'Missing fileUrl' });

  try {
    const fileRes = await fetch(fileUrl);
    const buffer = await fileRes.arrayBuffer();
    const fileData = Buffer.from(buffer);

    const ext = fileUrl.split('.').pop()?.toLowerCase();
    let textContent = '';

    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer: fileData });
      textContent = result.value;
    } else if (ext === 'pdf') {
      const result = await pdfParse(fileData);
      textContent = result.text;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates proposal summaries from text.'
          },
          {
            role: 'user',
            content: `Here is a transcript or proposal draft:\n\n${textContent}\n\nPlease extract a summary and clear bullet-point items under "Proposal items:"`
          }
        ]
      })
    });

    const data: OpenAIResponse = await gptResponse.json();
    const gptMessage = data.choices?.[0]?.message?.content || '';

    const [summaryPart, itemsPart] = gptMessage.split(/(?:Proposal items:)/i);
    const summary = summaryPart?.trim() || 'Summary unavailable.';
    const items = (itemsPart || '')
      .split(/[\n•\-–●]+/)
      .map(i => i.trim())
      .filter(i => i.length > 5);

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Proposal Summary', bold: true, size: 28 })] }),
            new Paragraph(summary),
            new Paragraph({ text: '', spacing: { after: 200 } }),
            new Paragraph({ children: [new TextRun({ text: 'Proposal Items', bold: true, size: 28 })] }),
            ...items.map(i => new Paragraph({ text: `• ${i}` }))
          ]
        }
      ]
    });

    const bufferDoc = await Packer.toBuffer(doc);

    const { data: uploadData, error } = await supabase.storage
      .from('proposals')
      .upload(`generated/${Date.now()}.docx`, bufferDoc, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

    if (error) throw error;

    return res.status(200).json({ summary, items, filePath: uploadData.path });
  } catch (err: any) {
    console.error('Proposal generation error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

