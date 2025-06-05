import { useEffect } from 'react'
import { useRouter } from 'next/router'
import * as microsoftTeams from '@microsoft/teams-js'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createBrowserSupabaseClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
})




export default function StartTranscription() {
  const router = useRouter()

  useEffect(() => {
    const { meetingId, callId } = router.query

    if (!meetingId || !callId) return

    microsoftTeams.app.initialize().then(() => {
      microsoftTeams.authentication.getAuthToken({
        successCallback: token => {
          fetch('/api/teams/startTranscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ meetingId, callId })
          })
        },
        failureCallback: error => {
          console.error('Token fetch failed', error)
        }
      })
    })
  }, [router.query])

  return <div>Starting transcription...</div>
}
