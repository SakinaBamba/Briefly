'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
    };
    getSession();
  }, []);

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  };

  const handleMicrosoftSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid email profile offline_access Calendars.Read OnlineMeetings.Read',
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Welcome to Briefly</h1>

      <div style={{ marginTop: '30px' }}>
        <button
          onClick={handleGoogleSignIn}
          style={{ padding: '10px 20px', marginRight: '20px' }}
        >
          Sign in with Google
        </button>

        <button
          onClick={handleMicrosoftSignIn}
          style={{ padding: '10px 20px', backgroundColor: '#0078D4', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Sign in with Microsoft
        </button>
      </div>
    </main>
  );
}

