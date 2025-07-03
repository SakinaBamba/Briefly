import { Document, Packer, Paragraph, TextRun } from 'docx'
import { saveAs } from 'file-saver'

const handleGenerate = async () => {
  if (!documentType || selectedMeetingIds.length === 0) return

  const selected = meetings.filter((m) => selectedMeetingIds.includes(m.id))
  const titleText = documentType === 'proposal' ? 'Proposal Document' : 'Contract Document'

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: titleText, bold: true, size: 36 }),
              new TextRun('\n\n'),
            ],
          }),
          ...selected.map((m, idx) => (
            new Paragraph({
              children: [
                new TextRun({ text: `${idx + 1}. ${m.title}`, bold: true, size: 28 }),
                new TextRun('\n'),
                new TextRun({ text: m.summary || 'No summary available.', size: 24 }),
                new TextRun('\n\n'),
              ],
            })
          )),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${titleText.replace(' ', '_')}_${new Date().toISOString()}.docx`
  saveAs(blob, filename)
}

