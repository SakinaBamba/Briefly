// pages/opportunity/[id].tsx
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import ConfirmFlagsModal from '@/components/ConfirmFlagsModal'

export default function OpportunityPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { id } = router.query

  const [opportunity, setOpportunity] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([])
  const [documentType, setDocumentType] = useState<'proposal' | 'contract' | null>(null)
  const [generating, setGenerating] = useState(false)
  const [flags, setFlags] = useState(null)
  const [proposedSummary, setProposedSummary] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchOpportunity()
    fetchMeetings()
  }, [id])

  const fetchOpportunity = async () => {
    const { data } = await supabase.from('opportunities').select('*').eq('id', id).single()
    setOpportunity(data)
  }

  const fetchMeetings = async () => {
    const { data } = await supabase.from('meetings').select('*').eq('opportunity_id', id)
    setMeetings(data || [])
  }

  const toggleSelect = (meetingId: string) => {
    setSelectedMeetingIds((prev) =>
      prev.includes(meetingId) ? prev.filter((id) => id !== meetingId) : [...prev, meetingId]
    )
  }

  const generateDoc = async (text: string) => {
    const titleText = documentType === 'proposal' ? 'Proposal Document' : 'Contract Document'
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [new Paragraph(titleText), new Paragraph(text)],
        },
      ],
    })
    const blob = await Packer.toBlob(doc)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${titleText.replace(/ /g, '_')}.docx`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleGenerate = async () => {
    if (!documentType || selectedMeetingIds.length === 0) return
    setGenerating(true)

    const selected = meetings.filter((m) => selectedMeetingIds.includes(m.id))

    if (selected.length === 1) {
      // Old behavior for one meeting
      await generateDoc(selected[0].summary)
      setGenerating(false)
      return
    }

    // New: Consolidate multiple summaries
    const res = await fetch('/api/consolidate-summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaries: selected.map((m) => m.summary) }),
    })
    const data = await res.json()
    setFlags(data.flags || [])
    setProposedSummary(data.proposedSummary || '')
    setShowModal(true)
    setGenerating(false)
  }

  const handleConfirmFlags = async (resolutions: Record<string, string>) => {
    setShowModal(false)
    await generateDoc(proposedSummary)
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>{opportunity?.name}</h1>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => setDocumentType('proposal')} disabled={documentType === 'proposal'}>
          Generate Proposal
        </button>
        <button
          onClick={() => setDocumentType('contract')}
          disabled={documentType === 'contract'}
          style={{ marginLeft: '10px' }}
        >
          Generate Contract
        </button>
      </div>

      <div>
        {meetings.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <div onClick={() => router.push(`/meeting/${m.id}`)} style={{ flex: 1 }}>
              <strong>{m.title}</strong>
              <p style={{ margin: 0 }}>{m.summary.slice(0, 100)}...</p>
            </div>
            <input
              type="checkbox"
              checked={selectedMeetingIds.includes(m.id)}
              onChange={() => toggleSelect(m.id)}
            />
          </div>
        ))}
      </div>

      <button onClick={handleGenerate} disabled={generating || !documentType}>
        {generating ? 'Generating...' : 'Generate Document'}
      </button>

      {showModal && flags && (
        <ConfirmFlagsModal
          flags={flags}
          onConfirm={handleConfirmFlags}
          onCancel={() => setShowModal(false)}
        />
      )}
    </main>
  )
}



