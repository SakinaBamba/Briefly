'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';

export default function Dashboard() {
  const session = useSession();
  const supabase = useSupabaseClient();
  const router = useRouter();

  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!session) {
      router.push('/');
    } else {
      setEmail(session.user.email || '');
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!session) return <p>Loading...</p>;

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Briefly Dashboard</h1>
      <h2>Welcome, {email}</h2>

      <p style={{ marginTop: '20px' }}>
        🚀 Your meetings and proposals will appear here soon!
      </p>

      <button
        onClick={handleLogout}
        style={{
          marginTop: '40px',
          padding: '10px 20px',
          backgroundColor: '#ff4d4d',
          color: 'white',
          border: 'none',
          borderRadius: '5px'
        }}
      >
        Logout
      </button>
    </div>
  );
}



