// pages/dashboard.tsx
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
  const [newClientName, setNewClientName] = useState('');
  const [clientSelections, setClientSelections] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!session) router.push('/');
    else {
      fetchUnassignedMeetings();
      fetchClients();
    }
  }, [session]);

  const fetchUnassignedMeetings = async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', session?.user?.id)
      .is('client_id', null);

    if (!error && data) {
      setUnassignedMeetings(data);
    }
  };

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('*');
    if (!error && data) setClients(data);
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
      fetchUnassignedMeetings(); // refresh after insert
    } else {
      alert('Failed to summarize!');
    }
  };

  const handleAssignClient = async (meetingId: string) => {
    const selectedClientId = clientSelections[meetingId];
    if (!selectedClientId) return alert('Please select or create a client first');

    const { error } = await supabase
      .from('meetings')
      .update({ client_id: selectedClientId })
      .eq('id', meetingId);

    if (error) {
      alert('Failed to assign client');
    } else {
      fetchUnassignedMeetings();
    }
  };

  const handleCreateClient = async (meetingId: string) => {
    if (!newClientName.trim()) return;

    const { data, error } = await supabase
      .from('clients')
      .insert([{ name: newClientName }])
      .select()
      .single();

    if (error || !data) {
      alert('Failed to create client');
      return;
    }

    setClients(prev => [...prev, data]);
    setClientSelections(prev => ({ ...prev, [meetingId]: data.id }));
    setNewClientName('');
  };

  if (!session) return <p>Loading...</p>;

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Welcome, {session.user.email}</h1>
      <p>This is your dashboard</p>

      <button onClick={handleSummarize} style={{ margin: '20px', padding: '10px 20px' }}>
        Summarize Meeting
      </button>

      {summary && (
        <div style={{ marginTop: '40px' }}>
          <h3>Latest Meeting Summary:</h3>
          <p>{summary}</p>

          {proposalItems.length > 0 && (
            <>
              <h4 style={{ marginTop: '20px' }}>Proposal Items:</h4>
              <ul style={{ listStyle: 'disc', textAlign: 'left', display: 'inline-block' }}>
                {proposalItems.map((item, idx) => (
                  <li key={idx}>{item.replace(/^-\s*/, '')}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <hr style={{ margin: '60px auto', width: '60%' }} />

      <h2>🗂 Unassigned Meetings</h2>

      {unassignedMeetings.map(meeting => (
        <div key={meeting.id} style={{ border: '1px solid #ccc', borderRadius: 10, padding: 20, margin: 20, width: '80%', marginLeft: 'auto', marginRight: 'auto' }}>
          <p><strong>Summary:</strong> {meeting.summary}</p>

          {meeting.proposal_items?.length > 0 && (
            <>
              <p><strong>Proposal Items:</strong></p>
              <ul>
                {meeting.proposal_items.map((item, idx) => (
                  <li key={idx}>{item.replace(/^-\s*/, '')}</li>
                ))}
              </ul>
            </>
          )}

          <div style={{ marginTop: 20 }}>
            <select
              value={clientSelections[meeting.id] || ''}
              onChange={e => setClientSelections(prev => ({ ...prev, [meeting.id]: e.target.value }))}
              style={{ padding: '6px 10px', marginRight: 10 }}
            >
              <option value="">Select Existing Client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="New client name"
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              style={{ padding: '6px', marginRight: 10 }}
            />

            <button onClick={() => handleCreateClient(meeting.id)}>Create ➕</button>
            <button onClick={() => handleAssignClient(meeting.id)} style={{ marginLeft: 10 }}>Assign Client</button>
          </div>
        </div>
      ))}

      <button onClick={handleLogout} style={{ marginTop: '40px', padding: '10px 20px' }}>
        Logout
      </button>
    </div>
  );
}
