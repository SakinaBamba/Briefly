import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { meetingId, callId } = req.body

    // TODO: Integrate with Microsoft Graph to start transcription

    // For now just return a stubbed success response
    return res.status(200).json({ success: true, meetingId, callId })
  } catch (err: any) {
    console.error('Start transcription error:', err)
    res.status(500).json({ error: 'Failed to start transcription', details: err.message })
  }
}
