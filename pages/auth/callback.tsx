// pages/auth/callback.tsx
import { GetServerSidePropsContext } from 'next';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers'; // Not usable in GSSP, instead use below polyfill
import type { CookieOptionsWithName, CookieMethodsServer } from '@supabase/ssr';

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key: string) => ctx.req.cookies[key],
        set: (key, value, options) =>
          ctx.res.setHeader('Set-Cookie', `${key}=${value}; Path=${options.path ?? '/'}; HttpOnly`),
        remove: (key, options) =>
          ctx.res.setHeader('Set-Cookie', `${key}=; Path=${options.path ?? '/'}; Max-Age=0`),
      } satisfies CookieMethodsServer,
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: '/dashboard',
      permanent: false,
    },
  };
}

export default function AuthCallbackPage() {
  return null;
}

