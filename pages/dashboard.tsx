'use client'

import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const session = useSession();
  const supabase = useSupabaseClient();
  const router = useRouter();

  const [summary, setSummary] = useState('');
  const [proposalItems, setProposalItems] = useState<string[]>([]);
  const [unassignedMeetings, setUnassignedMeetings] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [newClientNames, setNewClientNames] = useState<{ [key: string]: string }>({});
  const [clientSelections, setClientSelections] = useState<{ [key: string]: string }>({});
  const [newOpportunityNames, setNewOpportunityNames] = useState<{ [key: string]: string }>({});
  const [opportunitySelections, setOpportunitySelections] = useState<{ [key: string]: string }>({});
  const [showInputFor, setShowInputFor] = useState<{ [key: string]: boolean }>({});
  const [showDropdownFor, setShowDropdownFor] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!session) router.push('/');
    else {
      fetchUnassignedMeetings();
      fetchClients();
      fetchOpportunities();
    }
  }, [session]);

  const fetchUnassignedMeetings = async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', session?.user?.id)
      .is('client_id', null);

    if (!error && data) setUnassignedMeetings(data);
  };

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('*');
    if (!error && data) setClients(data);
  };

  const fetchOpportunities = async () => {
    const { data, error } = await supabase.from('opportunities').select('*');
    if (!error && data) setOpportunities(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleSummarize = async () => {
    const user_id = session?.user?.id;

    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: `Hi, thanks for joining the call. So we’re looking to upgrade the Wi-Fi in our warehouse. We need better coverage and more reliable APs. I think we’ll need about 6 access points total. Can you include licensing and installation in the quote?`,
        user_id
      })
    });

    const data = await res.json();
    if (data.summary) {
      setSummary(data.summary);
      setProposalItems(data.proposal_items || []);
      fetchUnassignedMeetings();
    } else {
      alert('Failed to summarize!');
    }
  };

  const handleCreateClient = async (meetingId: string) => {
    const name = newClientNames[meetingId]?.trim();
    if (!name) return;

    const { data, error } = await supabase
      .from('clients')
      .insert([{ name }])
      .select()
      .single();

    if (error || !data) {
      alert('Failed to create client');
      return;
    }

    setClients(prev => [...prev, data]);
    setClientSelections(prev => ({ ...prev, [meetingId]: data.id }));
    setShowInputFor(prev => ({ ...prev, [meetingId]: false }));
    await assignClientToMeeting(meetingId, data.id);
  };

  const assignClientToMeeting = async (meetingId: string, clientId: string) => {
    const { error } = await supabase
      .from('meetings')
      .update({ client_id: clientId })
      .eq('id', meetingId);

    if (error) alert('Failed to assign client');
  };

  const handleAssignExistingClient = async (meetingId: string) => {
    const clientId = clientSelections[meetingId];
    if (!clientId) return alert('Please select a client first');
    await assignClientToMeeting(meetingId, clientId);
  };

  const handleCreateOpportunity = async (meetingId: string, clientId: string) => {
    const name = newOpportunityNames[meetingId]?.trim();
    if (!name) return;

    const { data, error } = await supabase
      .from('opportunities')
      .insert([{ client_id: clientId, name }])
      .select()
      .single();

    if (error || !data) {
      alert('Failed to create opportunity');
      return;
    }

    setOpportunities(prev => [...prev, data]);
    setOpportunitySelections(prev => ({ ...prev, [meetingId]: data.id }));
    assignOpportunityToMeeting(meetingId, data.id);
  };

  const assignOpportunityToMeeting = async (meetingId: string, opportunityId: string) => {
    const { error } = await supabase
      .from('meetings')
      .update({ opportunity_id: opportunityId })
      .eq('id', meetingId);

    if (error) alert('Failed to assign opportunity');
  };

  const handleAssignOpportunity = async (meetingId: string) => {
    const id = opportunitySelections[meetingId];
    if (!id) return alert('Please select an opportunity first');
    assignOpportunityToMeeting(meetingId, id);
  };

  if (!session) return <p>Loading...</p>;

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Welcome, {session.user.email}</h1>
      <button onClick={handleSummarize} style={{ margin: '20px', padding: '10px 20px' }}>
        Summarize Meeting
      </button>

      {summary && (
        <div style={{ marginTop: '40px' }}>
          <h3>Latest Meeting Summary:</h3>
          <p>{summary}</p>
          {proposalItems.length > 0 && (
            <>
              <h4>Proposal Items:</h4>
              <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                {proposalItems.map((item, idx) => (
                  <li key={idx}>{item.replace(/^\-\s*/, '')}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <hr style={{ margin: '60px auto', width: '60%' }} />
      <h2>🗂 Unassigned Meetings</h2>

      {unassignedMeetings.length === 0 ? (
        <div style={{ border: '2px dashed #ccc', padding: 40, borderRadius: 10, marginTop: 30 }}>
          <p>You have no unassigned meetings.</p>
        </div>
      ) : (
        unassignedMeetings.map(meeting => {
          const clientId = clientSelections[meeting.id];
          const clientOpportunities = opportunities.filter(o => o.client_id === clientId);

          return (
            <div key={meeting.id} style={{ border: '1px solid #ccc', borderRadius: 10, padding: 20, margin: 20, width: '80%', marginLeft: 'auto', marginRight: 'auto' }}>
              <p><strong>Summary:</strong> {meeting.summary}</p>

              {meeting.proposal_items?.length > 0 && (
                <>
                  <p><strong>Proposal Items:</strong></p>
                  <ul>
                    {meeting.proposal_items.map((item, idx) => (
                      <li key={idx}>{item.replace(/^\-\s*/, '')}</li>
                    ))}
                  </ul>
                </>
              )}

              <div style={{ marginTop: 20 }}>
                <button
                  onClick={() => {
                    setShowInputFor(prev => ({ ...prev, [meeting.id]: true }));
                    setShowDropdownFor(prev => ({ ...prev, [meeting.id]: false }));
                  }}
                  style={{ marginRight: 10 }}
                >
                  Create New Client
                </button>

                <button
                  onClick={() => {
                    setShowDropdownFor(prev => ({ ...prev, [meeting.id]: true }));
                    setShowInputFor(prev => ({ ...prev, [meeting.id]: false }));
                  }}
                >
                  Assign to Existing Client
                </button>

                {showInputFor[meeting.id] && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      placeholder="Client name"
                      value={newClientNames[meeting.id] || ''}
                      onChange={e =>
                        setNewClientNames(prev => ({ ...prev, [meeting.id]: e.target.value }))
                      }
                      style={{ padding: '6px', marginRight: 10 }}
                    />
                    <button onClick={() => handleCreateClient(meeting.id)}>Create & Assign</button>
                  </div>
                )}

                {showDropdownFor[meeting.id] && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      list={`clients-${meeting.id}`}
                      placeholder="Search client..."
                      onChange={e => {
                        const selectedName = e.target.value;
                        const selectedClient = clients.find(c => c.name === selectedName);
                        if (selectedClient) {
                          setClientSelections(prev => ({ ...prev, [meeting.id]: selectedClient.id }));
                        }
                      }}
                      style={{ padding: '6px 10px', marginRight: 10 }}
                    />
                    <datalist id={`clients-${meeting.id}`}>
                      {clients.map(client => (
                        <option key={client.id} value={client.name} />
                      ))}
                    </datalist>
                    <button onClick={() => handleAssignExistingClient(meeting.id)}>Assign</button>
                  </div>
                )}

                {clientId && (
                  <div style={{ marginTop: 20 }}>
                    <p><strong>Assign Opportunity:</strong></p>
                    <select
                      value={opportunitySelections[meeting.id] || ''}
                      onChange={e =>
                        setOpportunitySelections(prev => ({ ...prev, [meeting.id]: e.target.value }))
                      }
                      style={{ padding: '6px', marginRight: 10 }}
                    >
                      <option value="">Select opportunity</option>
                      {clientOpportunities.map(op => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                    <button onClick={() => handleAssignOpportunity(meeting.id)}>Assign</button>

                    <div style={{ marginTop: 10 }}>
                      <input
                        type="text"
                        placeholder="New opportunity name"
                        value={newOpportunityNames[meeting.id] || ''}
                        onChange={e =>
                          setNewOpportunityNames(prev => ({ ...prev, [meeting.id]: e.target.value }))
                        }
                        style={{ padding: '6px', marginRight: 10 }}
                      />
                      <button onClick={() => handleCreateOpportunity(meeting.id, clientId)}>
                        Create & Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      <button onClick={handleLogout} style={{ marginTop: '40px', padding: '10px 20px' }}>
        Logout
      </button>
    </div>
  );
}

