import { NextRequest, NextResponse } from 'next/server';
/** Preserve historic /exampro/demo links without embedding a duplicate HTML application. */
export function GET(request:NextRequest){return NextResponse.redirect(new URL('/india-mocks',request.url),308);}
