'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])

  useEffect(() => {
    const fetchSessionAndClients = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Error fetching session:', sessionError)
        return
      }

      setSession(session)

      if (!session) {
        router.push('/login')
        return
      }

      const { data: clientsData, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading clients:', error)
      } else {
        setClients(clientsData || [])
      }
    }

    fetchSessionAndClients()
  }, [])

  return (
    <div style={{ padding: '40px' }}>
      <h1>Welcome to Dashboard</h1>
      {clients.length === 0 ? (
        <p>No clients found.</p>
      ) : (
        <ul>
          {clients.map((client) => (
            <li key={client.id}>
              <strong>{client.name}</strong> – {client.email}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


