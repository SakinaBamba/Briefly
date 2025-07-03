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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')

  useEffect(() => {
    if (creating) {
      fetchClients()
    }
  }, [creating])

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

  useEffect(() => {
    if (!opportunityId || typeof opportunityId !== 'string') return

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

  if (loading) return <p>Loading...</p>
  if (error) return <p>{error}</p>

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button onClick={() => setCreating(!creating)}>
          {creating ? 'Cancel' : 'Create New Opportunity'}
        </button>
        {creating && (
          <div style={{ marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="Opportunity name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ marginRight: '1rem' }}
            />
            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <button onClick={handleCreateOpportunity} style={{ marginLeft: '1rem' }}>Create</button>
          </div>
        )}
      </div>

      <h1>Opportunity: {opportunity?.name}</h1>
      <h2>Client: {opportunity?.client?.name}</h2>
      <h3>Meetings:</h3>
      <ul>
        {meetings.map((m) => (
          <li key={m.id}>
            <a href={`/meeting/${m.id}`} style={{ textDecoration: 'underline' }}>
              <strong>{m.title}</strong>
            </a>{' '}
            — {new Date(m.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  )
}



