'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

export default function MeetingPage() {
  const router = useRouter()
  const [meeting, setMeeting] = useState<any>(null)

  useEffect(() => {
    if (!router.isReady) return

    const meetingId = router.query.id
    if (!meetingId) return

    const fetchMeeting = async () => {
      const { data } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single()
      setMeeting(data)
    }

    fetchMeeting()
  }, [router.isReady])

  if (!router.isReady || !router.query.id) return <p>Loading...</p>
  if (!meeting) return <p>Loading meeting...</p>

  const downloadTranscript = () => {
    const element = document.createElement('a')
    const file = new Blob([meeting.transcript || 'No transcript available.'], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `${meeting.title || 'meeting-transcript'}.txt`
    document.body.appendChild(element)
    element.click()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{meeting.title || 'Untitled Meeting'}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {new Date(meeting.created_at).toLocaleString()}
      </p>

      <h2 className="text-lg font-semibold mb-2">Summary</h2>
      <p className="bg-gray-100 p-4 rounded mb-6">{meeting.summary || 'No summary available.'}</p>

      <h2 className="text-lg font-semibold mb-2">Transcript</h2>
      <pre className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm mb-4">
        {meeting.transcript || 'No transcript available.'}
      </pre>

      <button
        onClick={downloadTranscript}
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition"
      >
        Download Transcript
      </button>
    </div>
  )
}

