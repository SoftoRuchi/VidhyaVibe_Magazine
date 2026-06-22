import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  if (pathname === '/admin/login' || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Do not gate /admin on refresh_token cookie alone. With Next.js API rewrites the
  // Set-Cookie from the backend may not reach the browser, while access_token in
  // localStorage is still valid. Client AdminLayout verifies the session instead.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/admin'],
};
