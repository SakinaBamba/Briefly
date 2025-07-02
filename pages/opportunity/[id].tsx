'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

const supabase = createClientComponentClient()

export default function OpportunityPage() {
  const router = useRouter()
  const { id: opportunityId } = router.query

  const [opportunity, setOpportunity] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])

  useEffect(() => {
    if (!opportunityId) return

    const fetchData = async () => {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single()
      setOpportunity(opp)

      const { data: mtgs } = await supabase
        .from('meetings')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })
      setMeetings(mtgs || [])
    }

    fetchData()
  }, [opportunityId])

  if (!opportunity) return <p>Loading...</p>

  return (
    <div>
      <Link href={`/client/${opportunity.client_id}`} style={{ color: 'blue' }}>← Back to Client</Link>
      <h2>{opportunity.name}</h2>

      <h3>Assigned Meetings</h3>
      {meetings.length === 0 ? (
        <p>No meetings assigned to this opportunity.</p>
      ) : (
        <ul>
          {meetings.map(meeting => (
            <li key={meeting.id}>
              {meeting.title || 'Untitled'} – {new Date(meeting.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
