'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import axios from 'axios'

export default function MeetingPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { id: meetingId } = router.query

  const [meeting, setMeeting] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updatedSummary, setUpdatedSummary] = useState<string | null>(null)

  useEffect(() => {
    if (!meetingId || typeof meetingId !== 'string') return

    const fetchMeeting = async () => {
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', meetingId)
          .single()

        if (error) throw error
        setMeeting(data)
      } catch (err: any) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMeeting()
  }, [meetingId, supabase])

  const handleSubmit = async () => {
    if (!suggestion.trim()) return
    setUpdating(true)
    try {
      const { data } = await axios.post('/api/update-summary', {
        meeting_id: meetingId,
        user_prompt: suggestion,
      })

      if (data && data.updatedSummary) {
        setUpdatedSummary(data.updatedSummary)
        setMeeting((prev: any) => ({
          ...prev,
          summary: data.updatedSummary,
        }))
        setSuggestion('')
      }
    } catch (err: any) {
      console.error('Error updating summary:', err)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>
  if (!meeting) return <div className="p-6">Meeting not found</div>

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">{meeting.title || 'Untitled Meeting'}</h1>
      <p className="text-sm text-gray-500">
        {new Date(meeting.created_at).toLocaleString()}
      </p>

      <section className="bg-white shadow-sm border rounded p-4">
        <h2 className="text-xl font-semibold mb-2">Meeting Summary</h2>
        <div className="whitespace-pre-line text-gray-800 leading-relaxed">
          {meeting.summary || 'No summary available yet.'}
        </div>
      </section>

      <section className="bg-white border rounded p-4 space-y-2">
        <h2 className="text-xl font-semibold">Suggest an Update to the Summary</h2>
        <p className="text-sm text-gray-600">If something is wrong or missing in the summary, explain it here:</p>
        <textarea
          className="w-full border p-2 rounded min-h-[100px]"
          placeholder="E.g. Vendor name was Cisco, not Juniper"
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
        />
        <button
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          onClick={handleSubmit}
          disabled={updating}
        >
          {updating ? 'Updating...' : 'Submit Suggestion'}
        </button>
      </section>

      {meeting.transcript && (
        <section className="bg-white border rounded p-4">
          <h2 className="text-xl font-semibold mb-2">Transcript</h2>
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(meeting.transcript)}`}
            download="transcript.txt"
            className="text-blue-600 underline"
          >
            Download Transcript
          </a>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
            {meeting.transcript}
          </pre>
        </section>
      )}
    </div>
  )
}

