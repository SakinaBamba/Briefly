// pages/auth/callback.tsx

import { GetServerSidePropsContext } from 'next';
import { createServerClient } from '@supabase/ssr';


export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const supabase = createServerSupabaseClient(ctx);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: '/',
      permanent: false,
    },
  };
}

export default function Callback() {
  return null;
}
