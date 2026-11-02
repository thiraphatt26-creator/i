/* =====================================================================
   Injanda Trading — storefront
   All shop data (products, orders, customers, banners, vouchers, settings)
   lives in Supabase, so every device sees the same data in real time.
   Set it up once with supabase-setup.sql.  Admin panel: see admin.js.
   ===================================================================== */

/* ---------- Helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = n => '฿' + Math.round(+n || 0).toLocaleString('en-US');
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || '';

/* ---------- Database (in-memory mirror of Supabase) ---------- */
let DB = { products: [], orders: [], users: [], settings: { ...DEFAULT_SETTINGS }, banners: [], vouchers: [], meta: {} };
const SNAP = { products: {}, orders: {}, users: {}, settings: {} };      // last JSON we know to be in Supabase
const cfg = () => DB.settings;
const find = id => DB.products.find(p => String(p.id) === String(id));
const visible = () => DB.products.filter(p => !p.hidden);
const priced = p => +p.price > 0;
const tracked = p => p.kind === 'part' && p.stock !== null && p.stock !== undefined && p.stock !== '';
const avail = p => !tracked(p) || p.stock > 0;
const isAdmin = () => me()?.role === 'admin';
/* Change a product's stock and keep a short history (last 30 movements) */
function stockMove(p, d, note, by) {
  p.stock = Math.max(0, (+p.stock || 0) + d);
  (p.log = p.log || []).unshift({ t: Date.now(), d, n: note || '', by: by || '', to: p.stock }); p.log.length = Math.min(p.log.length, 30);
}
const validOrder = o => o && Array.isArray(o.items) && o.customer;

const rowsOf = () => ({
  products: DB.products.map(x => [String(x.id), x]),
  orders: DB.orders.map(x => [x.ref, x]),
  users: DB.users.map(x => [x.id, x]),
  settings: [['store', DB.settings], ['banners', { list: DB.banners }], ['vouchers', { list: DB.vouchers }], ['meta', DB.meta]],
});
let pushQ = Promise.resolve();
function persist() { pushQ = pushQ.then(doPush).catch(e => { console.error(e); toast('Could not save: ' + (e.message || e)); }); return true; }
async function doPush() {
  const cur = rowsOf();
  for (const t in cur) {
    const map = new Map(cur[t]), up = [], del = [];
    for (const [id, d] of map) { const j = JSON.stringify(d); if (SNAP[t][id] !== j) up.push({ id, data: d, updated_at: new Date().toISOString(), j }); }
    for (const id in SNAP[t]) if (!map.has(id)) del.push(id);
    if (up.length) { const { error } = await supabase.from(t).upsert(up.map(({ j, ...r }) => r)); if (error) throw error; up.forEach(r => SNAP[t][r.id] = r.j); }
    if (del.length) { const { error } = await supabase.from(t).delete().in('id', del); if (error) throw error; del.forEach(id => delete SNAP[t][id]); }
  }
}
function put(t, id, d) {
  if (t === 'settings') {
    if (id === 'store') DB.settings = { ...DEFAULT_SETTINGS, ...d }; else if (id === 'banners') DB.banners = d.list || []; else if (id === 'vouchers') DB.vouchers = d.list || []; else if (id === 'meta') DB.meta = d;
    const r = rowsOf().settings.find(x => x[0] === id); if (r) SNAP.settings[id] = JSON.stringify(r[1]); return;      // keep snapshot in sync so visitors never rewrite settings
  }
  const key = t === 'orders' ? 'ref' : 'id', arr = DB[t], i = arr.findIndex(x => String(x[key]) === id);
  if (i < 0) arr.unshift(d); else arr[i] = d;
}
function drop(t, id) { if (t !== 'settings') { const key = t === 'orders' ? 'ref' : 'id'; DB[t] = DB[t].filter(x => String(x[key]) !== id); } }
function ingest(t, rows) {
  rows.forEach(r => {
    if (t === 'products' && r.data.v !== 2) return;
    if (t === 'orders' && !validOrder(r.data)) return;
    SNAP[t][r.id] = JSON.stringify(r.data); put(t, r.id, r.data);
  });
}
function remote(t, p) {
  const id = p.new?.id || p.old?.id; if (!id) return;
  if (p.eventType === 'DELETE') { delete SNAP[t][id]; drop(t, id); }
  else {
    const d = p.new.data;
    if (t === 'products' && d.v !== 2) return;
    if (t === 'orders' && (!validOrder(d) || (!isAdmin() && d.uid !== me()?.id))) return;
    const j = JSON.stringify(d); if (SNAP[t][id] === j) return;
    SNAP[t][id] = j; put(t, id, d);
  }
  clearTimeout(remote.t); remote.t = setTimeout(onRemote, 150);
}
function onRemote() {
  renderChrome();
  if (!$('#admin').hidden) { if (!$('#adlg').classList.contains('on') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) adShow(AD.sec); }
  else if (!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) route(true);
  updateBadges(); renderCart();
}
const channels = {};
function listen(t) { if (!channels[t]) channels[t] = supabase.channel('rt-' + t).on('postgres_changes', { event: '*', schema: 'public', table: t }, p => remote(t, p)).subscribe(); }

