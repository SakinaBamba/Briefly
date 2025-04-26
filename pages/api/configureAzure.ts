import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // SERVICE KEY (important, NOT anon key!)
  );

  const { data, error } = await supabase.auth.admin.updateProvider('azure', {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    tenantId: process.env.AZURE_TENANT_ID!,
  });

  if (error) {
    console.error('Error updating Azure provider:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, data });
}
