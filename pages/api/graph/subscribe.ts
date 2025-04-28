// File: pages/api/graph/subscribe.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken } from '../../../utils/auth';

const SUB_RESOURCE = '/communications/onlineMeetings/getAllTranscripts';
const NOTIF_URL   = 'https://briefly-theta.vercel.app/api/graph/notifications';
const CLIENT_STATE = 'secretClientValue12345';

// helper to set expiration one hour ahead
function oneHourFromNow() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = await getAccessToken();
  const expirationDateTime = oneHourFromNow();

  // Graph endpoint
  const SUB_URL = 'https://graph.microsoft.com/beta/subscriptions';

  // 1) Attempt to CREATE
  let graphRes = await fetch(SUB_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      changeType: 'created',
      notificationUrl: NOTIF_URL,
      resource: SUB_RESOURCE,
      expirationDateTime,
      clientState: CLIENT_STATE
    })
  });
  let data = await graphRes.json();

  // 2) If we hit the “limit of 1” error, SWITCH to PATCH of the existing sub
  if (!graphRes.ok && data?.details?.error?.code === 'ExtensionError' &&
      data.details.error.message.includes('reached its limit')) {
    console.log('Subscription already exists—updating expiration instead');

    // a) List existing subscriptions in this tenant
    const listRes = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const list = await listRes.json();
    const existing = (list.value || []).find((s: any) =>
      s.resource === SUB_RESOURCE && s.clientState === CLIENT_STATE
    );

    if (!existing) {
      return res.status(500).json({ error: 'Existing subscription not found to update.' });
    }

    // b) PATCH the expirationDateTime forward
    const patchRes = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${existing.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expirationDateTime })
    });
    const patched = await patchRes.json();
    if (!patchRes.ok) {
      console.error('Failed to update subscription:', patched);
      return res.status(patchRes.status).json({ error: 'Failed to renew subscription', details: patched });
    }

    return res.status(200).json(patched);
  }

  // 3) If CREATE succeeded, or failed for another reason, just return
  if (!graphRes.ok) {
    console.error('Graph subscribe error:', data);
    return res.status(graphRes.status).json({ error: 'Graph subscription failed', details: data });
  }

  // 4) Success on creation
  return res.status(201).json(data);
}

