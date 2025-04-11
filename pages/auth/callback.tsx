import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function Callback() {
  redirect('/dashboard'); // Redirect after callback
}

export async function getServerSideProps({ req, res }) {
  const supabase = createServerComponentClient({ req, res, cookies });

  await supabase.auth.getUser(); // completes the session in Supabase

  return {
    props: {},
  };
}
