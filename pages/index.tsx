// File: pages/index.tsx

import { GetServerSideProps } from 'next'
import { parse } from 'cookie'
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

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  // Parse cookies from the incoming request
  const cookies = req.headers.cookie
  const parsed = cookies ? parse(cookies) : {}

  // Supabase stores the JWT in sb-access-token
  if (!parsed['sb-access-token']) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  // Session cookie exists → allow render
  return { props: {} }
}

export default function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [assignMeetingId, setAssignMeetingId] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/getMeetings')
      .then((res) => res.json())
      .then((data) => {
        setMeetings(data.meetings)
        setLoading(false)
      })
    fetch('/api/getClients')
      .then((res) => res.json())
      .then((data) => setClients(data.clients))
  }, [])

  const handleLogout = async () => {
    // Clear Supabase cookies by hitting your logout endpoint
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
              <h2 className="text-xl font-semibold">{meeting.title}</h2>
              <p className="text-gray-600 mt-2">{meeting.summary}</p>
              <p className="text-sm mt-2">
                Client:{' '}
                {meeting.client_id ? meeting.client_id : 'Unassigned'}
              </p>
              {!meeting.client_id && (
                <button
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
                  onClick={() => setAssignMeetingId(meeting.id)}
                >
                  Assign to Client
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {assignMeetingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Assign Meeting</h2>
            <select
              className="w-full p-2 border mb-4"
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="New client name..."
              className="w-full p-2 border mb-2"
              onChange={(e) => setSelectedClientId('new:' + e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded"
                onClick={() => {
                  setAssignMeetingId(null)
                  setSelectedClientId(null)
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={async () => {
                  if (!assignMeetingId || !selectedClientId) return
                  if (selectedClientId.startsWith('new:')) {
                    const clientName = selectedClientId.slice(4)
                    const res = await fetch('/api/createClient', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: 'CURRENT_USER_ID_HERE',
                        clientName,
                      }),
                    })
                    const { client } = await res.json()
                    await fetch('/api/assignMeetingToClient', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        meetingId: assignMeetingId,
                        clientId: client.id,
                      }),
                    })
                  } else {
                    await fetch('/api/assignMeetingToClient', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        meetingId: assignMeetingId,
                        clientId: selectedClientId,
                      }),
                    })
                  }
                  setAssignMeetingId(null)
                  setSelectedClientId(null)
                  // Refresh data
                  const mRes = await fetch('/api/getMeetings')
                  setMeetings((await mRes.json()).meetings)
                  const cRes = await fetch('/api/getClients')
                  setClients((await cRes.json()).clients)
                }}
                disabled={!selectedClientId}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


