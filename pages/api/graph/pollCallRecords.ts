// pages/api/graph/pollCallRecords.ts

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const accessToken = process.env.GRAPH_API_ACCESS_TOKEN
  if (!accessToken) {
    return res.status(500).json({ error: 'Missing GRAPH_API_ACCESS_TOKEN in env' })
  }

  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: 'Failed to fetch meetings', details: text })
    }

    const data = await response.json()
    return res.status(200).json({ meetings: data.value })
  } catch (error) {
    console.error('Polling failed:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


