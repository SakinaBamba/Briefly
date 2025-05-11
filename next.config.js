/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from issuing 307 redirects for trailing slashes
  trailingSlash: false,

  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  async rewrites() {
    return [
      {
        // Graph is calling the slash version, so catch it and rewrite
        source: '/api/graph/notifications/',
        destination: '/api/graph/notifications',
      },
    ]
  },
}

module.exports = nextConfig
