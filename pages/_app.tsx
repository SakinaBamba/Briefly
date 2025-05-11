// pages/_app.tsx
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  const [supabaseClient] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  return <Component {...pageProps} />;
}