/* ---------- Loading & first-run seed ---------- */
async function loadPublic() {
  const [p, s] = await Promise.all([supabase.from('products').select('id,data'), supabase.from('settings').select('id,data')]);
  if (p.error || s.error) throw (p.error || s.error);
  ingest('products', p.data); ingest('settings', s.data);
  listen('products'); listen('settings');
}
async function ensureSeed() {
  if (!DB.meta.seeded) {
    DB.settings = { ...DEFAULT_SETTINGS }; DB.banners = structuredClone(DEFAULT_BANNERS); DB.vouchers = [];
    if (!DB.products.length) DB.products = SEED_PRODUCTS.map(p => ({ ...structuredClone(p), v: 2 }));
    DB.meta = { seeded: true, at: Date.now() };
    await supabase.from('products').delete().is('data->>v', null);            // remove old sample products from earlier shops (one time)
    await doPush();
  }
  const a = await supabase.from('users').select('id').eq('id', 'u-inj-admin');
  if (!a.error && !a.data.length) await supabase.from('users').upsert({ id: 'u-inj-admin', updated_at: new Date().toISOString(), data: { id: 'u-inj-admin', user: '123', name: 'Administrator', email: 'admin@localhost', pass: await sha('123'), role: 'admin', phone: '', addr: '', at: Date.now() } }, { onConflict: 'id', ignoreDuplicates: true });
}
async function loadAdminData() {
  const [u, o] = await Promise.all([supabase.from('users').select('id,data'), supabase.from('orders').select('id,data')]);
  if (u.error || o.error) throw (u.error || o.error);
  DB.users = []; DB.orders = []; SNAP.users = {}; SNAP.orders = {};
  ingest('users', u.data.filter(r => r.data.role)); ingest('orders', o.data);
  listen('orders'); listen('users');
}
async function loadMyOrders() {
  const u = me(); if (!u) return;
  const { data, error } = await supabase.from('orders').select('id,data').eq('data->>uid', u.id);
  if (error) return;
  DB.orders = []; SNAP.orders = {}; ingest('orders', data); listen('orders');
}

/* ---------- Auth ---------- */
async function sha(s) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('injanda::' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch { let h = 5381; for (const c of 'injanda::' + s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'x' + h; }
}
let meId = ls.get('inj-me', '');
const me = () => DB.users.find(u => u.id === meId) || null;
async function findUser(login) {
  const l = login.trim();
  for (const k of ['user', 'email']) {
    const { data, error } = await supabase.from('users').select('id,data').eq('data->>' + k, k === 'email' ? l.toLowerCase() : l);
    if (error) throw error; if (data?.length) return data[0].data;
  }
  return null;
}
async function signIn(u) {
  meId = u.id; ls.set('inj-me', meId);
  DB.users = DB.users.filter(x => x.id !== u.id); DB.users.push(u); SNAP.users[u.id] = JSON.stringify(u);
  if (u.role === 'admin') await loadAdminData(); else await loadMyOrders();
  renderChrome(); updateBadges();
}
function signOut() {
  meId = ''; ls.set('inj-me', ''); DB.users = []; DB.orders = []; SNAP.users = {}; SNAP.orders = {};
  if (!$('#admin').hidden) exitAdmin();
  renderChrome(); toast('You have been logged out'); location.hash = '#/';
}
async function restoreSession() {
  if (!meId) return;
  try { const { data } = await supabase.from('users').select('id,data').eq('id', meId); if (data?.length) await signIn(data[0].data); else { meId = ''; ls.set('inj-me', ''); } } catch {}
}

/* ---------- Images ---------- */
const isKey = s => /^[a-z0-9]+$/i.test(s || '');
const imgSrc = s => isKey(s) ? `img/${s}.jpg` : (s || '');
const imgTag = (s, alt = '', lazy = true) => `<img src="${esc(imgSrc(s))}" ${isKey(s) ? `data-key="${esc(s)}"` : ''} alt="${esc(alt)}" ${lazy ? 'loading="lazy"' : ''}>`;
let backupLoading;
document.addEventListener('error', e => {
  const el = e.target; if (el.tagName !== 'IMG' || el.dataset.fb) return; el.dataset.fb = '1';
  const ph = () => { el.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#e9edf1"/><text x="50%" y="50%" fill="#98a3ae" font-family="sans-serif" font-size="20" text-anchor="middle">No image</text></svg>'); };
  if (!isKey(el.dataset.key)) return ph();
  backupLoading ||= new Promise(r => { const s = document.createElement('script'); s.src = 'img-data.js'; s.onload = s.onerror = r; document.head.append(s); });   // embedded fallback copy of the catalogue photos
  backupLoading.then(() => { const b = window.IMG_BACKUP && window.IMG_BACKUP[el.dataset.key]; b ? el.src = b : ph(); });
}, true);

/* ---------- State ---------- */
let cart = ls.get('inj-cart', {}), wish = new Set(ls.get('inj-wish', [])), voucher = ls.get('inj-voucher', '');
const saveUser = () => { ls.set('inj-cart', cart); ls.set('inj-wish', [...wish]); ls.set('inj-voucher', voucher); };
const S = { cat: 'all', q: '', sort: 'feat', kind: '', min: '', max: '', stock: false, shown: 12, wish: false };
let next = '';

function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), 2600); }
const ICON = {
  heart: on => `<svg class="i ${on ? 'fill' : ''}" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>`,
  cart: `<svg class="i" viewBox="0 0 24 24"><path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>`,
  check: '<svg class="i" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
};

