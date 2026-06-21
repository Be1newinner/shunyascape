import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api')) {
    // In development mode, always route to local backend unless explicitly overridden.
    // In production, use the BACKEND_API_URL.
    const isDev = process.env.NODE_ENV === 'development';
    const backendUrl = isDev 
      ? 'http://localhost:8005' 
      : (process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:8005');
      
    const targetUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, backendUrl);
    return NextResponse.rewrite(targetUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
