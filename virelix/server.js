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
const BASE = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const PIN = process.env.STAFF_PIN || '2112';
const DATA_DIR = process.env.DATA_DIR || __dirname; // point at a persistent disk in production
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'data.json');
const STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'DELIVERED'];

// ---- tiny JSON-file store: { day, counter, orders: { token: order } } ----
let db = { day: '', counter: 0, orders: {}, leads: [] };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) {}
db.leads = db.leads || [];
const save = () => fs.writeFile(DB_FILE, JSON.stringify(db), () => {});
const today = () => new Date().toISOString().slice(0, 10);

function pruneOld() {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const [t, o] of Object.entries(db.orders)) if (o.createdAt < cutoff) delete db.orders[t];
}

// ---- live updates (Server-Sent Events) ----
const watchers = new Map(); // token -> Set(res)
const staffWatchers = new Set();
const publicOrder = (o) => ({
  number: o.number, status: o.status, note: o.note, createdAt: o.createdAt, readyAt: o.readyAt || null,
  waiting: o.status === 'READY' ? 0 : Object.values(db.orders).filter(
    (x) => x.createdAt < o.createdAt && ['RECEIVED', 'PREPARING'].includes(x.status)).length,
});
function push(o) {
  for (const r of watchers.get(o.token) || []) r.write(`data: ${JSON.stringify(publicOrder(o))}\n\n`);
  for (const r of staffWatchers) r.write(`data: ping\n\n`);
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

const staffOnly = (req, res, next) =>
  (req.get('x-staff-pin') || req.query.pin) === PIN ? next() : res.status(401).json({ error: 'Wrong PIN' });

app.post('/api/staff/login', (req, res) =>
  req.body && req.body.pin === PIN ? res.json({ ok: true }) : res.status(401).json({ error: 'Wrong PIN' }));

// Cashier creates an order -> gets number + link/QR for the customer
app.post('/api/orders', staffOnly, (req, res) => {
  if (db.day !== today()) { db.day = today(); db.counter = 0; }
  pruneOld();
  const token = crypto.randomBytes(9).toString('base64url');
  const order = {
    token, number: ++db.counter, status: 'RECEIVED',
    note: String(req.body.note || '').slice(0, 60), createdAt: Date.now(),
  };
  db.orders[token] = order; save(); push(order);
  res.status(201).json({ ...order, url: `${BASE}/o.html?t=${token}` });
});

app.get('/api/orders', staffOnly, (req, res) => {
  res.json(Object.values(db.orders).filter((o) => o.status !== 'DELIVERED' || Date.now() - (o.deliveredAt || 0) < 600000)
    .sort((a, b) => a.createdAt - b.createdAt).map((o) => ({ ...o, url: `${BASE}/o.html?t=${o.token}` })));
});

app.post('/api/orders/:token/status', staffOnly, (req, res) => {
  const o = db.orders[req.params.token];
  const status = req.body && req.body.status;
  if (!o) return res.status(404).json({ error: 'Not found' });
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Bad status' });
  o.status = status;
  if (status === 'READY') o.readyAt = Date.now();
  if (status === 'DELIVERED') o.deliveredAt = Date.now();
  save(); push(o); res.json(o);
});

app.get('/api/staff/stream', staffOnly, (req, res) => { sse(res); staffWatchers.add(res); res.on('close', () => staffWatchers.delete(res)); });

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
app.listen(PORT, '0.0.0.0', () => console.log(`Virelix listening on ${BASE} (staff: /staff.html)`));
