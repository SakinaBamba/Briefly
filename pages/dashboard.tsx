// File: pages/dashboard.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Client {
  id: string
  client_name: string
  email: string
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [session, setSession] = useState<any>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      // 1. Check for an active session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Error fetching session:', sessionError)
        return
      }
      if (!session) {
        // Not signed in → redirect to login
        router.push('/login')
        return
      }
      setSession(session)

      // 2. Load your clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      if (clientsError) {
        console.error('Error loading clients:', clientsError)
      } else {
        setClients(clientsData || [])
      }

      setLoading(false)
    }

    init()
  }, [router, supabase])

  if (loading) {
    return <p>Loading dashboard…</p>
  }

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Welcome, {session.user.email}</h1>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            router.push('/login')
          }}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          Sign Out
        </button>
      </header>

      {clients.length === 0 ? (
        <p>No clients found.</p>
      ) : (
        <ul className="space-y-2">
          {clients.map((client) => (
            <li key={client.id} className="p-4 border rounded-lg">
              <strong>{client.client_name}</strong> – {client.email}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


