// File: pages/_app.tsx
'use client'

import { useState } from 'react'
import { SessionContextProvider, createBrowserSupabaseClient } from '@supabase/auth-helpers-react'
import type { AppProps } from 'next/app'

export default function MyApp({ Component, pageProps }: AppProps) {
  // Initialize the Supabase browser client once
  const [supabase] = useState(() => createBrowserSupabaseClient())

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <Component {...pageProps} />
    </SessionContextProvider>
  )
}
