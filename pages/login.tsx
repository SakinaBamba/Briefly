'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Login() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.replace('/')
    }
    checkUser()
  }, [router, supabase])

  const signIn = async () => {
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/`
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo: redirectUrl }
    })
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>Sign in</h1>
      <button
        onClick={signIn}
        style={{
          background: '#0078d4',
          color: '#fff',
          padding: '10px 16px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Sign in with Microsoft
      </button>
    </div>
  )
}
