'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import axios from 'axios'

export default function OpportunityPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { id: opportunityId } = router.query

  const [opportunity, setOpportunity] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!opportunityId || typeof opportunityId !== 'string') return

    const fetchData = async () => {
      try {
        const { data: opportunityData, error: opportunityError } = await supabase
          .from('opportunities')
          .select('*, clients:fk_client(name)')
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

    fetchData()
  }, [opportunityId, supabase])

  const handleUpdateSummary = async (meetingId: string) => {
    if (!prompt.trim()) return
    setUpdating(true)

    try {
      const res = await axios.post('/api/update-summary', {
        meetingId,
        prompt,
      })

      if (res.data.success) {
        alert('Summary updated successfully!')
        location.reload()
      } else {
        alert('Something went wrong.')
      }
    } catch (err) {
      console.error(err)
      alert('Update failed.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">Error: {error}</div>
  if (!opportunity) return <div>Opportunity not found</div>

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">{opportunity.name}</h1>
      <p className="text-gray-500 mb-6">
        Client: {opportunity.clients?.name || 'N/A'}
      </p>

      <h2 className="text-xl font-semibold mb-3">Assigned Meetings</h2>
      {meetings.length === 0 ? (
        <p>No meetings assigned to this opportunity.</p>
      ) : (
        <ul className="space-y-6">
          {meetings.map((meeting: any) => (
            <li key={meeting.id} className="border rounded p-4 hover:bg-gray-50">
              <a
                href={`/meeting/${meeting.id}`}
                className="text-blue-600 text-lg font-semibold hover:underline"
              >
                {meeting.title || 'Untitled Meeting'}
              </a>
              <div className="text-sm text-gray-500 mb-2">
                {new Date(meeting.created_at).toLocaleString()}
              </div>

              <div className="mb-3">
                <strong>Short Summary:</strong>
                <p className="text-gray-700 text-sm mt-1">
                  {meeting.summary?.slice(0, 150)}...
                </p>
              </div>

              <div className="mt-4">
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                  placeholder="Suggest a change to the summary (e.g. correct a name or add detail)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <button
                  onClick={() => handleUpdateSummary(meeting.id)}
                  className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Update Summary'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

