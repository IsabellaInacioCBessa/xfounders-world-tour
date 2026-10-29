import { list, get } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const csvCell = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';

async function readAll() {
  const rows = [];
  let cursor;
  do {
    const page = await list({ prefix: 'visitors/', cursor, limit: 1000 });
    for (const b of page.blobs) {
      const r = await get(b.pathname, { access: 'private' });
      if (r && r.statusCode === 200) {
        try { rows.push(JSON.parse(await new Response(r.stream).text())); } catch {}
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export default async function handler(req, res) {
  const key = String(req.query.key || '');
  if (!process.env.ADMIN_KEY || !same(key, process.env.ADMIN_KEY)) return res.status(404).send('Not found');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const rows = await readAll();

  if (req.query.format === 'csv') {
    const head = ['Date (UTC)', 'Name', 'Email', 'Result', 'Country', 'City', 'Device'];
    const lines = [head.map(csvCell).join(',')].concat(rows.map((r) => [r.at, r.name, r.email, r.result, r.country, r.city, r.agent].map(csvCell).join(',')));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="xfounders-visitors.csv"');
    return res.status(200).send('﻿' + lines.join('\r\n'));
  }

  const people = new Set(rows.filter((r) => r.result === 'granted').map((r) => r.email)).size;
  const body = rows.map((r) => `<tr><td>${esc(r.at.replace('T', ' ').slice(0, 16))}</td><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td class="${r.result === 'granted' ? 'ok' : 'no'}">${esc(r.result)}</td><td>${esc([r.city, r.country].filter(Boolean).join(', '))}</td></tr>`).join('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Visitors · XFounders World Tour</title>
<style>body{margin:0;background:#f6f2ea;color:#1f1712;font:15px/1.5 Arial,sans-serif}.w{max-width:1100px;margin:0 auto;padding:40px 16px}h1{font-size:24px;margin:0 0 6px}p{color:#6f6158;margin:0 0 24px}a{color:#87432d}
.t{overflow-x:auto;background:#fffdf9;border:1px solid #e4dccf;border-radius:12px}table{width:100%;border-collapse:collapse;min-width:640px}th,td{text-align:left;padding:11px 14px;border-bottom:1px solid #eee6da}th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6f6158}td.ok{color:#2d6a3e}td.no{color:#a3321f}</style></head>
<body><div class="w"><h1>Who has entered the World Tour page</h1><p>${people} ${people === 1 ? 'person' : 'people'} granted access · ${rows.length} sign-in ${rows.length === 1 ? 'attempt' : 'attempts'} in total · times in UTC · <a href="?key=${encodeURIComponent(key)}&format=csv">Download as CSV</a></p>
<div class="t"><table><thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Result</th><th>Location</th></tr></thead><tbody>${body || '<tr><td colspan="5">No sign-ins yet.</td></tr>'}</tbody></table></div></div></body></html>`);
}
