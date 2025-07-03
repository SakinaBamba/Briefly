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

  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')

  const handleUpdateName = async () => {
    if (!newName || !opportunityId) return
    const { data, error } = await supabase
      .from('opportunities')
      .update({ name: newName })
      .eq('id', opportunityId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update name:', error)
    } else {
      setOpportunity(data)
      setEditingName(false)
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
      <h1>Opportunity: 
        {editingName ? (
          <>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ marginRight: "1rem" }}
            />
            <button onClick={handleUpdateName}>Save</button>
            <button onClick={() => setEditingName(false)} style={{ marginLeft: "0.5rem" }}>Cancel</button>
          </>
        ) : (
          <>
            {opportunity?.name} <button onClick={() => { setEditingName(true); setNewName(opportunity?.name); }}>Edit</button>
          </>
        )}
      </h1>

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


