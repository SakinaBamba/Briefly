import { GetServerSidePropsContext } from 'next';
import { createServerClient } from '@supabase/ssr';


export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return ctx.req.cookies[name];
        },
        set(name: string, value: string, options: any) {
          const cookie = `${name}=${value}; Path=${options.path ?? '/'}; HttpOnly`;
          ctx.res.setHeader('Set-Cookie', cookie);
        },
        remove(name: string, options: any) {
          const cookie = `${name}=; Path=${options.path ?? '/'}; Max-Age=0`;
          ctx.res.setHeader('Set-Cookie', cookie);
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { redirect: { destination: '/', permanent: false } };
  }

  return { redirect: { destination: '/dashboard', permanent: false } };
}

export default function Callback() {
  return null;
}

