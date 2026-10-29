import { put } from '@vercel/blob';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { COOKIE, MAX_AGE, sign } from '../lib-session.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function record(entry) {
  try {
    const stamp = entry.at.replace(/[:.]/g, '-');
    await put(`visitors/${stamp}-${randomBytes(4).toString('hex')}.json`, JSON.stringify(entry), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false,
    });
  } catch (err) {
    console.error('visitor log failed', err?.message || err);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const password = String(b.password || '');
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!EMAIL.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

  const ok = !!process.env.ACCESS_PASSWORD && same(password, process.env.ACCESS_PASSWORD);
  const h = req.headers;
  await record({
    at: new Date().toISOString(), name, email, result: ok ? 'granted' : 'wrong password',
    country: h['x-vercel-ip-country'] || '', city: decodeURIComponent(h['x-vercel-ip-city'] || ''),
    agent: String(h['user-agent'] || '').slice(0, 300),
  });
  if (!ok) return res.status(401).json({ error: 'That password is not correct.' });

  const token = await sign({ n: name, e: email, x: Math.floor(Date.now() / 1000) + MAX_AGE }, process.env.SESSION_SECRET);
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
  return res.status(200).json({ ok: true });
}
