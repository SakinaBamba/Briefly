import { handleCallback } from '@supabase/auth-helpers-nextjs';

export const getServerSideProps = async (ctx) => {
  await handleCallback({ req: ctx.req, res: ctx.res });
  return { props: {} };
};

export default function Callback() {
  return <p>Signing you in...</p>;
}
