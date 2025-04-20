'use client'

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';

export default function ClientView() {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const { id: clientId } = router.query;

  const [client, setClient] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);

  useEffect(() => {
    if (!session || !clientId) return;
    fetchClient();
    fetchOpportunities();
    fetchMeetings();
  }, [session, clientId]);

  const fetchClient = async () => {
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).single();
    setClient(data);
  };

  const fetchOpportunities = async () => {
    const { data } = await supabase.from('opportunities').select('*').eq('client_id', clientId);
    setOpportunities(data || []);
  };

  const fetchMeetings = async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at');
    setMeetings(data || []);
  };

  const meetingsByOpportunity = opportunities.map(op => ({
    ...op,
    meetings: meetings.filter(m => m.opportunity_id === op.id)
  }));

  if (!session) return <p>Loading session...</p>;
  if (!client) return <p>Loading client data...</p>;

  return (
    <div style={{ padding: 40 }}>
      <h1>Client: {client.name}</h1>

      {meetingsByOpportunity.map(op => (
        <div key={op.id} style={{ marginTop: 40 }}>
          <h2>Opportunity: {op.name}</h2>

          {op.meetings.length === 0 ? (
            <p>No meetings yet.</p>
          ) : (
            op.meetings.map(m => (
              <div key={m.id} style={{ border: '1px solid #ccc', padding: 15, marginBottom: 15 }}>
                <p><strong>Summary:</strong> {m.summary}</p>
                {m.proposal_items?.length > 0 && (
                  <>
                    <p><strong>Proposal Items:</strong></p>
                    <ul>
                      {m.proposal_items.map((item, idx) => (
                        <li key={idx}>{item.replace(/^\-\s*/, '')}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
