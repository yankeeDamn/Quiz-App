import { NextResponse } from 'next/server';

// This is a demo bridge. The HTML remains the source of truth in /exampro/index.html.
// Pin to the merged source commit to avoid unexpected upstream content changes.
const SOURCE = 'https://raw.githubusercontent.com/yankeeDamn/Quiz-App/e0932a42612f89d35267fed4305bbc9e5a93c609/exampro/index.html';

export async function GET() {
  try {
    const upstream = await fetch(SOURCE, { next: { revalidate: 3600 } });
    if (!upstream.ok) throw new Error('Unable to load ExamPro demo');
    return new NextResponse(await upstream.text(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch {
    return new NextResponse('ExamPro demo temporarily unavailable', { status: 503 });
  }
}
