'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Home() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        setLoading(false)
      }
    }
    getSession()
  }, [])

  const handleSignIn = async () => {
    console.log("Sign in clicked ✅")
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/`  // <-- 👈 change applied here
      }
    })
  }

  if (loading) {
    return <p>Loading...</p>
  }

  return (
    <main>
      <h1>Briefly</h1>
      <button onClick={handleSignIn}>Sign in with Microsoft</button>
    </main>
  )
}
