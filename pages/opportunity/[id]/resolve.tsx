// pages/opportunity/[id]/resolve.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/supabase'
import { OpenAI } from 'openai'

type Meeting = Database['public']['Tables']['meetings']['Row']

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
  dangerouslyAllowBrowser: true
})

export default function ResolveContradictionsPage() {
  const supabase = createClientComponentClient<Database>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const meetingIds = searchParams.getAll('meetingIds')
  const [contradictions, setContradictions] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const compareSummaries = async () => {
      if (!meetingIds.length) {
        setContradictions('No meetings selected.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, summary')
        .in('id', meetingIds)

      if (error || !data) {
        setContradictions('Failed to fetch meeting summaries.')
        setLoading(false)
        return
      }

      const summaries = data
        .filter(m => m.summary)
        .map(m => `Meeting "${m.title}": ${m.summary}`)
        .join('\n\n')

      const prompt = `
You are an assistant that analyzes multiple meeting summaries. Your job is to identify any contradictions or changes in requirements, such as a change in number of devices, locations, or scope. If contradictions exist, summarize them clearly and ask the user to confirm or clarify.

Meetings:
${summaries}

List any contradictions, differences, or updates in requirements and ask for confirmation from the user.
`

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4
        })

        const flagged = completion.choices[0].message.content
        setContradictions(flagged || 'No contradictions found.')
      } catch (err) {
        setContradictions('Error analyzing summaries.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    compareSummaries()
  }, [meetingIds.join(',')])

  const handleConfirm = () => {
    const next = `/api/generate?meetingIds=${meetingIds.join(',')}`
    router.push(next)
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Resolve Contradictions</h1>
      {loading ? (
        <p>Analyzing selected meetings...</p>
      ) : (
        <>
          <pre style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>{contradictions}</pre>
          <button onClick={handleConfirm} disabled={loading}>
            Yes, proceed with document generation
          </button>
        </>
      )}
    </main>
  )
}
