// api/graph/pollCallRecords.ts
export const config = {
  runtime: 'edge',
  schedule: '*/5 * * * *' // Optional here, but defined in vercel.json
}

export default async function handler(req: Request) {
  const accessToken = process.env.GRAPH_ACCESS_TOKEN
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-vercel-url.vercel.app'

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Missing GRAPH_ACCESS_TOKEN' }), { status: 500 })
  }

  try {
    const meetingsRes = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const meetingsData = await meetingsRes.json()

    const endedMeetings = (meetingsData.value || []).filter(
      (meeting: any) => meeting.endDateTime && new Date(meeting.endDateTime) < new Date()
    )

    const results: any[] = []

    for (const meeting of endedMeetings) {
      const meetingId = meeting.id

      const transcriptRes = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}/transcripts`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      const transcriptData = await transcriptRes.json()
      const transcriptItems = transcriptData.value || []

      if (transcriptItems.length === 0) {
        results.push({ meetingId, status: 'No transcript yet' })
        continue
      }

      const transcriptId = transcriptItems[0].id

      const contentRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const contentData = await contentRes.json()
      const transcriptText = contentData?.content || ''

      if (!transcriptText) {
        results.push({ meetingId, status: 'Transcript content missing' })
        continue
      }

      const summarizeRes = await fetch(`${baseUrl}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText, user_id: 'dummy-user-id' })
      })

      const summarizeResult = await summarizeRes.json()
      results.push({ meetingId, status: 'Summarized', summarizeResult })
    }

    return new Response(JSON.stringify({ results }), { status: 200 })
  } catch (error: any) {
    console.error('Polling error:', error)
    return new Response(JSON.stringify({ error: 'Polling failed', details: error.message }), { status: 500 })
  }
}