/* ---------- Header / footer ---------- */
function renderChrome() {
  const c = cfg(), u = me();
  const first = String(c.storeName || 'Injanda').trim().split(/\s+/)[0], sub = c.logoSub || 'Trading & Consult';
  $('#storeName').textContent = first; $('#logoSub').textContent = sub; $('#fName').textContent = `${first} ${sub}`;
  document.title = `${c.storeName} — Spare Parts & Services`;
  $('#announce').textContent = c.announce;
  const contact = [c.phone, c.email].filter(Boolean).join('  ·  ');
  $('#tbContact').textContent = contact || 'Quotes within one business day';
  $('#sCat').innerHTML = CATEGORIES.map(x => `<option value="${x.id}" ${S.cat === x.id ? 'selected' : ''}>${x.name}</option>`).join('');
  $('#cnav').innerHTML = CATEGORIES.slice(1).map(x => `<a href="#/shop?cat=${x.id}" class="${S.cat === x.id && /^#\/shop/.test(location.hash) ? 'on' : ''}">${x.name}</a>`).join('') + '<a href="#/quote" class="cta">Request a quote</a>';
  $('#acctLabel').textContent = u ? u.name.split(' ')[0] : 'Log in';
  $('#acctBtn').setAttribute('href', u ? '#/account' : '#/login');
  $('#fTag').textContent = c.tagline;
  $('#fContact').innerHTML = [c.address, c.phone, c.email].filter(Boolean).map(esc).join('<br>');
  $('#fCats').innerHTML = CATEGORIES.slice(1).map(x => `<a href="#/shop?cat=${x.id}">${x.name}</a>`).join('');
}

/* ---------- Cards ---------- */
function card(p) {
  const pr = priced(p), out = !avail(p), off = pr && p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0;
  return `<article class="card ${out ? 'out' : ''}" data-p="${esc(p.id)}" tabindex="0">
    <div class="ph">${imgTag(p.img, p.name)}${off ? `<span class="off">-${off}%</span>` : ''}${out ? '<span class="so">Sold out</span>' : ''}
      <button class="heart ${wish.has(String(p.id)) ? 'on' : ''}" data-wish="${esc(p.id)}" aria-label="Wishlist">${ICON.heart(wish.has(String(p.id)))}</button></div>
    <div class="bd"><span class="cl">${catName(p.cat)}</span><h4>${esc(p.name)}</h4>
      <div class="pr">${pr ? `<b>${p.unit ? `<small>${esc(p.unit)}</small> ` : ''}${baht(p.price)}</b>${off ? `<s>${baht(p.old)}</s>` : ''}` : '<b class="rq">Request a quote</b>'}</div>
      <button class="add" data-add="${esc(p.id)}" ${out ? 'disabled' : ''}>${pr ? 'Add to cart' : 'Add to quote'}</button></div></article>`;
}

/* ---------- Views ---------- */
let slideIdx = 0, slideTimer;
const slideHTML = (b, i, side) => `<div class="slide ${side ? 'sd' : ''} ${i === 0 ? 'on' : ''}" style="--bg:${esc(b.bg)}" data-cat-go="${esc(b.cat || 'all')}">
  <div class="st"><em>${esc(b.tag)}</em><h2>${esc(b.title)}</h2><p>${esc(b.sub)}</p>${side ? '' : '<span class="btn">Explore products</span>'}</div>${imgTag(b.img, '', false)}</div>`;

