'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function OpportunityPage() {
  const router = useRouter()
  const { id: opportunityId } = router.query
  const supabase = createClientComponentClient()

  const [opportunity, setOpportunity] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([])
  const [docType, setDocType] = useState<'proposal' | 'contract'>('proposal')
  const [generatedDoc, setGeneratedDoc] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!opportunityId) return
    const fetchOpportunity = async () => {
      const { data } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single()
      setOpportunity(data)
    }

    const fetchMeetings = async () => {
      const { data } = await supabase
        .from('meetings')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: true })
      setMeetings(data || [])
    }

    fetchOpportunity()
    fetchMeetings()
  }, [opportunityId])

  const handleMeetingSelect = (meetingId: string) => {
    setSelectedMeetings((prev) =>
      prev.includes(meetingId)
        ? prev.filter((id) => id !== meetingId)
        : [...prev, meetingId]
    )
  }

  const handleGenerate = async () => {
    if (!selectedMeetings.length || !opportunityId) return
    setGenerating(true)
    setGeneratedDoc('')

    try {
      const res = await fetch('/api/generateDocument', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          type: docType,
          meetings: selectedMeetings
        })
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('Server error:', data)
        alert('❌ Failed to generate document. Check logs for details.')
      } else if (!data.content) {
        console.warn('Empty response from OpenAI:', data)
        alert('⚠️ Received empty document. Try again or check backend logs.')
      }

      setGeneratedDoc(data.content || '')
    } catch (err) {
      console.error('Network or parsing error:', err)
      alert('❌ Error occurred while generating the document.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Opportunity Page</h1>
      {opportunity && (
        <h2 style={{ marginBottom: 24 }}>
          {opportunity.name}
        </h2>
      )}

      <h3>Select Meetings</h3>
      {meetings.map((m) => (
        <div key={m.id} style={{ marginBottom: 8 }}>
          <label>
            <input
              type="checkbox"
              checked={selectedMeetings.includes(m.id)}
              onChange={() => handleMeetingSelect(m.id)}
            />{' '}
            {new Date(m.created_at).toLocaleDateString()} — {m.summary?.slice(0, 60)}...
          </label>
        </div>
      ))}

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as 'proposal' | 'contract')}
          >
            <option value="proposal">Proposal</option>
            <option value="contract">Contract</option>
          </select>
        </label>
      </div>

      <button onClick={handleGenerate} disabled={generating || selectedMeetings.length === 0}>
        {generating ? 'Generating...' : 'Generate Document'}
      </button>

      {generatedDoc && (
        <div style={{ marginTop: 32 }}>
          <h3>Generated {docType.charAt(0).toUpperCase() + docType.slice(1)}</h3>
          <textarea
            value={generatedDoc}
            readOnly
            rows={20}
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
        </div>
      )}
    </main>
  )
}

