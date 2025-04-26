// pages/index.tsx
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Home() {
  const session = useSession();
  const supabase = useSupabaseClient();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session]);

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
  };

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) setError(error.message);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>Welcome to Briefly</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: 'block', margin: '10px auto', padding: '10px' }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', margin: '10px auto', padding: '10px' }}
      />
      <button onClick={handleSignIn} style={{ marginRight: '10px' }}>
        Sign In
      </button>
      <button onClick={handleSignUp}>Sign Up</button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

