import { auth } from '@/lib/auth';
import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/backend-token
 *
 * Mints a short-lived JWT (signed with AUTH_SECRET) that the frontend
 * can pass to the Express backend as a Bearer token.
 *
 * The backend verifies this token using the same AUTH_SECRET and
 * extracts { sub, email, name, image, provider }.
 */
export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const verified = session as typeof session & { provider?: string; emailVerified?: boolean };
  if (!['github', 'google'].includes(verified.provider || '') || verified.emailVerified !== true || !session.user.email) {
    return NextResponse.json({error:'Verified Google or GitHub sign-in required.'}, {status:403});
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'AUTH_SECRET not configured' },
      { status: 500 }
    );
  }

  const secretKey = new TextEncoder().encode(secret);

  const provider = verified.provider;

  const token = await new SignJWT({
    sub: session.user.id,
    email: session.user.email || undefined,
    name: session.user.name || undefined,
    image: session.user.image || undefined,
    provider,
    emailVerified: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey);

  return NextResponse.json({ token });
}
