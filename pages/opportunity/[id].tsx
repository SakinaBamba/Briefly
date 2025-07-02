'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function OpportunityPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { id: opportunityId } = router.query

  const [opportunity, setOpportunity] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promptInput, setPromptInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)

  useEffect(() => {
    if (!opportunityId || typeof opportunityId !== 'string') return

    const fetchOpportunityData = async () => {
      try {
        const { data: opportunityData, error: opportunityError } = await supabase
          .from('opportunities')
          .select('*, clients!fk_client(name)')
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

  const handlePromptSubmit = async () => {
    if (!selectedMeetingId || !promptInput.trim()) return
    setSaving(true)

    const response = await fetch('/api/update-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_id: selectedMeetingId,
        prompt: promptInput,
      }),
    })

    const result = await response.json()
    if (result.success) {
      alert('Summary updated successfully.')
      location.reload()
    } else {
      alert('Failed to update summary.')
    }

    setSaving(false)
    setPromptInput('')
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">Error: {error}</div>
  if (!opportunity) return <div>Opportunity not found</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{opportunity.name}</h1>
      <p className="text-gray-500 mb-6">Client: {opportunity.clients?.name || 'N/A'}</p>

      <h2 className="text-xl font-semibold mb-4">Assigned Meetings</h2>

      {meetings.length === 0 ? (
        <p>No meetings assigned to this opportunity.</p>
      ) : (
        <ul className="space-y-6">
          {meetings.map((meeting: any) => (
            <li key={meeting.id} className="border rounded-lg p-5 shadow">
              <div className="flex justify-between items-center">
                <a href={`/meeting/${meeting.id}`} className="text-blue-600 hover:underline font-semibold">
                  {meeting.title || 'Untitled Meeting'}
                </a>
                <span className="text-sm text-gray-500">{new Date(meeting.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-3 text-gray-700 whitespace-pre-line">{meeting.summary}</p>

              {selectedMeetingId === meeting.id ? (
                <div className="mt-4">
                  <textarea
                    className="w-full p-2 border rounded"
                    rows={4}
                    placeholder="Write prompt to update summary..."
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                  />
                  <button
                    onClick={handlePromptSubmit}
                    className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    disabled={saving}
                  >
                    {saving ? 'Updating...' : 'Update Summary'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedMeetingId(meeting.id)}
                  className="mt-4 text-sm text-blue-600 underline"
                >
                  Suggest update to summary
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

