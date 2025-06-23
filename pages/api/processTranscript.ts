import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { meeting_id } = req.body;

  if (!meeting_id) {
    return res.status(400).json({ error: 'Missing meeting_id' });
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_id }),
    });

    if (!response.ok) {
      const errorDetails = await response.json();
      return res.status(500).json({ error: 'Summarization failed', details: errorDetails });
    }

    return res.status(200).json({ result: 'Summary triggered successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}


