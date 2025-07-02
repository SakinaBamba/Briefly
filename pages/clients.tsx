'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function ClientsPage() {
  const supabase = createClientComponentClient()
  const [clients, setClients] = useState<any[]>([])
  const [newClientName, setNewClientName] = useState('')

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('name')

      setClients(data || [])
    }
    fetchClients()
  }, [])

  const handleAddClient = async () => {
    const name = newClientName.trim()
    if (!name) return alert('Client name cannot be empty')

    // Check if client exists
    const { data: existing } = await supabase
      .from('clients')
      .select('*')
      .eq('name', name)
      .single()

    if (existing) {
      alert('Client already exists')
      return
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({ name })
      .select()
      .single()

    if (data) {
      setClients(prev => [...prev, data])
      setNewClientName('')
    } else {
      alert('Failed to create client')
      console.error(error)
    }
  }

  return (
    <div>
      <h2>Clients</h2>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="New client name"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={handleAddClient}>Add</button>
      </div>

      <ul>
        {clients.map(client => (
          <li key={client.id}>{client.name}</li>
        ))}
      </ul>
    </div>
  )
}
