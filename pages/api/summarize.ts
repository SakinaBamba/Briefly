export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, user_id } = req.body;

  const response = await fetch('https://rpcypbgyhlidifpqckgl.functions.supabase.co/summarizeMeeting', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ transcript, user_id })
  });

  const data = await response.json();
  res.status(response.status).json(data);
}
