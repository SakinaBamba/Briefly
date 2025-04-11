import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Home() {
  const session = useSession();
  const supabase = useSupabaseClient(); // ✅ this is how you get the client
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session]);

  if (!session) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h1>Welcome to Briefly</h1>
        <button
          onClick={() => {
            supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo:
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/auth/callback`
                    : '',
              },
            });
          }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return <p>Redirecting...</p>;
}
