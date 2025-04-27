// File: /pages/api/createClient.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId, clientName } = req.body;

    if (!organizationId || !clientName) {
      return res.status(400).json({ error: 'Missing organizationId or clientName' });
    }

    const { data, error } = await supabase
      .from('clients')
      .insert([
        {
          organization_id: organizationId,
          client_name: clientName
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to create client', details: error });
    }

    res.status(200).json({ client: data });
  } catch (err) {
    console.error('API handler error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
