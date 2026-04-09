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

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'AUTH_SECRET not configured' },
      { status: 500 }
    );
  }

  const secretKey = new TextEncoder().encode(secret);

  // Determine provider from session — guest IDs start with "guest-"
  const isGuest = session.user.id?.startsWith('guest-');
  const provider = isGuest ? 'guest' : 'oauth';

  const token = await new SignJWT({
    sub: session.user.id,
    email: session.user.email || undefined,
    name: session.user.name || undefined,
    image: session.user.image || undefined,
    provider,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey);

  return NextResponse.json({ token });
}
