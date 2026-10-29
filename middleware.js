import { next } from '@vercel/functions';
import { COOKIE, verify, readCookie } from './lib-session.js';

export const config = { matcher: ['/', '/index.html', '/tour', '/tour/:path*'] };

export default async function middleware(request) {
  const url = new URL(request.url);
  const session = await verify(readCookie(request.headers.get('cookie'), COOKIE), process.env.SESSION_SECRET);
  const isTour = url.pathname === '/tour' || url.pathname.startsWith('/tour/');
  if (isTour && !session) return Response.redirect(new URL('/', url), 302);
  if (!isTour && session) return Response.redirect(new URL('/tour/', url), 302);
  return next({ headers: { 'cache-control': 'private, no-store' } });
}
