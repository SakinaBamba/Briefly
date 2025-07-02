'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

const supabase = createClientComponentClient()

export default function ClientPage() {
  const router = useRouter()
  const { id: clientId } = router.query

  const [client, setClient] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])

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
      setOpportunities(opps || [])

      const { data: meetingData } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId)
      setMeetings(meetingData || [])
    }

    fetchData()
  }, [clientId])

  if (!client) return <p>Loading...</p>

  return (
    <div>
      <Link href="/clients" style={{ color: 'blue', textDecoration: 'none' }}>← Back to Clients</Link>
      <h2>{client.name}</h2>

      <h3>Opportunities</h3>
      {opportunities.length === 0 ? (
        <p>No opportunities yet.</p>
      ) : (
        <ul>
          {opportunities.map(opp => (
            <li key={opp.id}>{opp.name}</li>
          ))}
        </ul>
      )}

      <h3>Meetings</h3>
      {meetings.length === 0 ? (
        <p>No meetings assigned yet.</p>
      ) : (
        <ul>
          {meetings.map(meeting => (
            <li key={meeting.id}>{meeting.title || 'Untitled'} – {new Date(meeting.created_at).toLocaleString()}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
