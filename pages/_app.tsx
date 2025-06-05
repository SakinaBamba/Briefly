import type { AppProps } from 'next/app'
import { useState } from 'react'
import { createBrowserClient, SessionContextProvider } from '@supabase/ssr'
import '../styles/globals.css'

export default function MyApp({ Component, pageProps }: AppProps) {
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <Component {...pageProps} />
    </SessionContextProvider>
  )
}
