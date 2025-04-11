import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { GetServerSidePropsContext } from 'next';

export default function Callback() {
  redirect('/dashboard'); // redirect after login
  return null;
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const supabase = createServerComponentClient({
    cookies,
    headers: {
      cookie: ctx.req.headers.cookie || '',
    },
  });

  await supabase.auth.getUser(); // complete Supabase auth session

  return {
    props: {},
  };
}
