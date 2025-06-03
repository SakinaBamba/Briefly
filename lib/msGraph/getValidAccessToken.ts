import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getValidAccessToken(user_id: string) {
  const { data, error } = await supabase
    .from('ms_tokens')
    .select('ms_access_token, ms_refresh_token')
    .eq('user_id', user_id)
    .single()

  if (error || !data) throw new Error('Missing tokens')

  // (Optional: implement token expiration check here if you want)

  try {
    return data.ms_access_token
  } catch (err) {
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
        refresh_token: data.ms_refresh_token,
        grant_type: 'refresh_token',
        client_secret: process.env.AZURE_CLIENT_SECRET!
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    const { access_token, refresh_token } = tokenResp.data

    await supabase
      .from('ms_tokens')
      .update({ ms_access_token: access_token, ms_refresh_token: refresh_token })
      .eq('user_id', user_id)

    return access_token
  }
}
