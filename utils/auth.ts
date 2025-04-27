// File: utils/auth.ts

export async function getAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', clientId!);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', clientSecret!);
  params.append('grant_type', 'client_credentials');

  const response = await fetch(url, {
    method: 'POST',
    body: params
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Failed to get access token:', data);
    throw new Error('Failed to fetch access token');
  }

  return data.access_token;
}
