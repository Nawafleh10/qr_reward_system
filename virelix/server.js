const express = require('express');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// minimal .env loader (no extra dependency)
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch (_) {}

const PORT = process.env.PORT || 4100;
const ENV_BASE = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
// Public address put into QR codes. Uses PUBLIC_BASE_URL when set to a real address, otherwise the address the cashier opened the page on.
const baseFor = (req) => (ENV_BASE && !/localhost|127\.0\.0\.1/.test(ENV_BASE) ? ENV_BASE : `${req.protocol}://${req.get('host')}`);
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const PIN = process.env.STAFF_PIN || '2112';
if (IS_PROD && !process.env.STAFF_PIN) console.warn('WARNING: STAFF_PIN is not set - using the public default. Set it in the hosting dashboard!');
const DATA_DIR = process.env.DATA_DIR || __dirname; // point at a persistent disk in production
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'data.json');
const STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'DELIVERED'];

// ---- tiny JSON-file store: { day, counter, orders: { token: order } } ----
let db = { day: '', counter: 0, orders: {}, leads: [] };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) {}
db.leads = db.leads || [];
// demo orders live in memory only and are never written to disk
const save = () => fs.writeFile(DB_FILE, JSON.stringify({ ...db, orders: Object.fromEntries(Object.entries(db.orders).filter(([, o]) => !o.demo)) }), () => {});
const today = () => new Date().toISOString().slice(0, 10);

// ---- per-visitor demo sandboxes: private, in-memory, auto-expiring ----
const DEMO_TTL = 3 * 3600 * 1000, DEMO_MAX_SESSIONS = 300, DEMO_MAX_ORDERS = 30;
const demos = new Map(); // key -> { counter, createdAt }
const demoStarts = new Map(); // ip -> [timestamps]
function pruneDemos() {
  const cutoff = Date.now() - DEMO_TTL;
  for (const [k, d] of demos) if (d.createdAt < cutoff) demos.delete(k);
  for (const [t, o] of Object.entries(db.orders)) if (o.demo && !demos.has(o.demo)) delete db.orders[t];
}
setInterval(pruneDemos, 10 * 60 * 1000).unref();

function pruneOld() {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const [t, o] of Object.entries(db.orders)) if (!o.demo && o.createdAt < cutoff) delete db.orders[t];
}

// ---- live updates (Server-Sent Events) ----
const watchers = new Map(); // token -> Set(res)
const staffWatchers = new Map(); // res -> scope ('' for the real cashier, demo key for a sandbox)
const publicOrder = (o) => ({
  number: o.number, status: o.status, note: o.note, createdAt: o.createdAt, readyAt: o.readyAt || null,
  demo: !!o.demo,
  waiting: o.status === 'READY' ? 0 : Object.values(db.orders).filter(
    (x) => (x.demo || '') === (o.demo || '') && x.createdAt < o.createdAt && ['RECEIVED', 'PREPARING'].includes(x.status)).length,
});
function push(o) {
  for (const r of watchers.get(o.token) || []) r.write(`data: ${JSON.stringify(publicOrder(o))}\n\n`);
  for (const [r, scope] of staffWatchers) if (scope === (o.demo || '')) r.write(`data: ping\n\n`);
}
function sse(res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const hb = setInterval(() => res.write(': hb\n\n'), 25000);
  res.on('close', () => clearInterval(hb));
}

const app = express();
app.set('trust proxy', 1); // behind a hosting proxy: real client IP for rate limiting
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PIN check with brute-force lockout: 10 wrong attempts per IP -> locked for 15 minutes.
const pinFails = new Map(); // ip -> [timestamps]
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function checkPin(req, given) { // -> 'ok' | 'bad' | 'none' | 'locked'
  if (given === undefined || given === '') return 'none';
  const now = Date.now(), f = (pinFails.get(req.ip) || []).filter((t) => now - t < 15 * 60000);
  if (f.length >= 10) return 'locked';
  if (safeEq(given, PIN)) return 'ok';
  pinFails.set(req.ip, [...f, now]); return 'bad';
}
const pinReject = (res, r) => r === 'locked' ? res.status(429).json({ error: 'محاولات كثيرة، جرّب بعد 15 دقيقة' }) : res.status(401).json({ error: 'Wrong PIN' });
const staffOnly = (req, res, next) => {
  const r = checkPin(req, req.get('x-staff-pin') || req.query.pin);
  return r === 'ok' ? next() : pinReject(res, r);
};

// Orders API accepts the real PIN (scope '') or a demo key (scope = that key, sandboxed).
const staffOrDemo = (req, res, next) => {
  const dk = req.get('x-demo-key') || req.query.demo;
  if (dk) {
    if (!demos.has(dk)) return res.status(401).json({ error: 'انتهت جلسة التجربة، افتح التجربة من جديد' });
    req.scope = dk; return next();
  }
  const r = checkPin(req, req.get('x-staff-pin') || req.query.pin);
  if (r === 'ok') { req.scope = ''; return next(); }
  pinReject(res, r);
};

