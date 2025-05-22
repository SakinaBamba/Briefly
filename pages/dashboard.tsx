// Inside pages/dashboard.tsx
import { useEffect } from 'react'

export default function Dashboard() {
  const [email, setEmail] = useState('')
  const supabase = createClientComponentClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email || '')
    }
    getUser()
  }, [])

  // 🔁 POLLING LOGIC
  useEffect(() => {
    const pollMeetings = async () => {
      try {
        const res = await fetch('/api/graph/pollCallRecords', { method: 'POST' })
        const json = await res.json()
        console.log('Polled meetings:', json)
        // You could now check for meetings that ended and send to summarize API
      } catch (err) {
        console.error('Polling failed', err)
      }
    }

    // Poll every 1 minute
    const interval = setInterval(pollMeetings, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return <h2>Welcome, {email}</h2>
}

