
'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

const supabase = createClientComponentClient()

export default function ClientPage() {
  const router = useRouter()
  const { id: clientId } = router.query

  const [client, setClient] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newOpportunityName, setNewOpportunityName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateOpportunity = async () => {
    if (!newOpportunityName || !clientId) return
    const { data, error } = await supabase
      .from('opportunities')
      .insert({ name: newOpportunityName, client_id: clientId })
      .select()
      .single()

    if (error) {
      console.error('Failed to create opportunity:', error)
    } else {
      router.push(`/opportunity/${data.id}`)
    }
  }

  useEffect(() => {
    if (!clientId) return

    const fetchData = async () => {
      try {
        const {
          data: clientData,
          error: clientError,
        } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single()

        if (clientError) throw clientError
        setClient(clientData)

        const { data: oppsData, error: oppsError } = await supabase
          .from('opportunities')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })

        if (oppsError) throw oppsError
        setOpportunities(oppsData)
      } catch (err) {
        console.error('Failed to load client or opportunities', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [clientId])

  if (loading) return <p>Loading...</p>
  if (!client) return <p>Client not found</p>

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Client: {client.name}</h1>

      <div style={{ marginBottom: '2rem' }}>
        <button onClick={() => setCreating(!creating)}>
          {creating ? 'Cancel' : 'Create New Opportunity'}
        </button>
        {creating && (
          <div style={{ marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="Opportunity name"
              value={newOpportunityName}
              onChange={(e) => setNewOpportunityName(e.target.value)}
              style={{ marginRight: '1rem' }}
            />
            <button onClick={handleCreateOpportunity}>Create</button>
          </div>
        )}
      </div>

      <h2>Opportunities</h2>
      <ul>
        {opportunities.map((opportunity) => (
          <li key={opportunity.id}>
            <Link href={`/opportunity/${opportunity.id}`}>
              <strong>{opportunity.name}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
