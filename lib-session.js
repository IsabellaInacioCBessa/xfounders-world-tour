// Shared session helpers (Web Crypto, works in middleware and functions).
const enc = new TextEncoder();
export const COOKIE = 'xft_session';
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
async function key(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function sign(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)));
  return body + '.' + b64url(sig);
}
export async function verify(token, secret) {
  if (!token || !secret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(secret), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!p.x || p.x < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}
export function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
