// File: /pages/api/getClients.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId } = req.query;

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid organizationId' });
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id, client_name')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: 'Failed to fetch clients' });
    }

    res.status(200).json({ clients: data });
  } catch (err) {
    console.error('API handler error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

