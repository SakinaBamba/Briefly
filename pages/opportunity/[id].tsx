'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function OpportunityPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { id: opportunityId } = router.query

  const [opportunity, setOpportunity] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!opportunityId || typeof opportunityId !== 'string') return

    const fetchOpportunityData = async () => {
      try {
        const { data: opportunityData, error: opportunityError } = await supabase
          .from('opportunities')
          .select('*, client:clients(name)')
          .eq('id', opportunityId)
          .single()

        if (opportunityError) throw opportunityError
        setOpportunity(opportunityData)

        const { data: meetingsData, error: meetingsError } = await supabase
          .from('meetings')
          .select('*')
          .eq('opportunity_id', opportunityId)
          .order('created_at', { ascending: false })

        if (meetingsError) throw meetingsError
        setMeetings(meetingsData)
      } catch (err: any) {
        console.error('Fetch error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchOpportunityData()
  }, [opportunityId, supabase])

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">Error: {error}</div>
  if (!opportunity) return <div>Opportunity not found</div>

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">{opportunity.name}</h1>
      <p className="text-gray-500 mb-6">
        Client: {opportunity.client?.name || 'N/A'}
      </p>

      <h2 className="text-xl font-semibold mb-3">Assigned Meetings</h2>
      {meetings.length === 0 ? (
        <p>No meetings assigned to this opportunity.</p>
      ) : (
        <ul className="space-y-4">
          {meetings.map((meeting) => (
            <li key={meeting.id} className="border rounded p-4 hover:bg-gray-50">
              <a
                href={`/meeting/${meeting.id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {meeting.title || 'Untitled Meeting'}
              </a>
              <div className="text-sm text-gray-500">
                {new Date(meeting.created_at).toLocaleString()}
              </div>
              <p className="mt-2 text-gray-700 text-sm line-clamp-3">
                {meeting.summary
                  ? meeting.summary.slice(0, 200) + '...'
                  : 'No summary available.'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}



