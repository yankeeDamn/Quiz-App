import { ImageResponse } from 'next/og';

export const size = 180;
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 36, background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#0d9488)', color: 'white', fontSize: 100, fontWeight: 800 }}>E</div>,
    { width: size, height: size },
  );
}
