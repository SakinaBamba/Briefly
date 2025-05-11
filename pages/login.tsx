// File: pages/login.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function LoginPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let result
      if (mode === 'sign-in') {
        result = await supabase.auth.signInWithPassword({ email, password })
      } else {
        result = await supabase.auth.signUp({ email, password })
      }

      setLoading(false)

      if (result.error) {
        // Check for "user already registered" on sign-up
        if (mode === 'sign-up' && /already registered|already exists/i.test(result.error.message)) {
          alert('An account with that email already exists. Please sign in instead.')
          setMode('sign-in')
        } else {
          setError(result.error.message)
        }
      } else {
        // On successful sign-in or sign-up
        router.push('/dashboard')
      }
    } catch (err: any) {
      setLoading(false)
      setError(err.message ?? 'Unexpected error')
    }
  }

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {mode === 'sign-in' ? 'Sign In to Briefly' : 'Create a Briefly Account'}
      </h1>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading
            ? mode === 'sign-in'
              ? 'Signing in…'
              : 'Signing up…'
            : mode === 'sign-in'
            ? 'Sign In'
            : 'Sign Up'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        {mode === 'sign-in'
          ? "Don't have an account?"
          : 'Already have an account?'}{' '}
        <button
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError(null)
          }}
          className="text-blue-600 underline"
        >
          {mode === 'sign-in' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </main>
  )
}

