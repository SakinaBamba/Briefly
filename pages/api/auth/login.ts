import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    response_mode: 'query',
    scope: [
      'offline_access',
      'User.Read',
      'OnlineMeetings.Read.All',
      'CallRecords.Read.All'
    ].join(' '),
    state: 'secureRandomString' // Optional: CSRF protection
  })

  const authUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`
  res.redirect(authUrl)
}
