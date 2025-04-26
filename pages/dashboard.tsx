'use client';

import Link from 'next/link';
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
  const [justCreatedClientFor, setJustCreatedClientFor] = useState<{ [key: string]: boolean }>({});

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
        transcript: `Hi, thanks for joining the call. So we’re looking to upgrade the Wi-Fi in our warehouse...`,
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

    const existingClient = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existingClient) {
      alert('A client with this name already exists. Please use a different name.');
      return;
    }

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
    setJustCreatedClientFor(prev => ({ ...prev, [meetingId]: true }));
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
    setJustCreatedClientFor(prev => ({ ...prev, [meetingId]: false }));
  };

  const handleCreateOpportunity = async (meetingId: string, clientId: string) => {
    const name = newOpportunityNames[meetingId]?.trim();
    if (!name) return;

    const existingOpp = opportunities.find(
      o => o.client_id === clientId && o.name.toLowerCase() === name.toLowerCase()
    );
    if (existingOpp) {
      alert('An opportunity with this name already exists for this client. Please choose another name.');
      return;
    }

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
    else setUnassignedMeetings(prev => prev.filter(m => m.id !== meetingId));
  };

  const handleAssignOpportunity = async (meetingId: string) => {
    const id = opportunitySelections[meetingId];
    if (!id) return alert('Please select an opportunity first');
    assignOpportunityToMeeting(meetingId, id);
  };

  const handleMicrosoftLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid email profile offline_access Calendars.Read OnlineMeetings.Read',
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  if (!session) return <p>Loading...</p>;

  return (
    <div style={{ display: 'flex' }}>
      {/* Left Menu */}
      <div style={{ width: '250px', padding: '20px', borderRight: '1px solid #ddd' }}>
        <h2>📁 Clients</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {clients.map(client => (
            <li key={client.id} style={{ marginBottom: '8px' }}>
              <Link href={`/client/${client.id}`}>
                <a style={{ color: '#0070f3', textDecoration: 'none' }}>{client.name}</a>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content */}
      <div style={{ flexGrow: 1, padding: '40px' }}>
        <h1>Welcome, {session.user.email}</h1>

        <button onClick={handleSummarize} style={{ margin: '20px', padding: '10px 20px' }}>
          Summarize Meeting
        </button>

        <button onClick={handleMicrosoftLogin} style={{ margin: '20px', padding: '10px 20px', backgroundColor: '#0078D4', color: 'white', borderRadius: '4px', border: 'none' }}>
          Sign in with Microsoft
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

        {unassignedMeetings.map(meeting => {
          const clientId = clientSelections[meeting.id];
          const client = clients.find(c => c.id === clientId);
          const clientOpportunities = opportunities.filter(o => o.client_id === clientId);

          return (
            <div key={meeting.id} style={{ border: '1px solid #ccc', padding: 20, margin: 20 }}>
              <p><strong>Summary:</strong> {meeting.summary}</p>

              <div style={{ marginTop: 20 }}>
                {/* Client and Opportunity assignment code here */}
                {/* (kept same for brevity) */}
              </div>
            </div>
          );
        })}

        <button onClick={handleLogout} style={{ marginTop: '40px', padding: '10px 20px' }}>
          Logout
        </button>
      </div>
    </div>
  );
}


