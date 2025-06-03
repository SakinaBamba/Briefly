import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code as string

  const tokenResp = await axios.post(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      scope: [
        'offline_access',
        'User.Read',
        'OnlineMeetings.Read.All',
        'CallRecords.Read.All'
      ].join(' '),
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      grant_type: 'authorization_code',
      client_secret: process.env.AZURE_CLIENT_SECRET!
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )

  const { access_token, refresh_token, id_token } = tokenResp.data

  // Parse user_id from id_token
  const jwt = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString())
  const oid = jwt.oid

  // Store into ms_tokens table
  await supabase
    .from('ms_tokens')
    .upsert({
      user_id: oid,
      ms_access_token: access_token,
      ms_refresh_token: refresh_token
    })

  res.redirect('/dashboard') // ✅ This can redirect to your existing dashboard logic
}
