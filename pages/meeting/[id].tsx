'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

const supabase = createClientComponentClient()

export default function MeetingPage() {
  const router = useRouter()
  const { id: meetingId } = router.query
  const [meeting, setMeeting] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!meetingId) return

    const fetchMeeting = async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single()

      setMeeting(data)
      setLoading(false)
    }

    fetchMeeting()
  }, [meetingId])

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>
  if (!meeting) return <div className="p-8 text-center text-red-500">Meeting not found.</div>

  const handleDownload = () => {
    const blob = new Blob([meeting.transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${meeting.title || 'meeting'}-transcript.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link href={`/opportunity/${meeting.opportunity_id}`} className="text-blue-500 hover:underline">← Back to Opportunity</Link>
      <h1 className="text-3xl font-semibold mt-4 mb-2">{meeting.title || 'Untitled Meeting'}</h1>
      <p className="text-sm text-gray-500 mb-6">{new Date(meeting.created_at).toLocaleString()}</p>

      <section className="bg-white shadow rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold mb-2">Summary</h2>
        <p className="text-gray-700 whitespace-pre-line">{meeting.summary || 'No summary available.'}</p>
      </section>

      <section className="bg-white shadow rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Transcript</h2>
          <button
            onClick={handleDownload}
            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
          >
            Download
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto border-t pt-4 text-gray-700 whitespace-pre-line">
          {meeting.transcript || 'Transcript not available.'}
        </div>
      </section>
    </div>
  )
} 
