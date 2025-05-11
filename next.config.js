// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from issuing 307 redirects
  // for missing or extra trailing slashes in API routes
  trailingSlash: false,

  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
}

module.exports = nextConfig
