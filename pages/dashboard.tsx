'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'



export default function Dashboard() {
  const supabase = createClientComponentClient()
  const [email, setEmail] = useState('')
  const [meetings, setMeetings] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [newClientNames, setNewClientNames] = useState<{ [key: string]: string }>({})
  const [selectedClientIds, setSelectedClientIds] = useState<{ [key: string]: string }>({})
  const [newOpportunities, setNewOpportunities] = useState<{ [key: string]: string }>({})
  const [selectedOpportunities, setSelectedOpportunities] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email || '')

      const { data: meetingsData } = await supabase
        .from('meetings')
        .select('*')
        .is('client_id', null)
      setMeetings(meetingsData || [])

      const { data: clientsData } = await supabase.from('clients').select('*')
      setClients(clientsData || [])

      const { data: oppsData } = await supabase.from('opportunities').select('*')
      setOpportunities(oppsData || [])
    }
    init()
  }, [])

  const createClient = async (meetingId: string) => {
    const name = newClientNames[meetingId]
    if (!name) return

    const existing = clients.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      alert('Client already exists.')
      return
    }

    const { data, error } = await supabase
      .from('clients')
      .insert([{ name }])
      .select()
    if (data) {
      setClients(prev => [...prev, ...data])
      setSelectedClientIds(prev => ({ ...prev, [meetingId]: data[0].id }))
      setNewClientNames(prev => ({ ...prev, [meetingId]: '' }))
    }
  }

  const createOpportunity = async (meetingId: string) => {
    const name = newOpportunities[meetingId]
    const clientId = selectedClientIds[meetingId]
    if (!name || !clientId) return

    const existing = opportunities.find(
      o => o.name.toLowerCase() === name.toLowerCase() && o.client_id === clientId
    )
    if (existing) {
      alert('Opportunity already exists for this client.')
      return
    }

    const { data, error } = await supabase
      .from('opportunities')
      .insert([{ name, client_id: clientId }])
      .select()
    if (data) {
      setOpportunities(prev => [...prev, ...data])
      setSelectedOpportunities(prev => ({ ...prev, [meetingId]: data[0].id }))
      setNewOpportunities(prev => ({ ...prev, [meetingId]: '' }))

      // update meeting with client + opportunity
      await supabase
        .from('meetings')
        .update({ client_id: clientId, opportunity_id: data[0].id })
        .eq('id', meetingId)

      // hide from dashboard
      setMeetings(prev => prev.filter(m => m.id !== meetingId))
    }
  }

  const assignExisting = async (meetingId: string) => {
    const clientId = selectedClientIds[meetingId]
    const opportunityId = selectedOpportunities[meetingId]
    if (!clientId || !opportunityId) return

    await supabase
      .from('meetings')
      .update({ client_id: clientId, opportunity_id: opportunityId })
      .eq('id', meetingId)

    setMeetings(prev => prev.filter(m => m.id !== meetingId))
  }

  return (
    <main>
      <h2>Welcome, {email}</h2>
      <h3>Unassigned Meetings</h3>
      {meetings.length === 0 ? (
        <p>You have no unassigned meetings.</p>
      ) : (
        meetings.map(meeting => (
          <div key={meeting.id} style={{ border: '1px solid #ccc', padding: 8, marginBottom: 12 }}>
            <h4>{meeting.title || 'Untitled Meeting'}</h4>

            <div>
              <label>Assign to Existing Client:</label>
              <select
                value={selectedClientIds[meeting.id] || ''}
                onChange={e =>
                  setSelectedClientIds(prev => ({ ...prev, [meeting.id]: e.target.value }))
                }
              >
                <option value="">-- Select Client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {selectedClientIds[meeting.id] && (
              <>
                <div>
                  <label>Assign to Existing Opportunity:</label>
                  <select
                    value={selectedOpportunities[meeting.id] || ''}
                    onChange={e =>
                      setSelectedOpportunities(prev => ({ ...prev, [meeting.id]: e.target.value }))
                    }
                  >
                    <option value="">-- Select Opportunity --</option>
                    {opportunities
                      .filter(o => o.client_id === selectedClientIds[meeting.id])
                      .map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                  </select>
                </div>

                <button onClick={() => assignExisting(meeting.id)}>Assign</button>
              </>
            )}

            <div style={{ marginTop: 10 }}>
              <label>Create New Client:</label>
              <input
                value={newClientNames[meeting.id] || ''}
                onChange={e =>
                  setNewClientNames(prev => ({ ...prev, [meeting.id]: e.target.value }))
                }
              />
              <button onClick={() => createClient(meeting.id)}>Create</button>
            </div>

            {selectedClientIds[meeting.id] && (
              <div>
                <label>Create New Opportunity:</label>
                <input
                  value={newOpportunities[meeting.id] || ''}
                  onChange={e =>
                    setNewOpportunities(prev => ({ ...prev, [meeting.id]: e.target.value }))
                  }
                />
                <button onClick={() => createOpportunity(meeting.id)}>Create & Assign</button>
              </div>
            )}
          </div>
        ))
      )}
    </main>
  )
}




