import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET(request: Request) {
  const size = new URL(request.url).searchParams.get('size') === '192' ? 192 : 512;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: size > 200 ? 96 : 36, background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#0d9488)', color: 'white', fontSize: size * 0.48, fontWeight: 800, letterSpacing: -8 }}>
      E
    </div>,
    { width: size, height: size },
  );
}
