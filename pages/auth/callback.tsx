import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { GetServerSidePropsContext } from 'next';
import { redirect } from 'next/navigation';

export default function Callback() {
  redirect('/dashboard'); // fallback redirect (if needed)
  return null;
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const supabase = createPagesServerClient(ctx);

  await supabase.auth.getUser(); // Finalizes session

  return {
    props: {},
  };
}