function viewHome() {
  const main = DB.banners.filter(b => b.slot === 'main'), side = DB.banners.filter(b => b.slot === 'side').slice(0, 3), feat = visible().slice(0, 8);
  const facts = [['DIN ISO 9001', 'Certified manufacturing'], ['120 kg', 'Guaranteed tensile load, web up kites'], ['Free estimate', 'On all electrical repairs'], ['6 months', 'Warranty on repairs']];
  return `<div class="wrap">
  <section class="hero"><div class="carousel" id="carousel"><div id="slides">${main.map((b, i) => slideHTML(b, i)).join('')}</div>
    ${main.length > 1 ? `<button class="nav prev" data-slide="-1" aria-label="Previous">‹</button><button class="nav next" data-slide="1" aria-label="Next">›</button><div class="dots">${main.map((_, i) => `<i data-dot="${i}" class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div></section>
  <section class="facts">${facts.map(f => `<div><b>${f[0]}</b><span>${f[1]}</span></div>`).join('')}</section>
  ${side.length ? `<section class="tiles">${side.map(b => slideHTML(b, 0, true)).join('')}</section>` : ''}
  <section class="sec"><div class="sh"><h2>Shop by category</h2><a href="#/shop">View all products →</a></div>
    <div class="catg">${CATEGORIES.slice(1).map(c => { const p = visible().find(x => x.cat === c.id); return `<a class="catc" href="#/shop?cat=${c.id}"><div>${p ? imgTag(p.img, c.name) : ''}</div><b>${c.name}</b><span>${visible().filter(x => x.cat === c.id).length} items</span></a>`; }).join('')}</div></section>
  <section class="sec"><div class="sh"><h2>Featured products</h2><a href="#/shop">Browse catalogue →</a></div>
    ${feat.length ? `<div class="grid">${feat.map(card).join('')}</div>` : '<div class="empty">No products yet. Add products from the admin panel.</div>'}</section>
  <section class="band"><div><h2>Can’t find the part you need?</h2><p>We manufacture to your drawing or used sample — even complicated parts. Send us the details and we’ll find a solution together.</p></div><a class="btn" href="#/quote">Request a quote</a></section></div>`;
}

function filtered() {
  const q = S.q.trim().toLowerCase();
  let l = visible().filter(p => (S.cat === 'all' || p.cat === S.cat) && (!S.kind || p.kind === S.kind) && (!q || `${p.name} ${p.sku} ${p.desc} ${Object.values(p.spec || {}).join(' ')}`.toLowerCase().includes(q))
    && (!S.min || (priced(p) && p.price >= +S.min)) && (!S.max || (priced(p) && p.price <= +S.max)) && (!S.stock || avail(p)) && (!S.wish || wish.has(String(p.id))));
  const by = { name: (a, b) => a.name.localeCompare(b.name), low: (a, b) => (priced(a) ? a.price : 1e12) - (priced(b) ? b.price : 1e12), high: (a, b) => (priced(b) ? b.price : -1) - (priced(a) ? a.price : -1) };
  return by[S.sort] ? l.sort(by[S.sort]) : l;
}
function viewShop() {
  return `<div class="wrap"><div class="crumb"><a href="#/">Home</a> / <span>${S.wish ? 'Wishlist' : S.cat === 'all' ? 'All products' : catName(S.cat)}</span></div>
  <div class="shop"><aside class="side" id="side"><h3>Categories</h3>
    ${CATEGORIES.map(c => `<a class="sl ${S.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.name}<em>${c.id === 'all' ? visible().length : visible().filter(p => p.cat === c.id).length}</em></a>`).join('')}
    <h3>Type</h3><label class="chk"><input type="radio" name="kind" value="" ${!S.kind ? 'checked' : ''}> All</label><label class="chk"><input type="radio" name="kind" value="part" ${S.kind === 'part' ? 'checked' : ''}> Products &amp; parts</label><label class="chk"><input type="radio" name="kind" value="service" ${S.kind === 'service' ? 'checked' : ''}> Services</label>
    <h3>Price (฿)</h3><div class="price-in"><input type="number" id="pmin" placeholder="Min" min="0" value="${esc(S.min)}"><span>–</span><input type="number" id="pmax" placeholder="Max" min="0" value="${esc(S.max)}"></div>
    <label class="chk"><input type="checkbox" id="stock" ${S.stock ? 'checked' : ''}> Available now</label><button class="btn ghost sm" id="reset">Clear filters</button></aside>
  <div><div class="toolbar"><p id="count"></p><button class="btn ghost sm fbtn" id="fToggle">Filters</button><label>Sort by <select id="sort"><option value="feat">Featured</option><option value="name">Name A–Z</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label></div>
  <div class="grid" id="grid"></div><div class="more"><button class="btn ghost" id="loadMore">Show more</button></div></div></div></div>`;
}
function renderGrid() {
  const g = $('#grid'); if (!g) return; const l = filtered();
  $('#count').textContent = `${l.length} result${l.length === 1 ? '' : 's'}${S.q ? ` for “${S.q}”` : ''}`;
  g.innerHTML = l.length ? l.slice(0, S.shown).map(card).join('') : '<div class="empty">No products match your search.<br><a href="#/quote">Request a quote</a> and we’ll source it for you.</div>';
  $('#loadMore').parentElement.hidden = l.length <= S.shown; $('#sort').value = S.sort;
}

function viewProduct(id) {
  const p = find(id); if (!p || p.hidden) return `<div class="wrap"><div class="empty">This product is not available. <a href="#/shop">Back to shop</a></div></div>`;
  const pr = priced(p), out = !avail(p), off = pr && p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0;
  const rel = visible().filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
  const stock = p.kind === 'service' ? 'Service — available on request' : out ? 'Currently sold out' : tracked(p) ? (p.stock <= 10 ? `Only ${p.stock} left in stock` : `${p.stock} in stock`) : 'Available on request';
  return `<div class="wrap"><div class="crumb"><a href="#/">Home</a> / <a href="#/shop?cat=${p.cat}">${catName(p.cat)}</a> / <span>${esc(p.name)}</span></div>
  <section class="pd"><div class="pimg">${imgTag(p.img, p.name, false)}</div>
    <div class="pin"><span class="cl">${catName(p.cat)} · ${esc(p.sku)}</span><h1>${esc(p.name)}</h1>
      <div class="pbox">${pr ? `<span class="big">${p.unit ? `<small>${esc(p.unit)}</small> ` : ''}${baht(p.price)}</span>${off ? `<s>${baht(p.old)}</s><em>-${off}%</em>` : ''}` : '<span class="big rq">Price on request</span><small>Add to your quote and we’ll reply with a price and lead time.</small>'}</div>
      <p class="stk ${out ? 'bad' : ''}">${ICON.check} ${stock}</p>
      <div class="buy"><span class="qty"><button id="mdec" aria-label="Decrease">−</button><span id="mq">1</span><button id="minc" aria-label="Increase">+</button></span>
        <button class="btn" id="madd" ${out ? 'disabled' : ''}>${pr ? 'Add to cart' : 'Add to quote'}</button>
        <button class="btn ghost" data-wish="${esc(p.id)}">${ICON.heart(wish.has(String(p.id)))} Save</button></div>
      <ul class="assure"><li>DIN ISO 9001 certified manufacturing</li><li>Made to your drawing or sample on request</li><li>Free estimates · warranty on repairs</li></ul></div></section>
  <section class="tabsec"><div><h3>Description</h3><p>${esc(p.desc)}</p></div>
    <div><h3>Specifications</h3>${Object.keys(p.spec || {}).length ? `<table class="spec">${Object.entries(p.spec).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : '<p class="muted">Contact us for the full specification.</p>'}</div></section>
  ${rel.length ? `<section class="sec"><div class="sh"><h2>Related products</h2></div><div class="grid">${rel.map(card).join('')}</div></section>` : ''}</div>`;
}

function viewAuth(reg) {
  return `<div class="wrap"><div class="authc"><h1>${reg ? 'Create your account' : 'Welcome back'}</h1><p class="muted">${reg ? 'Track orders and check out faster.' : 'Log in to your Injanda account.'}</p>
  <form id="authForm" class="form">${reg ? '<label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Phone<input name="phone" type="tel"></label>' : ''}
  <label>${reg ? 'Username' : 'Username or email'}<input name="user" autocomplete="username" required></label><label>Password<input name="pass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="3"></label>
  <p class="err" id="aerr"></p><button class="btn block">${reg ? 'Create account' : 'Log in'}</button></form>
  <p class="alt">${reg ? 'Already have an account? <a href="#/login">Log in</a>' : 'New customer? <a href="#/register">Create an account</a>'}</p></div></div>`;
}
async function submitAuth(e, reg) {
  e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), err = $('#aerr'), btn = $('button', e.target); btn.disabled = true; err.textContent = '';
  try {
    let u;
    if (reg) {
      if (await findUser(f.user) || await findUser(f.email)) throw new Error('That username or email is already registered.');
      u = { id: uid('u'), user: f.user.trim(), name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone || '', addr: '', pass: await sha(f.pass), role: 'customer', at: Date.now() };
      const { error } = await supabase.from('users').upsert({ id: u.id, data: u, updated_at: new Date().toISOString() }); if (error) throw error;
    } else {
      u = await findUser(f.user);
      if (!u || u.pass !== await sha(f.pass)) throw new Error('Incorrect username or password.');
    }
    await signIn(u); toast(`Welcome, ${u.name.split(' ')[0]}`);
    if (u.role === 'admin') { location.hash = '#/'; enterAdmin(); } else { location.hash = next || '#/account'; next = ''; }
  } catch (x) { err.textContent = x.message || 'Something went wrong.'; btn.disabled = false; }
}

function viewAccount() {
  const u = me(); if (!u) { next = '#/account'; location.hash = '#/login'; return ''; }
  const os = DB.orders.filter(o => o.uid === u.id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="wrap"><div class="crumb"><a href="#/">Home</a> / <span>My account</span></div><div class="acct">
  <div class="panel"><h2>My orders</h2>${os.length ? os.map(o => `<div class="ord"><div class="row"><b>${o.ref}</b><span class="pill ${o.status}">${STATUS[o.status] || o.status}</span></div>
    <small>${new Date(o.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${o.items.reduce((a, i) => a + i.qty, 0)} item(s)</small>
    <ul>${o.items.map(i => `<li>${esc(i.name)} × ${i.qty}</li>`).join('')}</ul><b>${o.total ? baht(o.total) : 'Quote pending'}</b></div>`).join('') : '<p class="muted">You haven’t placed an order yet. <a href="#/shop">Start shopping</a>.</p>'}</div>
  <div class="panel"><h2>Profile</h2><form id="profForm" class="form"><label>Full name<input name="name" value="${esc(u.name)}" required></label><label>Email<input name="email" type="email" value="${esc(u.email)}"></label>
    <label>Phone<input name="phone" value="${esc(u.phone)}"></label><label>Delivery address<input name="addr" value="${esc(u.addr)}"></label><label>New password<input name="pass" type="password" placeholder="Leave blank to keep"></label>
    <button class="btn">Save changes</button></form><button class="btn ghost red" data-logout>Log out</button></div></div></div>`;
}

function viewQuote() {
  const u = me() || {};
  return `<div class="wrap"><div class="crumb"><a href="#/">Home</a> / <span>Request a quote</span></div><div class="authc wide"><h1>Request a quote</h1><p class="muted">Tell us what you need — a part number, a machine model, a drawing or a used sample. We reply within one business day.</p>
  <form id="quoteForm" class="form"><div class="two"><label>Full name<input name="name" required value="${esc(u.name)}"></label><label>Phone<input name="phone" required value="${esc(u.phone)}"></label></div>
  <div class="two"><label>Email<input name="email" type="email" required value="${esc(u.email)}"></label><label>Company<input name="company"></label></div>
  <label>What do you need?<textarea name="note" rows="5" required placeholder="e.g. 20 folding blades for KBA Compacta, per sample"></textarea></label><button class="btn">Send request</button></form></div></div>`;
}

/* ---------- Router ---------- */
function route(keep) {
  const h = location.hash.slice(1) || '/', [path, qs] = h.split('?'), parts = path.split('/').filter(Boolean), q = new URLSearchParams(qs || ''), r = parts[0] || 'home';
  clearInterval(slideTimer); $('#suggest').classList.remove('on'); let v = '';
  if (r === 'shop') { if (!keep) { Object.assign(S, { cat: q.get('cat') || 'all', q: q.get('q') || '', wish: !!q.get('wish'), shown: 12 }); if (!q.get('cat')) $('#sCat').value = 'all'; } v = viewShop(); }
  else if (r === 'p') v = viewProduct(parts[1]);
  else if (r === 'login' || r === 'register') v = viewAuth(r === 'register');
  else if (r === 'account') v = viewAccount();
  else if (r === 'quote') v = viewQuote();
  else v = viewHome();
  $('#app').innerHTML = v; if (!keep) window.scrollTo(0, 0);
  if (r === 'shop') renderGrid();
  if (r === 'home') { slideIdx = 0; if ($$('#slides .slide').length > 1) slideTimer = setInterval(() => goSlide(slideIdx + 1), 5500); }
  if (r === 'p') { const p = find(parts[1]); if (p) wireProduct(p); }
  if (r === 'login' || r === 'register') $('#authForm').onsubmit = e => submitAuth(e, r === 'register');
  if (r === 'account' && $('#profForm')) $('#profForm').onsubmit = saveProfile;
  if (r === 'quote') $('#quoteForm').onsubmit = submitQuote;
  const sc = $('#sCat'); if (sc && r === 'shop') sc.value = S.cat; renderChrome();
}
function goSlide(n) { const s = $$('#slides .slide'); if (!s.length) return; slideIdx = (n + s.length) % s.length; s.forEach((el, i) => el.classList.toggle('on', i === slideIdx)); $$('.dots i').forEach((el, i) => el.classList.toggle('on', i === slideIdx)); }
function wireProduct(p) {
  let q = 1; const max = tracked(p) ? Math.max(1, p.stock) : 99;
  $('#mdec').onclick = () => { q = Math.max(1, q - 1); $('#mq').textContent = q; };
  $('#minc').onclick = () => { q = Math.min(max, q + 1); $('#mq').textContent = q; };
  $('#madd').onclick = () => { addCart(p.id, q); renderCart(); openLayer($('#drawer')); };
}
async function saveProfile(e) {
  e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), u = me();
  Object.assign(u, { name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone, addr: f.addr }); if (f.pass) u.pass = await sha(f.pass);
  persist(); renderChrome(); toast('Profile saved');
}
function submitQuote(e) {
  e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
  const ord = { ref: 'QT-' + uid().slice(-6).toUpperCase(), uid: me()?.id || '', type: 'quote', date: new Date().toISOString(), customer: { name: f.name, phone: f.phone, email: f.email, company: f.company, addr: '', note: f.note }, items: [], sub: 0, disc: 0, ship: 0, total: 0, code: '', status: 'new' };
  DB.orders.unshift(ord); persist();
  $('#app').innerHTML = `<div class="wrap"><div class="authc done"><div class="ck">✓</div><h1>Request sent</h1><p class="muted">Reference <code>${ord.ref}</code>. We’ll get back to you within one business day.</p><a class="btn" href="#/shop">Continue browsing</a></div></div>`;
}

/* ---------- Wishlist & cart ---------- */
function updateBadges() {
  const n = Object.values(cart).reduce((a, b) => a + b, 0), c = $('#cartN'); c.textContent = n; c.dataset.n = n; c.classList.add('bump'); setTimeout(() => c.classList.remove('bump'), 200);
  $('#wishN').textContent = wish.size; $('#wishN').dataset.n = wish.size;
}
function toggleWish(id) {
  id = String(id); wish.has(id) ? wish.delete(id) : (wish.add(id), toast('Saved to wishlist')); saveUser(); updateBadges();
  $$(`[data-wish="${id}"]`).forEach(b => { const on = wish.has(id); b.classList.toggle('on', on); b.innerHTML = b.classList.contains('heart') ? ICON.heart(on) : `${ICON.heart(on)} Save`; });
}
function addCart(id, qty = 1) {
  const p = find(id); if (!p || p.hidden) return;
  if (!avail(p)) return toast('Sorry, this item is sold out');
  cart[id] = Math.min((cart[id] || 0) + qty, tracked(p) ? p.stock : 99); saveUser(); updateBadges(); renderCart();
  toast(`Added: ${p.name.length > 34 ? p.name.slice(0, 34) + '…' : p.name}`);
}
function totals() {
  let sub = 0, quote = 0; Object.entries(cart).forEach(([id, q]) => { const p = find(id); if (!p) return; priced(p) ? sub += p.price * q : quote += q; });
  const v = DB.vouchers.find(x => x.on && x.code === voucher && sub >= (x.min || 0));
  const disc = v ? Math.round(v.pct ? sub * v.pct / 100 : Math.min(v.fix, sub)) : 0, after = sub - disc;
  const ship = !sub || after >= cfg().freeShip ? 0 : cfg().shipFee;
  return { sub, disc, ship, after, quote, total: after + ship, v };
}
function renderCart() {
  Object.keys(cart).forEach(id => { const p = find(id); if (!p || p.hidden) delete cart[id]; });
  const ids = Object.keys(cart);
  $('#cartList').innerHTML = ids.length ? ids.map(id => { const p = find(id);
    return `<div class="ci">${imgTag(p.img, p.name, false)}<div><a href="#/p/${esc(p.id)}" data-close>${esc(p.name)}</a>
      <div class="row2"><span class="qty"><button data-dec="${esc(id)}" aria-label="Decrease">−</button><span>${cart[id]}</span><button data-inc="${esc(id)}" aria-label="Increase">+</button></span><b>${priced(p) ? baht(p.price * cart[id]) : 'Quote'}</b></div>
      <button class="rm" data-rm="${esc(id)}">Remove</button></div></div>`; }).join('') : `<div class="empt">${ICON.cart}<p>Your cart is empty</p><a class="btn sm" href="#/shop" data-close>Browse products</a></div>`;
  if (!ids.length) { $('#cartFoot').innerHTML = ''; return; }
  const t = totals(), c = cfg();
  $('#cartFoot').innerHTML = `${t.sub ? `<div class="ship">${t.after >= c.freeShip ? 'You’ve unlocked free shipping' : `Add ${baht(c.freeShip - t.after)} more for free shipping`}<i><u style="width:${Math.min(100, t.after / c.freeShip * 100)}%"></u></i></div>` : ''}
    <div class="vc"><input id="vin" placeholder="Voucher code" value="${esc(voucher)}"><button class="btn ghost sm" id="vapply">Apply</button></div>
    <div class="sum"><span>Subtotal</span><span>${baht(t.sub)}</span></div>${t.disc ? `<div class="sum"><span>Voucher (${esc(voucher)})</span><span>−${baht(t.disc)}</span></div>` : ''}
    ${t.quote ? `<div class="sum"><span>${t.quote} item(s) to be quoted</span><span>TBC</span></div>` : ''}<div class="sum"><span>Shipping</span><span>${t.ship ? baht(t.ship) : t.sub ? 'Free' : 'TBC'}</span></div>
    <div class="sum t"><span>Total</span><span>${baht(t.total)}${t.quote ? ' +' : ''}</span></div><button class="btn block" id="checkout">${t.sub ? 'Check out' : 'Send quote request'}</button>
    <p class="note">No online payment is taken. We confirm price, stock and delivery with you.</p>`;
}

/* ---------- Layers & checkout ---------- */
const openLayer = el => { el.classList.add('on'); $('#scrim').classList.add('on'); };
const closeAll = () => ['#drawer', '#modal', '#scrim'].forEach(s => $(s).classList.remove('on'));
function openCheckout() {
  const u = me(); closeAll();
  if (!u) { next = location.hash || '#/'; toast('Please log in to continue'); location.hash = '#/login'; return; }
  const t = totals();
  $('#modalBox').innerHTML = `<button class="x" data-close aria-label="Close">✕</button><form class="form pad" id="orderForm"><h2>Delivery details</h2><p class="muted">We’ll reply with a confirmed quote and delivery time. No payment is taken now.</p>
    <div class="two"><label>Full name<input required name="name" value="${esc(u.name)}"></label><label>Phone<input required name="phone" type="tel" value="${esc(u.phone)}"></label></div>
    <div class="two"><label>Email<input required name="email" type="email" value="${esc(u.email)}"></label><label>Company (optional)<input name="company"></label></div>
    <label>Delivery address<input required name="addr" value="${esc(u.addr)}"></label><label>Notes (machine model, drawing, urgency…)<input name="note"></label>
    <div class="sum t"><span>Estimated total</span><span>${baht(t.total)}${t.quote ? ' +' : ''}</span></div><button class="btn block">Submit order</button></form>`;
  openLayer($('#modal'));
  $('#orderForm').onsubmit = e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const items = Object.entries(cart).map(([id, qty]) => { const p = find(id); return { id: p.id, name: p.name, sku: p.sku, price: priced(p) ? p.price : 0, qty, kind: p.kind }; });
    const ord = { ref: 'INJ-' + uid().slice(-6).toUpperCase(), uid: u.id, date: new Date().toISOString(), customer: f, items, sub: t.sub, disc: t.disc, ship: t.ship, total: t.total, code: t.v ? voucher : '', status: 'new' };
    items.forEach(i => { const p = find(i.id); if (tracked(p)) stockMove(p, -i.qty, 'Order ' + ord.ref, 'shop'); });
    u.name = f.name; u.phone = f.phone; u.addr = f.addr; DB.orders.unshift(ord); persist();
    $('#modalBox').innerHTML = `<button class="x" data-close aria-label="Close">✕</button><div class="done"><div class="ck">✓</div><h2>Order received</h2><p class="muted">Reference <code>${ord.ref}</code><br>We’ll contact you within one business day.</p><a class="btn" href="#/account" data-close>View my orders</a></div>`;
    cart = {}; voucher = ''; saveUser(); updateBadges(); renderCart();
  };
}

/* ---------- Search suggestions ---------- */
function showSuggest(q) {
  q = q.trim().toLowerCase(); const hits = q ? visible().filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(q)).slice(0, 6) : [];
  $('#suggest').innerHTML = hits.map(p => `<a href="#/p/${esc(p.id)}">${imgTag(p.img, '', false)}<span>${esc(p.name)}<small>${catName(p.cat)}</small></span><b>${priced(p) ? baht(p.price) : 'Quote'}</b></a>`).join(''); $('#suggest').classList.toggle('on', hits.length > 0);
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const t = e.target, g = a => t.closest(`[${a}]`); let el;
  if (!t.closest('.search')) $('#suggest').classList.remove('on');
  if (t.closest('#admin') || t.closest('#adlg')) return;
  if (t.id === 'adminDot') return isAdmin() ? enterAdmin() : (location.hash = '#/login');
  if (g('data-logout')) return signOut();
  if ((el = g('data-wish'))) { e.stopPropagation(); e.preventDefault(); return toggleWish(el.dataset.wish); }
  if ((el = g('data-add')))  { e.stopPropagation(); return addCart(el.dataset.add); }
  if ((el = g('data-p')))    { location.hash = '#/p/' + el.dataset.p; return; }
  if ((el = g('data-cat-go'))) { location.hash = '#/shop?cat=' + el.dataset.catGo; return; }
  if ((el = g('data-cat')))  { S.cat = el.dataset.cat; S.shown = 12; location.hash = '#/shop?cat=' + S.cat; return; }
  if ((el = g('data-slide'))) return goSlide(slideIdx + +el.dataset.slide);
  if ((el = g('data-dot')))  return goSlide(+el.dataset.dot);
  if ((el = g('data-inc')))  { const id = el.dataset.inc, p = find(id); cart[id] = Math.min(cart[id] + 1, tracked(p) ? p.stock : 99); }
  else if ((el = g('data-dec'))) { const id = el.dataset.dec; if (--cart[id] <= 0) delete cart[id]; }
  else if ((el = g('data-rm'))) delete cart[el.dataset.rm];
  else if (t.id === 'vapply') {
    const v = $('#vin').value.trim().toUpperCase(), f = DB.vouchers.find(x => x.on && x.code === v);
    if (!v) voucher = ''; else if (!f) toast('Invalid voucher code'); else if (totals().sub < (f.min || 0)) toast(`Minimum spend ${baht(f.min)} for this voucher`); else { voucher = v; toast(`Voucher ${v} applied`); }
  }
  else if (t.id === 'checkout') return openCheckout();
  else if (t.id === 'loadMore') { S.shown += 12; return renderGrid(); }
  else if (t.id === 'reset') { Object.assign(S, { cat: 'all', q: '', kind: '', min: '', max: '', stock: false, wish: false, shown: 12 }); $('#q').value = ''; return route(); }
  else if (t.id === 'fToggle') return $('#side').classList.toggle('show');
  else if (g('data-close') || t.id === 'scrim' || t.id === 'modal') return closeAll();
  else return;
  saveUser(); updateBadges(); renderCart();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeAll(); $('#adlg').classList.remove('on'); }
  if (e.key === 'Enter' && e.target.matches('.card')) location.hash = '#/p/' + e.target.dataset.p;
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); isAdmin() ? enterAdmin() : (location.hash = '#/login'); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pmin') { S.min = t.value; renderGrid(); } if (t.id === 'pmax') { S.max = t.value; renderGrid(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'sort') { S.sort = t.value; renderGrid(); } if (t.id === 'stock') { S.stock = t.checked; renderGrid(); }
  if (t.name === 'kind') { S.kind = t.value; renderGrid(); }
});
$('#cartBtn').onclick = () => { renderCart(); openLayer($('#drawer')); };
$('#wishBtn').onclick = () => { if (!wish.size) return toast('Your wishlist is empty'); location.hash = '#/shop?wish=1'; };
$('#searchForm').onsubmit = e => { e.preventDefault(); $('#suggest').classList.remove('on'); const c = $('#sCat').value; location.hash = `#/shop?${c !== 'all' ? 'cat=' + c + '&' : ''}q=${encodeURIComponent($('#q').value)}`; };
$('#q').oninput = e => showSuggest(e.target.value);
window.addEventListener('hashchange', () => route());

/* ---------- Boot ---------- */
async function boot() {
  try {
    if (!window.supabase || typeof supabase === 'undefined' || !supabase.from) throw new Error('Could not load the Supabase library (check your internet connection).');
    await loadPublic(); await ensureSeed(); await restoreSession();
    renderChrome(); updateBadges(); renderCart(); route();
  } catch (e) {
    console.error(e); const m = String(e.message || e), perm = /permission denied|42501/i.test(m), setup = !perm && /relation|does not exist|schema cache|PGRST|42P01/i.test(m);
    $('#app').innerHTML = `<div class="boot err"><h2>Can’t connect to the database</h2><p>${esc(m)}</p>${perm ? '<p>The tables exist but the website is not allowed to use them. Open <b>Supabase → SQL Editor</b>, paste the contents of the updated <code>supabase-setup.sql</code> (it contains the <code>grant</code> lines) and run it, then reload.</p>' : ''}${setup ? '<p>The tables have not been created yet. Open <b>Supabase → SQL Editor</b>, paste the contents of <code>supabase-setup.sql</code> and run it, then reload this page.</p>' : ''}${!perm && !setup ? '<p>Check <code>config.js</code> (project URL and anon key) and your internet connection.</p>' : ''}</div>`;
  }
}
window.addEventListener('load', boot);
