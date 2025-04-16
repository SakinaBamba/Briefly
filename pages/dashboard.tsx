// pages/dashboard.tsx
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';


export default function Dashboard() {
  const session = useSession();
  const supabase = useSupabaseClient();
  const router = useRouter();

  const [summary, setSummary] = useState('');
  const [proposalItems, setProposalItems] = useState<string[]>([]);

  useEffect(() => {
    if (!session) {
      router.push('/');
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleSummarize = async () => {
    const user_id = session?.user?.id;

    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcript: `Hi, thanks for joining the call. So we’re looking to upgrade the Wi-Fi in our warehouse. We need better coverage and more reliable APs. I think we’ll need about 6 access points total. Can you include licensing and installation in the quote?`,
        user_id
      })
    });

    const data = await res.json();
    if (data.summary) {
      setSummary(data.summary);
      setProposalItems(data.proposal_items || []);
    } else {
      alert('Failed to summarize!');
    }
  };

  if (!session) return <p>Loading...</p>;

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>Welcome, {session.user.email}</h1>
      <p>This is your dashboard</p>

      <button
        onClick={handleSummarize}
        style={{ marginTop: '20px', padding: '10px 20px' }}
      >
        Summarize Meeting
      </button>

      {summary && (
        <div style={{ marginTop: '40px' }}>
          <h3>Meeting Summary:</h3>
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

      <button
        onClick={handleLogout}
        style={{ marginTop: '40px', padding: '10px 20px' }}
      >
        Logout
      </button>
    </div>
  );
}

