// Sign-in page: Google only. Refused accounts are told so, with no detail.
import Link from 'next/link';
import { signIn } from '@/auth';
import { demoActor } from '@/lib/auth/session';
import s from '@/components/Home.module.css';

export const dynamic = 'force-dynamic';

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const demo = demoActor();
  return (
    <main className={s.wrap}>
      <h1>Sign in</h1>
      {error && <p className={s.err}>That account is not allowed to sign in.</p>}
      {demo ? (
        <p>Demo mode (development only): you are already the demo owner. <Link href="/">Go to Home</Link></p>
      ) : (
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}
        >
          <button className={s.btn} type="submit">Sign in with Google</button>
        </form>
      )}
    </main>
  );
}
