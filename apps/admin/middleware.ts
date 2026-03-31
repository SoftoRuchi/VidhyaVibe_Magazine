import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect admin routes under /admin
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Allow login page and static assets
  if (pathname === '/admin/login' || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // In production, attempting to validate the session via fetch() from middleware can be
  // unreliable (Edge runtime restrictions can prevent forwarding cookies).
  // Instead, gate access on the presence of the refresh cookie and let the client-side
  // layout verify admin role via /api/auth/me.
  const hasRefreshCookie = !!req.cookies.get('refresh_token')?.value;
  if (hasRefreshCookie) {
    return NextResponse.next();
  }

  const loginPath = process.env.ADMIN_LOGIN_PATH || '/admin/login';
  const loginUrl = new URL(loginPath, req.nextUrl.origin);
  // attach returnUrl so client can redirect back after login
  loginUrl.searchParams.set('returnUrl', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/admin'],
};
