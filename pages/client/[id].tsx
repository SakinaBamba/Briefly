'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function ClientPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const { id: clientId } = router.query

  const [client, setClient] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])

  useEffect(() => {
    if (!clientId) return

    const fetchData = async () => {
      // Fetch client info
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      setClient(clientData)

      // Fetch opportunities
      const { data: opps } = await supabase
        .from('opportunities')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
      setOpportunities(opps || [])

      // Fetch meetings
      const { data: mtgs } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
      setMeetings(mtgs || [])
    }

    fetchData()
  }, [clientId])

  if (!client) return <p>Loading client info...</p>

  const getMeetingsForOpportunity = (oppId: string) =>
    meetings.filter(m => m.opportunity_id === oppId)

  return (
    <div style={{ padding: '40px' }}>
      <h1>{client.name}</h1>

      {opportunities.length === 0 ? (
        <p>No opportunities yet.</p>
      ) : (
        <>
          <h2>Opportunities</h2>
          {opportunities.map(opp => {
            const oppMeetings = getMeetingsForOpportunity(opp.id)
            return (
              <div key={opp.id} style={{ marginBottom: '40px', border: '1px solid #ccc', padding: '20px' }}>
                <h3>{opp.name}</h3>

                {oppMeetings.length === 0 ? (
                  <p>No meetings yet.</p>
                ) : (
                  oppMeetings.map(m => (
                    <div key={m.id} style={{ marginBottom: '20px' }}>
                      <p><strong>Summary:</strong> {m.summary}</p>
                      {m.proposal_items?.length > 0 && (
                        <>
                          <p><strong>Proposal Items:</strong></p>
                          <ul>
                            {m.proposal_items.map((item: string, idx: number) => (
                              <li key={idx}>{item.replace(/^-/, '').trim()}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ))
                )}

                {/* 📄 Generate Proposal Button */}
                <button
                  onClick={async () => {
                    const res = await fetch('/api/generateProposal', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ opportunity_id: opp.id })
                    })

                    if (!res.ok) {
                      alert('Failed to generate proposal')
                      return
                    }

                    const blob = await res.blob()
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${client.name} - ${opp.name} Proposal.docx`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                  }}
                  style={{
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}
                >
                  📄 Generate Proposal
                </button>

                {/* 📎 File Upload with Date */}
                <div style={{ marginTop: '20px' }}>
                  <p><strong>Upload a file (RFP, Email, etc.):</strong></p>

                  <input
                    type="date"
                    id={`file-date-${opp.id}`}
                    defaultValue={new Date().toISOString().split('T')[0]}
                    style={{ marginRight: '10px', padding: '5px' }}
                  />

                  <input
                    type="file"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      const dateInput = document.getElementById(`file-date-${opp.id}`) as HTMLInputElement
                      const sourceDate = dateInput?.value

                      const formData = new FormData()
                      formData.append('opportunity_id', opp.id)
                      formData.append('source_date', sourceDate || new Date().toISOString().split('T')[0])
                      formData.append('file', file)

                      const res = await fetch('/api/uploadFile', {
                        method: 'POST',
                        body: formData
                      })

                      if (res.ok) {
                        alert('✅ File uploaded successfully!')
                      } else {
                        const error = await res.json()
                        alert(`❌ Upload failed: ${error.error || 'Unknown error'}`)
                      }
                    }}
                  />
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

