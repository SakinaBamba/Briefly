supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : ''
  },
});
