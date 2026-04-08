import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub,
    Google,
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
});
