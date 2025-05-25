'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Dashboard() {
  const [email, setEmail] = useState('')
  const supabase = createClientComponentClient()

  
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email || '')
    }
    getUser()
  }, [])

  return <h2>Welcome, {email}</h2>
}

