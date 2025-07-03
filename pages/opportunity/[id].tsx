'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function OpportunityPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { id: opportunityId } = router.query

  const [opportunity, setOpportunity] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')

  useEffect(() => {
    if (!opportunityId || typeof opportunityId !== 'string') return

    if (opportunityId === 'new') {
      fetchClients()
      setLoading(false)
      return
    }

    const fetchOpportunityData = async () => {
      try {
        const { data: opportunityData, error: opportunityError } = await supabase
          .from('opportunities')
          .select('*, client:clients(name)')
          .eq('id', opportunityId)
          .single()

        if (opportunityError) throw opportunityError
        setOpportunity(opportunityData)

        const { data: meetingsData, error: meetingsError } = await supabase
          .from('meetings')
          .select('*')
          .eq('opportunity_id', opportunityId)
          .order('created_at', { ascending: false })

        if (meetingsError) throw meetingsError
        setMeetings(meetingsData)
      } catch (err: any) {
        console.error('Fetch error:', err)
        setError('Failed to load opportunity')
      } finally {
        setLoading(false)
      }
    }

    fetchOpportunityData()
  }, [opportunityId])

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('*')
    if (error) console.error('Failed to fetch clients:', error)
    else setClients(data)
  }

  const handleCreateOpportunity = async () => {
    if (!newName || !selectedClientId) return

    const { data, error } = await supabase
      .from('opportunities')
      .insert({ name: newName, client_id: selectedClientId })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      setError('Failed to create opportunity')
    } else {
      router.push(`/opportunity/${data.id}`)
    }
  }

  if (loading) return <p>Loading...</p>
  if (opportunityId === 'new') {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Create New Opportunity</h1>
        <input
          type="text"
          placeholder="Opportunity name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}
        />
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}
        >
          <option value="">Select client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <button onClick={handleCreateOpportunity} style={{ padding: '0.5rem 1rem' }}>
          Create
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  if (error) return <p>{error}</p>

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Opportunity: {opportunity?.name}</h1>
      <h2>Client: {opportunity?.client?.name}</h2>
      <h3>Meetings:</h3>
      <ul>
        {meetings.map((m) => (
          <li key={m.id}>
            <strong>{m.title}</strong> — {new Date(m.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  )
}



