'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
    };
    getSession();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
    }
    router.push('/dashboard');
  };

  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Welcome to Briefly</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: '30px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: '10px', marginBottom: '10px', width: '250px' }}
          required
        />
        <br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: '10px', marginBottom: '20px', width: '250px' }}
          required
        />
        <br />
        <button
          type="submit"
          style={{ padding: '10px 20px', marginBottom: '10px' }}
        >
          {mode === 'sign-in' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        style={{ marginTop: '10px' }}
      >
        {mode === 'sign-in' ? 'No account? Sign Up' : 'Already have an account? Sign In'}
      </button>
    </main>
  );
}

