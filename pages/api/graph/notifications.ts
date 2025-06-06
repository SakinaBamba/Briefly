import type { NextApiRequest, NextApiResponse } from 'next'


// Microsoft Graph webhook handler. Graph may call this endpoint with a
// `validationToken` query parameter for subscription validation. For normal
// POST notifications we simply acknowledge receipt.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET' && typeof req.query.validationToken === 'string') {
    // Echo back the validation token for webhook validation
    return res.status(200).send(req.query.validationToken)
  }

  if (req.method === 'POST') {
    // Log the notification body for now. In a real implementation this would
    // process the change notifications from Graph.
    console.log('Graph notification received', req.body)
    return res.status(202).end()
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end('Method Not Allowed')
}
