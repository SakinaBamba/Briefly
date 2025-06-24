'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Dashboard() {
  const supabase = createClientComponentClient()
  const [email, setEmail] = useState('')
  const [meetings, setMeetings] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<{ [clientId: string]: any[] }>({})
  const [clientSelections, setClientSelections] = useState<{ [meetingId: string]: string }>({})
  const [opportunitySelections, setOpportunitySelections] = useState<{ [meetingId: string]: string }>({})
  const [newClientNames, setNewClientNames] = useState<{ [meetingId: string]: string }>({})
  const [newOpportunityNames, setNewOpportunityNames] = useState<{ [meetingId: string]: string }>({})
  const [newClientCreated, setNewClientCreated] = useState<{ [meetingId: string]: boolean }>({})

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email)

      const { data: meetingsData } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .is('client_id', null)
        .order('created_at', { ascending: false })

      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name')

      setMeetings(meetingsData || [])
      setClients(clientsData || [])
    }

    loadData()
  }, [])

  const handleCreateClient = async (meetingId: string) => {
    const name = newClientNames[meetingId]?.trim()
    if (!name) return alert("Please enter a client name.")

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({ name })
        .select()
        .single()

      if (error) throw error

      setClients(prev => [...prev, data])
      setClientSelections(prev => ({ ...prev, [meetingId]: data.id }))
      setNewClientNames(prev => ({ ...prev, [meetingId]: '' }))
      setNewClientCreated(prev => ({ ...prev, [meetingId]: true }))
    } catch (error: any) {
      if (error.code === '23505') {
        // Duplicate client name
        const { data: existing } = await supabase
          .from('clients')
          .select('*')
          .eq('name', name)
          .single()

        if (existing) {
          alert("Client already exists. Assigning existing client.")
          setClientSelections(prev => ({ ...prev, [meetingId]: existing.id }))
          setNewClientNames(prev => ({ ...prev, [meetingId]: '' }))
          setNewClientCreated(prev => ({ ...prev, [meetingId]: false }))
        }
      } else {
        alert("Failed to create client. Please try again.")
        console.error(error)
      }
    }
  }

  const handleAssignClient = async (meetingId: string, clientId: string) => {
    setClientSelections(prev => ({ ...prev, [meetingId]: clientId }))
    setNewClientCreated(prev => ({ ...prev, [meetingId]: false }))

    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .eq('client_id', clientId)

    setOpportunities(prev => ({ ...prev, [clientId]: data || [] }))
  }

  const handleCreateOpportunity = async (meetingId: string) => {
    const name = newOpportunityNames[meetingId]?.trim()
    const clientId = clientSelections[meetingId]
    if (!name || !clientId) return alert("Please enter an opportunity name.")

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .insert({ name, client_id: clientId })
        .select()
        .single()

      if (error) throw error

      setOpportunities(prev => ({
        ...prev,
        [clientId]: [...(prev[clientId] || []), data]
      }))
      setOpportunitySelections(prev => ({ ...prev, [meetingId]: data.id }))
      setNewOpportunityNames(prev => ({ ...prev, [meetingId]: '' }))
    } catch (error: any) {
      if (error.code === '23505') {
        // Duplicate opportunity
        const { data: existing } = await supabase
          .from('opportunities')
          .select('*')
          .eq('client_id', clientId)
          .eq('name', name)
          .single()

        if (existing) {
          alert("Opportunity already exists for this client. Assigning it.")
          setOpportunitySelections(prev => ({ ...prev, [meetingId]: existing.id }))
          setNewOpportunityNames(prev => ({ ...prev, [meetingId]: '' }))
        }
      } else {
        alert("Failed to create opportunity. Please try again.")
        console.error(error)
      }
    }
  }

  const handleAssignOpportunity = async (meetingId: string, opportunityId: string) => {
    const clientId = clientSelections[meetingId]
    if (!clientId) return

    await supabase
      .from('meetings')
      .update({ client_id: clientId, opportunity_id: opportunityId })
      .eq('id', meetingId)

    setMeetings(prev => prev.filter(m => m.id !== meetingId))
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h2>Welcome, {email}</h2>
      <h3>Unassigned Meetings</h3>

      {meetings.length === 0 ? (
        <p>You have no unassigned meetings.</p>
      ) : (
        meetings.map(meeting => (
          <div key={meeting.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
            <h4>{meeting.title || 'Untitled Meeting'}</h4>
            <p>{new Date(meeting.created_at).toLocaleString()}</p>

            {/* Step 1: Assign or create client */}
            <div>
              <label>Select Existing Client:</label><br />
              <select
                onChange={e => handleAssignClient(meeting.id, e.target.value)}
                value={clientSelections[meeting.id] || ''}
              >
                <option value="">-- Select Client --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <br /><br />

              <label>Or create a new client:</label><br />
              <input
                type="text"
                placeholder="Client name"
                value={newClientNames[meeting.id] || ''}
                onChange={e => setNewClientNames(prev => ({ ...prev, [meeting.id]: e.target.value }))}
              />
              <button onClick={() => handleCreateClient(meeting.id)}>Create Client</button>
            </div>

            {/* Step 2: Assign or create opportunity */}
            {clientSelections[meeting.id] && (
              <div style={{ marginTop: '1rem' }}>
                {!newClientCreated[meeting.id] && (
                  <>
                    <label>Select Existing Opportunity:</label><br />
                    <select
                      onChange={e => handleAssignOpportunity(meeting.id, e.target.value)}
                      value={opportunitySelections[meeting.id] || ''}
                    >
                      <option value="">-- Select Opportunity --</option>
                      {(opportunities[clientSelections[meeting.id]] || []).map(opp => (
                        <option key={opp.id} value={opp.id}>{opp.name}</option>
                      ))}
                    </select>
                    <br /><br />
                  </>
                )}

                <label>Create a New Opportunity:</label><br />
                <input
                  type="text"
                  placeholder="Opportunity name"
                  value={newOpportunityNames[meeting.id] || ''}
                  onChange={e => setNewOpportunityNames(prev => ({ ...prev, [meeting.id]: e.target.value }))}
                />
                <button onClick={() => handleCreateOpportunity(meeting.id)}>Create Opportunity</button>
              </div>
            )}
          </div>
        ))
      )}
    </main>
  )
}

