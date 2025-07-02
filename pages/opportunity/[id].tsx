'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

const supabase = createClientComponentClient()

export default function OpportunityPage() {
  const params = useParams()
  const opportunityId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [opportunity, setOpportunity] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!opportunityId) {
      console.warn('Opportunity ID missing from URL.')
      return
    }

    const fetchData = async () => {
      setLoading(true)
      console.log('Fetching opportunity with ID:', opportunityId)

      const { data: opp, error: oppError } = await supabase
        .from('opportunities')
        .select('*, clients(name)')
        .eq('id', opportunityId)
        .single()

      if (oppError) {
        console.error('Error fetching opportunity:', oppError)
      } else {
        console.log('Fetched opportunity:', opp)
      }

      setOpportunity(opp)

      const { data: mtgs, error: mtgsError } = await supabase
        .from('meetings')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })

      if (mtgsError) {
        console.error('Error fetching meetings:', mtgsError)
      } else {
        console.log('Fetched meetings:', mtgs)
      }

      setMeetings(mtgs || [])
      setLoading(false)
    }

    fetchData()
  }, [opportunityId])

  if (loading) return <p>Loading...</p>
  if (!opportunity) return <p>Opportunity not found.</p>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href={`/client/${opportunity.client_id}`} className="text-blue-600 hover:underline">
        ← Back to Client
      </Link>

      <h1 className="text-2xl font-bold mt-4">{opportunity.name}</h1>
      <p className="text-gray-500 mb-6">Client: {opportunity.clients?.name || 'Unknown'}</p>

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


