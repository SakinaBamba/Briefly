import { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Meeting {
  id: string
  title: string
  summary: string
  client_id: string | null
}

interface Client {
  id: string
  client_name: string
}


export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
      return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  return { props: { initialSession: session } }
}

export default function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [assignMeetingId, setAssignMeetingId] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  // 🔧 NEW: Handle OAuth redirect code from Supabase
  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (typeof window !== 'undefined' && window.location.href.includes('code=')) {
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (error) {
          console.error("Error exchanging code:", error);
        } else {
          // Reload page to allow SSR to pick up the new session cookie
          router.replace('/');
        }
      }
    };
    handleOAuthCallback();
  }, []);

  useEffect(() => {
    fetch('/api/getMeetings')
      .then((res) => res.json())
      .then((data) => {
        setMeetings(data.meetings)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const loadUserAndClients = async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user.id || null
      setUserId(uid)
        const json = await res.json()
        setClients(json.clients)
      }
    }
    loadUserAndClients()
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return <p>Loading meetings...</p>
  }

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Meetings</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          Sign Out
        </button>
      </header>

      {meetings.length === 0 ? (
        <p>No meetings found.</p>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="p-4 border rounded-lg">
              <h2 className="font-semibold">{meeting.title}</h2>
              <p className="text-sm text-gray-600 mb-2">{meeting.summary}</p>
              {meeting.client_id ? (
                <p className="text-sm text-green-700">
                  Assigned to {clients.find(c => c.id === meeting.client_id)?.client_name || meeting.client_id}
                </p>
              ) : (
                <>
                  {assignMeetingId === meeting.id ? (
                    <div className="mt-2">
                      <select
                        className="border p-1 mr-2"
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        value={selectedClientId || ''}
                      >
                        <option value="">Select client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.client_name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="px-2 py-1 bg-green-600 text-white rounded mr-2"
                        onClick={async () => {
                          if (!selectedClientId) return
                          await fetch('/api/assignMeetingToClient', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ meetingId: meeting.id, clientId: selectedClientId })
                          })
                          setMeetings(
                            meetings.map((m) =>
                              m.id === meeting.id ? { ...m, client_id: selectedClientId } : m
                            )
                          )
                          setAssignMeetingId(null)
                          setSelectedClientId(null)
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="px-2 py-1 bg-gray-300 rounded"
                        onClick={() => {
                          setAssignMeetingId(null)
                          setSelectedClientId(null)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    userId && (
                      <button
                        className="mt-2 px-2 py-1 bg-blue-600 text-white rounded"
                        onClick={() => setAssignMeetingId(meeting.id)}
                      >
                        Assign to Client
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