// Start a private demo cashier (no PIN). Rate limited per IP.
app.post('/api/demo/start', (req, res) => {
  const now = Date.now(), recent = (demoStarts.get(req.ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= 10) return res.status(429).json({ error: 'محاولات كثيرة، جرّب بعد قليل' });
  pruneDemos();
  if (demos.size >= DEMO_MAX_SESSIONS) {
    const oldest = [...demos.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    demos.delete(oldest[0]); pruneDemos();
  }
  demoStarts.set(req.ip, [...recent, now]);
  const key = crypto.randomBytes(12).toString('base64url');
  demos.set(key, { counter: 0, createdAt: now });
  res.status(201).json({ key, expiresInMinutes: DEMO_TTL / 60000 });
});

app.post('/api/staff/login', (req, res) => {
  const r = checkPin(req, req.body && req.body.pin);
  return r === 'ok' ? res.json({ ok: true }) : pinReject(res, r);
});

// Cashier creates an order -> gets number + link/QR for the customer
app.post('/api/orders', staffOrDemo, (req, res) => {
  let number;
  if (req.scope) {
    const d = demos.get(req.scope);
    if (Object.values(db.orders).filter((o) => o.demo === req.scope).length >= DEMO_MAX_ORDERS)
      return res.status(429).json({ error: 'وصلت الحد الأقصى لطلبات التجربة. تواصل معنا لتفعيل نسختك 🙂' });
    number = ++d.counter;
  } else {
    if (db.day !== today()) { db.day = today(); db.counter = 0; }
    pruneOld(); number = ++db.counter;
  }
  const token = crypto.randomBytes(9).toString('base64url');
  const order = {
    token, number, status: 'RECEIVED',
    note: String(req.body.note || '').slice(0, 60), createdAt: Date.now(),
    ...(req.scope ? { demo: req.scope } : {}),
  };
  db.orders[token] = order; save(); push(order);
  res.status(201).json({ ...order, url: `${baseFor(req)}/o.html?t=${token}` });
});

app.get('/api/orders', staffOrDemo, (req, res) => {
  res.json(Object.values(db.orders).filter((o) => (o.demo || '') === req.scope).filter((o) => o.status !== 'DELIVERED' || Date.now() - (o.deliveredAt || 0) < 600000)
    .sort((a, b) => a.createdAt - b.createdAt).map((o) => ({ ...o, url: `${baseFor(req)}/o.html?t=${o.token}` })));
});

app.post('/api/orders/:token/status', staffOrDemo, (req, res) => {
  const o = db.orders[req.params.token];
  const status = req.body && req.body.status;
  if (!o || (o.demo || '') !== req.scope) return res.status(404).json({ error: 'Not found' });
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Bad status' });
  o.status = status;
  if (status === 'READY') o.readyAt = Date.now();
  if (status === 'DELIVERED') o.deliveredAt = Date.now();
  save(); push(o); res.json(o);
});

app.get('/api/staff/stream', staffOrDemo, (req, res) => { sse(res); staffWatchers.set(res, req.scope); res.on('close', () => staffWatchers.delete(res)); });

// Customer endpoints (token is the only credential)
app.get('/api/orders/:token', (req, res) => {
  const o = db.orders[req.params.token];
  o ? res.json(publicOrder(o)) : res.status(404).json({ error: 'الطلب غير موجود أو انتهت صلاحيته' });
});
app.get('/api/orders/:token/stream', (req, res) => {
  const o = db.orders[req.params.token];
  if (!o) return res.status(404).end();
  sse(res);
  if (!watchers.has(o.token)) watchers.set(o.token, new Set());
  watchers.get(o.token).add(res);
  res.write(`data: ${JSON.stringify(publicOrder(o))}\n\n`);
  res.on('close', () => watchers.get(o.token)?.delete(res));
});

// Contact form (public). Saved on the server; staff read them via /api/leads.
const hits = new Map(); // ip -> [timestamps] (max 5 per hour)
app.post('/api/contact', (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill this hidden field
  const ip = req.ip, now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= 5) return res.status(429).json({ error: 'محاولات كثيرة، جرّب بعد قليل' });
  const clean = (v, n) => String(v || '').trim().slice(0, n);
  const lead = { id: crypto.randomBytes(5).toString('hex'), at: now, topic: clean(b.topic, 40), name: clean(b.name, 80),
    contact: clean(b.contact, 120), company: clean(b.company, 80), message: clean(b.message, 2000) };
  if (!lead.name || !lead.contact || !/(@.+\..+)|(\+?[\d\s-]{7,})/.test(lead.contact))
    return res.status(400).json({ error: 'اكتب اسمك وبريدك الإلكتروني أو رقم جوالك بشكل صحيح' });
  hits.set(ip, [...recent, now]);
  db.leads.push(lead); save();
  console.log(`New contact lead: ${lead.name} <${lead.contact}> [${lead.topic}]`);
  res.status(201).json({ ok: true });
});
app.get('/api/leads', staffOnly, (req, res) => res.json([...db.leads].reverse()));

app.get('/api/qr', async (req, res) => {
  try {
    res.type('png').send(await QRCode.toBuffer(String(req.query.data || ''), { margin: 1, width: 360 }));
  } catch (e) { res.status(400).end(); }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, '0.0.0.0', () => console.log(`Virelix listening on port ${PORT} (public base: ${ENV_BASE || 'auto'}, staff: /staff.html)`));
