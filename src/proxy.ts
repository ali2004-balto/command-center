// Request interception (Next.js 16 "proxy"): sign-in wall for everything except the public paths, plus TV pairing.
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { demoActor } from '@/lib/auth/session';
import { TV_COOKIE, pairTv } from '@/lib/auth/tv';

const PUBLIC = [/^\/signin$/, /^\/api\/auth(\/|$)/, /^\/api\/health$/, /^\/robots\.txt$/];

const handler = auth((req) => {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === '/tv') {
    const pairing = pairTv(searchParams, process.env.TV_KEY, process.env.AUTH_SECRET);
    if (!pairing) return NextResponse.next();
    const clean = req.nextUrl.clone();
    clean.search = '';
    const res = NextResponse.redirect(clean);
    if (pairing.cookieValue) {
      res.cookies.set(TV_COOKIE, pairing.cookieValue, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 400 * 24 * 3600, path: '/' });
    }
    return res;
  }

  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (demoActor()) return NextResponse.next();
  if (!req.auth?.user?.email) {
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

// With a lazy Auth.js config, auth(callback) returns a promise of the wrapped handler.
export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const wrapped = (await (handler as unknown as Promise<(r: NextRequest, e: NextFetchEvent) => Promise<Response>>));
  return wrapped(req, event);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
