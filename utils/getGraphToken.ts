// utils/getGraphToken.ts
export async function getGraphAccessToken(): Promise<string | null> {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const params = new URLSearchParams()
  params.append('client_id', clientId || '')
  params.append('client_secret', clientSecret || '')
  params.append('grant_type', 'client_credentials')
  params.append('scope', 'https://graph.microsoft.com/.default')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    const data = await res.json()
    return data.access_token
  } catch (err) {
    console.error('Failed to fetch Graph token', err)
    return null
  }
}
