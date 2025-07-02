'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function MeetingPage() {
  const router = useRouter()
  const { id: meetingId } = router.query
  const supabase = createClientComponentClient()

  const [meeting, setMeeting] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        console.error('Meeting fetch error:', err.message)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMeeting()
  }, [meetingId, supabase])

  const formatSummary = (summary: string) => {
    return summary
      .split('\n')
      .filter(p => p.trim() !== '')
      .map((p, idx) => {
        if (p.trim().startsWith('- ')) {
          return <li key={idx} className="list-disc ml-6">{p.trim().substring(2)}</li>
        }
        return <p key={idx} className="mb-2">{p.trim()}</p>
      })
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">Error: {error}</div>
  if (!meeting) return <div>Meeting not found</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{meeting.title || 'Untitled Meeting'}</h1>
      <div className="text-gray-500 text-sm mb-6">
        {new Date(meeting.created_at).toLocaleString()}
      </div>
      <h2 className="text-lg font-semibold mb-2">Summary</h2>
      <div>{formatSummary(meeting.summary || '')}</div>
    </div>
  )
}

