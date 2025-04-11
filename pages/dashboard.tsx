import { useSession } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Dashboard() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      router.push('/');
    }
  }, [session]);

  if (!session) return <p>Loading...</p>;

  return (
    <div>
      <h1>Welcome, {session.user.email}</h1>
      <p>This is your dashboard</p>
    </div>
  );
}
