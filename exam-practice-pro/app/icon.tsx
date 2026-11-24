import { ImageResponse } from 'next/og';

export const size = 512;
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 96, background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#0d9488)', color: 'white', fontSize: 250, fontWeight: 800, letterSpacing: -8 }}>E</div>,
    { width: size, height: size },
  );
}
