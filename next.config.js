/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep your env-vars
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Explicitly rewrite the slash variant to the no-slash route
  async rewrites() {
    return [
      {
        source: '/api/graph/notifications/',    // Graph is hitting this
        destination: '/api/graph/notifications' // Our real handler
      },
    ]
  },
}

module.exports = nextConfig
