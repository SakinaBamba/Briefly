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
        .select('*, clients(name)')
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
    <div className="p-6 max-w-4xl mx-auto">
      <Link href={`/client/${opportunity.client_id}`} className="text-blue-600 hover:underline">
        ← Back to Client
      </Link>

      <h1 className="text-2xl font-bold mt-4">{opportunity.name}</h1>
      <p className="text-gray-500 mb-6">Client: {opportunity.clients?.name}</p>

      <h2 className="text-xl font-semibold mb-2">Assigned Meetings</h2>
      {meetings.length === 0 ? (
        <p>No meetings have been assigned to this opportunity.</p>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/meeting/${meeting.id}`}
              className="block border rounded-lg p-4 hover:bg-gray-50 transition"
            >
              <h3 className="text-lg font-semibold">{meeting.title || 'Untitled Meeting'}</h3>
              <p className="text-sm text-gray-500">
                {new Date(meeting.created_at).toLocaleString()}
              </p>
              <p className="mt-2 text-gray-700 line-clamp-2">
                {meeting.summary || 'No summary available.'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}



