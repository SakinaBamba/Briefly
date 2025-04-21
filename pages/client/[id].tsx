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

                {/* 🔜 Optional: Add Generate Proposal Button Here */}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
