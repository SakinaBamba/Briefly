// pages/opportunity/[id]/resolve.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { OpenAI } from 'openai'

export default function ResolvePage({ params }: { params: { id: string } }) {
  const supabase = createClientComponentClient<Database>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [conflicts, setConflicts] = useState<string>('')
  const [resolution, setResolution] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const meetingIds = searchParams.get('meetings')?.split(',') || []

  useEffect(() => {
    const detectConflicts = async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('summary')
        .in('id', meetingIds)

      if (error) return setError('Failed to fetch summaries.')

      const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY })

      const summaries = data.map((m) => m.summary).join('\n---\n')
      const prompt = `Compare the following meeting summaries. If you detect any contradictions or changes in client decisions, list them clearly. Be concise but detailed. Summaries:\n${summaries}`

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })

        const reply = completion.choices[0].message.content
        setConflicts(reply || '')
        setLoading(false)
      } catch (e) {
        setError('OpenAI error: ' + (e as any).message)
        setLoading(false)
      }
    }

    detectConflicts()
  }, [meetingIds])

  const handleConfirm = () => {
    // Redirect to actual generation route with resolution explanation attached
    router.push(
      `/opportunity/${params.id}?generate=true&meetings=${meetingIds.join(',')}&explanation=${encodeURIComponent(
        resolution
      )}`
    )
  }

  if (loading) return <p>Detecting contradictions...</p>
  if (error) return <p className="text-red-500">{error}</p>

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Resolve Meeting Conflicts</h1>
      <p className="mb-2 whitespace-pre-line">{conflicts}</p>

      <label className="block mt-4 mb-1 font-medium">
        Confirm or explain the final decision:
      </label>
      <textarea
        className="w-full border rounded p-2 h-40"
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        placeholder="Example: The final decision is to use 15 APs because the client added 5 for common areas."
      />

      <button
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleConfirm}
        disabled={!resolution.trim()}
      >
        Confirm & Generate Document
      </button>
    </div>
  )
}
