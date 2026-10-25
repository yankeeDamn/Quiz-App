import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET ? [GitHub({ authorization: { params: { scope: 'read:user user:email' } } })] : []),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
    Credentials({
      id: 'guest',
      name: 'Guest',
      credentials: {
        name: { label: 'Display Name', type: 'text', placeholder: 'Guest User' },
      },
      async authorize(credentials) {
        const name = (credentials?.name as string) || 'Guest User';
        // Generate a deterministic ID from the name for consistent localStorage scoping
        const id = `guest-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        return {
          id,
          name,
          email: null,
          image: null,
        };
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      try { const destination = new URL(url, baseUrl); return destination.origin === new URL(baseUrl).origin ? destination.href : baseUrl; }
      catch { return baseUrl; }
    },
    async jwt({ token, user, account, profile }) {
      if (user) token.id = user.id;
      if (account) {
        token.provider = account.provider;
        token.emailVerified = false;
        if (account.provider === 'google') {
          token.emailVerified = profile?.email_verified === true;
        } else if (account.provider === 'github' && account.access_token && user.email) {
          try {
            const response = await fetch('https://api.github.com/user/emails', {
              headers: { Authorization: `Bearer ${account.access_token}`, Accept: 'application/vnd.github+json' },
              cache: 'no-store',
            });
            if (response.ok) {
              const emails = await response.json() as Array<{ email: string; verified: boolean }>;
              token.emailVerified = emails.some((entry) => entry.verified && entry.email.toLowerCase() === user.email?.toLowerCase());
            }
          } catch { /* fail closed if GitHub email verification is unavailable */ }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      (session as typeof session & { provider?: string; emailVerified?: boolean }).provider = String(token.provider || '');
      (session as typeof session & { provider?: string; emailVerified?: boolean }).emailVerified = token.emailVerified === true;
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: Boolean(process.env.VERCEL || process.env.AUTH_TRUST_HOST),
});
