import { useState } from 'react';
import { SessionContextProvider, createBrowserSupabaseClient } from '@supabase/auth-helpers-react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const [supabaseClient] = useState(() => createBrowserSupabaseClient());

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      <Component {...pageProps} />
    </SessionContextProvider>
  );
}
