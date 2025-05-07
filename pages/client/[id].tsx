'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-react';


export default function ClientPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const { id: clientId } = router.query

  const [client, setClient] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [opportunityClarifications, setOpportunityClarifications] = useState<{ [key: string]: any[] }>({})

  useEffect(() => {
    if (!clientId) return

    const fetchData = async () => {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      setClient(clientData)

      const { data: opps } = await supabase
        .from('opportunities')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
      setOpportunities(opps || [])

      const { data: mtgs } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
      setMeetings(mtgs || [])

      const opportunityIds = (opps || []).map((o: any) => o.id)
      if (opportunityIds.length > 0) {
        const { data: clarifications } = await supabase
          .from('clarifications')
          .select('*')
          .in('opportunity_id', opportunityIds)

        const groupedClarifications = (clarifications || []).reduce((acc: any, curr: any) => {
          acc[curr.opportunity_id] = acc[curr.opportunity_id] || []
          acc[curr.opportunity_id].push(curr)
          return acc
        }, {})

        setOpportunityClarifications(groupedClarifications)
      }
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

                <div style={{ marginTop: '30px' }}>
                  <p><strong>⚠️ AI Clarification Prompts:</strong></p>
                  {opportunityClarifications[opp.id]?.map((c: any) => (
                    <div key={c.id} style={{ marginBottom: '16px' }}>
                      <p>{c.ai_question}</p>
                      {c.user_response ? (
                        <p><em>✅ You responded:</em> {c.user_response}</p>
                      ) : (
                        <textarea
                          rows={2}
                          placeholder="Your clarification..."
                          style={{ width: '100%', padding: '6px', marginTop: '6px' }}
                          onBlur={async (e) => {
                            const user_response = e.target.value
                            if (!user_response.trim()) return

                            const res = await fetch('/api/saveClarification', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                opportunity_id: opp.id,
                                ai_question: c.ai_question,
                                user_response
                              })
                            })

                            if (res.ok) {
                              alert('Saved!')
                            } else {
                              alert('Failed to save clarification.')
                            }
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}


