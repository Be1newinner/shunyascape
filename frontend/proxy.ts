import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api')) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8005';
    const targetUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, backendUrl);
    return NextResponse.rewrite(targetUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
