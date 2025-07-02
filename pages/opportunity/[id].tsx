'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function OpportunityPage() {
  const supabase = createClientComponentClient()
  const params = useParams()
  const opportunityId = Array.isArray(params.id) ? params.id[0] : params.id

  const [opportunity, setOpportunity] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOpportunityData = async () => {
      try {
        const { data: opportunityData, error: opportunityError } = await supabase
          .from('opportunities')
          .select('*, clients!client_id(name)')
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
        console.error('Error fetching opportunity or meetings:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (opportunityId) {
      fetchOpportunityData()
    }
  }, [opportunityId, supabase])

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">Error: {error}</div>
  if (!opportunity) return <div>Opportunity not found</div>

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">{opportunity.name}</h1>
      <p className="text-gray-500 mb-6">Client: {opportunity.clients?.name || 'N/A'}</p>

      <h2 className="text-xl font-semibold mb-3">Assigned Meetings</h2>
      {meetings.length === 0 ? (
        <p>No meetings assigned to this opportunity.</p>
      ) : (
        <ul className="space-y-4">
          {meetings.map((meeting: any) => (
            <li key={meeting.id} className="border rounded p-4 hover:bg-gray-50">
              <a href={`/meeting/${meeting.id}`} className="text-blue-600 hover:underline">
                {meeting.title || 'Untitled Meeting'}
              </a>
              <div className="text-sm text-gray-500">
                {new Date(meeting.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}



