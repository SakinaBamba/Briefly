import { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

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

