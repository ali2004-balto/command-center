// Auth.js setup: Google sign-in, JWT sessions of 12 hours. Config is built per request so no env is read at import.
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { authConfigFromEnv, authorizeGoogleProfile } from '@/lib/auth/authorize';

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // `hd` is only a hint for Google's account picker; it is checked again in authorizeGoogleProfile.
      authorization: { params: { hd: process.env.ALLOWED_DOMAIN, prompt: 'select_account' } },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/signin', error: '/signin' },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider === 'google' && authorizeGoogleProfile(profile as any, authConfigFromEnv());
    },
  },
}));
