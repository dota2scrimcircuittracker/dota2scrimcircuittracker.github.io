// The Gallery's Shop tab (lib/shop.js): a top bar with your token balance and the bundles (each opens a
// Stripe Checkout made by the Worker), a row of extras (card slots) and commissions, why tokens (folded),
// every card item at its fixed price beside a demo card to try them on, and for Fav the orders and unmatched payments.
import { esc } from '../core.js';
import { collectionAction, collectionState, applyEquipment, PARTICLE_FINISHES, hasParticleAmount, isFxBorder } from '../lib/cosmetics.js';
import { BUNDLES, bundleBonus, PRICES, ARCANA_PRICE, SHOP_ORDER, SLOT_PRICE, MAX_EXTRA_SLOTS, COMMISSIONS, extraSlots, refundNote } from '../lib/shop.js';
import { CARD_SLOTS } from '../lib/cosmetics-engine.js';
import { isAdmin } from '../lib/pack-gifts.js';
import { fileTicket } from '../lib/feedback.js';
import { TIERS, DEFAULT_EQUIPMENT, itemByKey } from '../lib/cosmetics-catalog.js';
import { effectControlsHtml, normalizeSettings, EDITABLE_FINISHES } from '../lib/cosmetics-expansion-settings.js';
import { particleControlsHtml, normalizeParticles } from '../lib/cosmetics-particle-groups.js';
import { maxSignatureSize } from '../lib/signatures.js';
import { createPlayerCards, PAINT_FILTER } from './player-card.js';
import { ARCANA_COLOR } from './arcana.js';
import { toolArtHtml } from '../lib/card-arcana.js';

// Back from Stripe with ?paid=1: say so, and fetch the balance again while the webhook lands.
let paidNote = new URLSearchParams(location.search).has('paid');
if (paidNote) {
  const u = new URL(location.href);
  u.searchParams.delete('paid');
  history.replaceState(history.state, '', u);
}
let paidPolling = false;
// Your bundles from the last 24 hours (the Worker's shop-purchases), for the refund buttons. null until loaded.
let purchases = null, purchasesLoading = false;
let filter = 'all', rarity = 'all', page = 0, confirming = null, adminView = null, whyOpen = false, ordering = null;
// The demo card beside the items: a few base cards in different colours (picked at random once per
// visit) that any shop item can be tried on. Nothing is saved.
const DEMO_BASES = [[25, 'ember', '#ff7a3d'], [5, 'frost', '#7fd0ff'], [40, 'neon', '#7dff6a'], [41, 'hologram', '#c49bff'], [8, 'parchment', '#d9b77a'], [13, 'risograph', '#ff6fae'], [11, 'noir', '#9a9a9a'], [17, 'blueprint', '#4d8dff'], [74, 'cinema', '#ffcf6b'], [94, 'comic', '#3fe0c5']]
  .map(([hero, style, dot]) => ({ hero, style, dot })).sort(() => Math.random() - 0.5).slice(0, 4);
const DEMO_ACCOUNT = -1;
let demoBase = 0, demoItem = null, demoCards = null;
// The demo item's sliders (speed, particle amount, placement, particle groups), the same ones the
// Customize tab has. Cleared when another item is picked.
let demoTune = {};
const demoRenderer = () => demoCards ??= createPlayerCards([{ start_time: 1, winner: 'Radiant', players: [{ account_id: DEMO_ACCOUNT, team: 'Radiant', hero: 'Invoker', position: 2, kills: 12, deaths: 3, assists: 18, gpm: 620, xpm: 740, hero_damage: 32000, last_hits: 265 }] }], { tiers: new Map([[String(DEMO_ACCOUNT), { tier: 'A', rating: 86 }]]) });
const demoEquipment = (key = demoItem) => {
  const item = key && itemByKey(key), b = DEMO_BASES[demoBase];
  const base = { ...DEFAULT_EQUIPMENT, rotation: 0, baseCard: { hero: b.hero, art: null, style: b.style } };
  return { ...base, ...(item ? demoItemEquipment(item, base) : {}), ...(key === demoItem ? demoTune : {}) };
};
// What an item puts on the demo card. Tools show what they do: two finishes stacked, or the card
// turning to a second design on the next demo base. A living border shows on a gold frame.
const demoItemEquipment = (item, base) => {
  const id = item.key.slice(item.type.length + 1);
  if (item.type === 'living') return { border: 'gold', living: id };
  if (item.key === 'tool:double-finish') return { finish: 'starlight', finishStack: ['fx-sheen'] };
  if (item.turn) {
    const other = DEMO_BASES[(demoBase + 1) % DEMO_BASES.length];
    return { border: 'gold', twin: { turn: item.turn, design: { ...base, border: 'neon-sign', finish: 'starlight', baseCard: { hero: other.hero, art: null, style: other.style } } } };
  }
  return { [item.type]: id };
};
// What's typed in a commission form, kept across redraws (the confirm click redraws).
const drafts = { single: { pick: 'autograph', note: '' }, team: { team: '', note: '' } };
const PICKS = { autograph: 'Signature style', border: 'Border', finish: 'Finish' };
const PER_PAGE = 24;
// Each item's tile holds a small real card wearing it on the demo base, so it moves like the real thing.
const thumbHtml = (key) => `<div class="shop-thumb" data-shop-thumb="${key}">${demoRenderer().card({ account: DEMO_ACCOUNT, name: 'Your Name', team: 'YOUR TEAM' }, 2, { own: true, equipmentOverride: demoEquipment(key) })}</div>`;
const plural = (n) => `${n} token${n === 1 ? '' : 's'}`;
const loadStyles = () => {
  if (document.querySelector('link[data-shop-css]')) return;
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'shop.css' });
  link.dataset.shopCss = '';
  document.head.append(link);
};

export function drawShop(body, { state, editable, viewer, signIn, run, colors, typeLabel, name, redraw }) {
  loadStyles();
  const tokens = state?.tokens ?? 0, inventory = state?.inventory ?? {};
  const types = [...new Set(SHOP_ORDER.map((i) => i.type))];
  const items = SHOP_ORDER.filter((i) => (filter === 'all' || i.type === filter) && (rarity === 'all' || i.rarity === rarity));
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  const pager = pages > 1 ? `<nav class="shop-pager" aria-label="Shop pages"><button type="button" data-shop-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>‹ Prev</button>${Array.from({ length: pages }, (_, n) => `<button type="button" data-shop-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n + 1}</button>`).join('')}<button type="button" data-shop-page="${page + 1}" ${page === pages - 1 ? 'disabled' : ''}>Next ›</button></nav>` : '';
  body.innerHTML = `<div class="shop-bar">
    <div class="shop-balance"><small>Your tokens</small>${editable ? `<strong>${tokens}</strong>` : '<button type="button" data-signin>Connect Steam</button>'}</div>
    <div class="shop-bundles"><small>Get tokens</small><div class="shop-bundle-list">${BUNDLES.map((b) => `<button type="button" class="shop-bundle" data-bundle="${b.dollars}" ${editable ? '' : 'disabled'}><strong>${b.tokens}</strong><span>$${b.dollars}</span>${bundleBonus(b) > 0 ? `<em>+${bundleBonus(b)}%</em>` : ''}</button>`).join('')}</div>
      <p class="shop-code">${paidNote ? 'Payment received. Your tokens show here as soon as Stripe confirms it, usually within seconds.' : editable ? 'Pay by card through Stripe. Your tokens arrive on this account as soon as the payment goes through.' : 'Connect Steam to buy tokens.'}</p>${editable ? refundsHtml() : ''}</div>
  </div>
  ${editable ? featuresHtml(state) : ''}
  <details class="shop-why" ${whyOpen ? 'open' : ''}><summary>Why tokens?</summary>
    <p>Every payment carries a processing fee, and part of it is fixed. On a 50-cent card that fee would eat most of the price. You buy tokens in one go, pay that fee once, and spend them on the cards you want.</p>
    <p>The bigger bundles give more tokens per dollar. You pick the card, so there's no chance involved. Tokens only spend in this shop; they can't be cashed out.</p>
    <p>Bought a bundle by mistake? You can ask for a refund within 24 hours of buying it, from the list under the bundles. Fav refunds the payment through Stripe and that bundle's tokens come back out.</p>
    <p>Loading screens aren't for sale. They're Valve's art, so they only come from free packs.</p>
  </details>
  <div class="dex-layout shop-layout"><section class="shop-items"><div class="shop-items-head"><h3>Card items <span>${items.length}</span></h3><div class="shop-filters">
    <div class="shop-chips" role="group" aria-label="Rarity">${['all', ...TIERS].map((t) => `<button type="button" data-shop-rarity="${t}" aria-pressed="${t === rarity}" ${t === 'all' ? '' : `style="--rarity:${colors[t]}"`}>${t === 'all' ? 'All' : `${t} · ${PRICES[t]}`}</button>`).join('')}<button type="button" data-shop-rarity="arcana" aria-pressed="${rarity === 'arcana'}" style="--rarity:${ARCANA_COLOR}">arcana · ${ARCANA_PRICE}</button></div>
    <div class="shop-chips" role="group" aria-label="Type">${['all', ...types].map((t) => `<button type="button" data-shop-type="${t}" aria-pressed="${t === filter}">${t === 'all' ? 'All' : esc(typeLabel(t))}</button>`).join('')}</div>
    </div></div>
    ${`<div class="dex-grid shop-grid">${items.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map((i) => {
      const n = inventory[i.key] ?? 0, price = PRICES[i.rarity], sure = confirming === i.key;
      return `<article class="dex-item shop-item ${n ? 'collected' : ''} ${demoItem === i.key ? 'previewing' : ''}" data-shop-preview="${i.key}" title="Try it on the demo card" style="--rarity:${i.rarity === 'arcana' ? ARCANA_COLOR : colors[i.rarity]}">${i.type === 'tool' ? toolArtHtml(i) : thumbHtml(i.key)}<small>${esc(typeLabel(i.type) === i.rarity ? i.rarity : `${typeLabel(i.type)} · ${i.rarity}`)}</small><strong>${esc(i.name)}</strong><span>${n ? `Owned ×${n}` : 'Not owned'}</span>${editable ? `<button type="button" data-buy="${i.key}" class="${sure ? 'confirm' : ''}" ${tokens < price ? 'disabled' : ''}>${sure ? `Spend ${price}?` : `${price} token${price === 1 ? '' : 's'}`}</button>` : `<b class="shop-price">${price} token${price === 1 ? '' : 's'}</b>`}</article>`;
    }).join('') || '<p>Nothing matches.</p>'}</div>
    ${pager}`}
    <p class="muted shop-note">Bought copies can't be recycled.</p>
  </section>${demoHtml(colors, typeLabel, name)}</div>
  ${isAdmin(viewer) ? adminHtml() : ''}`;
  body.querySelector('.shop-why').ontoggle = (e) => { whyOpen = e.target.open; };
  body.querySelector('[data-signin]')?.addEventListener('click', signIn);
  body.querySelectorAll('[data-shop-type]').forEach((b) => b.onclick = () => { filter = b.dataset.shopType; page = 0; confirming = null; redraw(); });
  body.querySelectorAll('[data-shop-rarity]').forEach((b) => b.onclick = () => { rarity = b.dataset.shopRarity; page = 0; confirming = null; redraw(); });
  body.querySelectorAll('[data-shop-page]').forEach((b) => b.onclick = () => { page = Number(b.dataset.shopPage); confirming = null; redraw(); body.querySelector('.shop-items')?.scrollIntoView({ block: 'start' }); });
  // Sticks just under the site header, whose height changes with the screen width.
  const demo = body.querySelector('.shop-demo'), top = document.querySelector('header.top');
  if (demo && top && getComputedStyle(top).position === 'sticky') demo.style.top = `${top.offsetHeight + 12}px`;
  const card = body.querySelector('[data-demo-card] .ft-card');
  if (card) { card.classList.remove('flipped'); card.querySelectorAll('button').forEach((b) => b.remove()); applyEquipment(card, demoEquipment(), name); }
  body.querySelectorAll('[data-shop-thumb] .ft-card:not(.ft-twin-b)').forEach((c) => { c.classList.remove('flipped'); c.querySelectorAll('button').forEach((b) => b.remove()); applyEquipment(c, demoEquipment(c.closest('[data-shop-thumb]').dataset.shopThumb), name); });
  body.querySelectorAll('[data-shop-preview]').forEach((a) => a.onclick = (e) => { if (e.target.closest('button')) return; demoItem = demoItem === a.dataset.shopPreview ? null : a.dataset.shopPreview; demoTune = {}; redraw(); });
  wireTune(body.querySelector('[data-demo-tune]'), card, name, redraw);
  body.querySelectorAll('[data-demo-base]').forEach((b) => b.onclick = () => { demoBase = Number(b.dataset.demoBase); redraw(); });
  body.querySelector('[data-demo-clear]')?.addEventListener('click', () => { demoItem = null; demoTune = {}; redraw(); });
  if (paidNote && editable && !paidPolling) {
    paidPolling = true;
    for (const wait of [1500, 5000, 12000]) setTimeout(async () => { if (body.isConnected && await run('session', {})) { purchases = null; redraw(); } }, wait);
    setTimeout(() => { paidNote = false; if (body.isConnected) redraw(); }, 15000);
  }
  // The Worker makes the checkout and returns Stripe's page; the local shop test credits straight away.
  body.querySelectorAll('[data-bundle]').forEach((b) => b.onclick = async () => {
    b.disabled = true;
    const data = await run('stripe-checkout', { dollars: Number(b.dataset.bundle), path: location.pathname, hash: location.hash });
    if (data?.url) location.assign(data.url);
    else { purchases = null; redraw(); }
  });
  // Two clicks: the first asks, the second spends.
  const twice = (id, spend) => async () => {
    if (confirming !== id) { confirming = id; redraw(); return; }
    confirming = null;
    await spend();
    redraw();
  };
  body.querySelectorAll('[data-buy]').forEach((b) => b.onclick = twice(b.dataset.buy, () => run('buy', { item: b.dataset.buy })));
  body.querySelector('[data-buy-slot]')?.addEventListener('click', twice('slot', () => run('buy-slot', {})));
  // A refund request: the Worker marks the purchase, then it goes to Fav as a ticket.
  if (editable && purchases == null && !purchasesLoading) {
    purchasesLoading = true;
    run('shop-purchases', {}).then((data) => { purchases = data?.purchases ?? []; purchasesLoading = false; if (body.isConnected) redraw(); });
  }
  body.querySelectorAll('[data-refund]').forEach((b) => b.onclick = twice(`refund:${b.dataset.refund}`, async () => {
    const data = await run('refund-request', { payment: b.dataset.refund });
    if (!data?.refund) return;
    const p = purchases?.find((x) => x.id === data.refund.id);
    if (p) p.refundRequested = Date.now();
    await refundTicket(data.refund, name, viewer, b, body.parentElement?.querySelector('.collection-message'));
  }));
  body.querySelectorAll('[data-order-open]').forEach((b) => b.onclick = () => { ordering = ordering === b.dataset.orderOpen ? null : b.dataset.orderOpen; confirming = null; redraw(); });
  body.querySelectorAll('[data-commission]').forEach((form) => {
    const kind = form.dataset.commission;
    form.oninput = (e) => { if (e.target.name) drafts[kind][e.target.name] = e.target.value; };
    form.onsubmit = (e) => {
      e.preventDefault();
      twice(`commission-${kind}`, async () => {
        const d = drafts[kind];
        const data = await run('commission', { kind, pick: d.pick, team: d.team, note: d.note });
        if (data?.order) {
          drafts[kind] = kind === 'team' ? { team: '', note: '' } : { pick: 'autograph', note: '' };
          ordering = null;
          await ticketFor(data.order, name, form, body.parentElement?.querySelector('.collection-message'));
        }
      })();
    };
  });
  body.querySelector('[data-admin-load]')?.addEventListener('click', async () => {
    const orders = await run('shop-orders', {}), payments = await run('shop-payments', {});
    adminView = { orders: orders?.orders ?? [], nicknames: orders?.nicknames ?? {}, payments: payments?.payments ?? {} };
    redraw();
  });
  body.querySelectorAll('[data-close-order]').forEach((b) => b.onclick = twice(`order-${b.dataset.closeOrder}-${b.dataset.status}`, async () => {
    if (await run('shop-order-close', { order: b.dataset.closeOrder, status: b.dataset.status })) adminView = null;
  }));
  body.querySelectorAll('[data-assign]').forEach((form) => form.onsubmit = async (e) => {
    e.preventDefault();
    if (await run('shop-assign', { payment: form.dataset.assign, target: form.elements.target.value.trim() })) { adminView = null; redraw(); }
  });
}

// A paid order also goes in as a feedback ticket (lib/feedback.js fileTicket), so it shows up in
// `node scripts/feedback.cjs list`, the ticket emails and Discord like any other. The order itself
// is already saved; a ticket that fails only loses the reminder, and Fav's orders panel still has it.
async function ticketFor(order, name, el, message) {
  if (order.local) { if (message) message.textContent = 'Test order placed. No ticket filed.'; return; }
  const what = order.kind === 'team' ? `Team set for ${order.team}` : PICKS[order.pick];
  const note = `Commission order ${order.id}: ${what} · ${plural(order.price)} paid.${order.note ? ` Idea: ${order.note}` : ''}`;
  let text;
  try {
    const res = await fileTicket(name, note, el);
    text = res.id ? `Ordered. Your ticket is ${res.id}; Fav will be in touch.` : 'Ordered. Fav sees it in the orders list.';
  } catch { text = 'Ordered. Fav sees it in the orders list.'; }
  if (message) message.textContent = text;
}

// A refund request goes in as a ticket the same way. The purchase is already marked, so a ticket that
// fails would leave Fav unaware: the message says to send it on Discord instead, and Fav's panel lists it.
async function refundTicket(refund, name, account, el, message) {
  if (refund.local) { if (message) message.textContent = 'Test refund request. No ticket filed.'; return; }
  let text;
  try {
    const res = await fileTicket(name, refundNote(refund, `${name} (Steam account ${account})`), el);
    text = res.id ? `Refund requested. Your ticket is ${res.id}; Fav refunds it through Stripe.` : 'Refund requested. Fav refunds it through Stripe.';
  } catch { text = "Refund requested, but the ticket didn't send. Message Fav on Discord so it isn't missed."; }
  if (message) message.textContent = text;
}

// Bundles bought in the last 24 hours, each with its refund button or where its refund stands.
const ago = (at) => { const h = Math.floor((Date.now() - at) / 3600000); return h < 1 ? 'under an hour ago' : `${h} hour${h === 1 ? '' : 's'} ago`; };
function refundsHtml() {
  if (!purchases?.length) return '';
  const rows = purchases.map((p) => {
    const id = `refund:${p.id}`, sure = confirming === id;
    const end = p.status === 'refunded' ? '<em>Refunded</em>' : p.refundRequested ? '<em>Refund requested</em>'
      : p.status === 'credited' ? `<button type="button" data-refund="${esc(p.id)}" class="${sure ? 'confirm' : ''}">${sure ? 'Ask Fav for a refund?' : 'Request a refund'}</button>` : '';
    return `<li><span>$${esc(p.amount)} · ${plural(p.tokens)} · ${ago(p.at)}</span>${end}</li>`;
  }).join('');
  return `<div class="shop-refunds"><small>Bought in the last 24 hours</small><ul>${rows}</ul></div>`;
}

function demoHtml(colors, typeLabel, name) {
  const item = demoItem && itemByKey(demoItem), base = DEMO_BASES[demoBase];
  const html = demoRenderer().card({ account: DEMO_ACCOUNT, name: 'Your Name', team: 'YOUR TEAM' }, 2, { own: true, equipmentOverride: demoEquipment() });
  return `<aside class="dex-card-preview shop-demo"><h3>Try it on</h3>
    <p class="shop-demo-note">${item ? `<b style="color:${colors[item.rarity]}">${esc(item.name)}</b> · ${esc(typeLabel(item.type))}` : 'Click any item to see it on this card.'}</p>
    <div data-demo-card>${PAINT_FILTER}${html}</div>
    <div class="shop-demo-bases" role="group" aria-label="Base card">${DEMO_BASES.map((b, n) => `<button type="button" data-demo-base="${n}" aria-pressed="${n === demoBase}" style="--dot:${b.dot}" title="${esc(b.style)}"><i></i></button>`).join('')}</div>
    <small class="shop-demo-base-name">Base: ${esc(base.style)}</small>
    ${tuneHtml(name)}
    ${item ? '<button type="button" data-demo-clear>Clear</button>' : ''}</aside>`;
}

const TUNES = [['particleSpeed', 'Finish speed', (e) => PARTICLE_FINISHES.includes(e.finish)], ['particleAmount', 'Particle amount', (e) => hasParticleAmount(e.finish)], ['borderSpeed', 'Border speed', (e) => isFxBorder(e.border)]];
// The demo item's sliders, or nothing when it has none (most commons).
function tuneHtml(name) {
  const item = demoItem && itemByKey(demoItem);
  if (!item) return '';
  const e = demoEquipment(), id = e[item.type];
  if (item.type === 'autograph') {
    // Size ends where this style stops growing for the demo name (lib/signatures.js maxSignatureSize).
    const sig = [['size', 'Size', 5, maxSignatureSize(e, name ?? 'Your Name'), 0.5, e.size, ''], ['rotation', 'Angle', -180, 180, 1, e.rotation, '°'], ['textSize', 'Lettering size', 50, 200, 10, e.textSize ?? 100, '%']];
    return `<div class="shop-demo-tune" data-demo-tune>${sig.map(([k, label, min, max, step, v, unit]) => `<label>${label} <output>${v}${unit}</output><input type="range" data-sig="${k}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`).join('')}<button type="button" data-sig-reset>Reset signature</button></div>`;
  }
  if (item.type !== 'finish' && item.type !== 'border') return '';
  const speeds = TUNES.filter(([, , shown]) => shown(e)).map(([k, label]) => `<label class="particle-speed-control">${label} <output data-tune-value="${k}">${e[k]}%</output><input type="range" data-tune="${k}" min="50" max="200" step="10" value="${e[k]}"></label>`).join('');
  // Placement without the drag handle: the sliders do the same thing here.
  const place = item.type === 'finish' ? effectControlsHtml(e).replace(/<button type="button" data-finish-move[^>]*>[^<]*<\/button>\s*/, '') : '';
  const groups = particleControlsHtml(item.type, id, (item.type === 'border' ? e.borderSettings : e.finishSettings)?.[id]);
  return speeds || place || groups ? `<div class="shop-demo-tune" data-demo-tune>${speeds}${place}${groups}</div>` : '';
}
// Slides redraw only the demo card so the slider keeps the pointer; resets redraw the tab.
function wireTune(host, card, name, redraw) {
  if (!host || !card) return;
  const item = itemByKey(demoItem), id = demoEquipment()[item.type];
  const store = (type) => type === 'border' ? (demoTune.borderSettings ??= {}) : (demoTune.finishSettings ??= {});
  const settings = (type) => type === 'finish' && EDITABLE_FINISHES.includes(id) ? normalizeSettings('finish-' + id, store(type)[id]) : normalizeParticles(type, id, store(type)[id]);
  host.oninput = (e) => {
    const input = e.target.closest('input[type=range]');
    if (!input) return;
    const v = Number(input.value);
    if (input.dataset.tune) demoTune[input.dataset.tune] = v;
    else if (input.dataset.sig) demoTune[input.dataset.sig] = v;
    else if (input.dataset.effect) { const s = settings('finish'); s[input.dataset.effect] = v; store('finish')[id] = s; }
    else if (input.dataset.particle) { const type = input.dataset.particleScope, s = settings(type); s[input.dataset.particle] = v; store(type)[id] = s; }
    const out = input.closest('label')?.querySelector('output');
    if (out) out.textContent = input.dataset.tune ? `${v}%` : `${v}${input.dataset.unit ?? ''}`;
    applyEquipment(card, demoEquipment(), name);
  };
  host.onclick = (e) => {
    if (e.target.closest('[data-sig-reset]')) { demoTune = {}; redraw(); return; }
    const reset = e.target.closest('[data-finish-reset],[data-particle-reset]');
    if (!reset) return;
    if (reset.dataset.particleReset) delete store(reset.dataset.particleReset)[id];
    else delete store('finish')[id];
    redraw();
  };
}

const confirmText = (id, idle, price) => (confirming === id ? `Spend ${price}?` : idle);

const ICONS = {
  slot: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5" stroke-dasharray="2.5 2"/><path d="M17.5 10v4M15.5 12h4"/></svg>',
  single: '<svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/></svg>',
  team: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5M10.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/></svg>',
};
// One tile in the row under the balance: icon, name, price, a line on what it is, then its controls.
const tile = (id, accent, title, price, blurb, body) => `<article class="shop-feature" style="--accent:${accent}">
  <header><span class="shop-feature-icon" aria-hidden="true">${ICONS[id]}</span><div><strong>${title}</strong>${price}</div></header>
  <p>${blurb}</p>${body}</article>`;
const pricePill = (n) => `<span class="shop-feature-price">${plural(n)}</span>`;

function featuresHtml(state) {
  const tokens = state.tokens ?? 0, extra = extraSlots(state);
  const single = COMMISSIONS.single.price, team = COMMISSIONS.team.price;
  const pips = Array.from({ length: CARD_SLOTS + MAX_EXTRA_SLOTS }, (_, n) => `<i class="${n < CARD_SLOTS ? 'base' : n < CARD_SLOTS + extra ? 'bought' : ''}"></i>`).join('');
  const slot = tile('slot', '#ffd879', 'Extra card slot', pricePill(SLOT_PRICE), `One more card design to switch between. You have ${CARD_SLOTS + extra} of ${CARD_SLOTS + MAX_EXTRA_SLOTS}.`,
    `<div class="shop-pips" aria-hidden="true">${pips}</div>${extra < MAX_EXTRA_SLOTS
      ? `<button type="button" class="shop-feature-cta ${confirming === 'slot' ? 'confirm' : ''}" data-buy-slot ${tokens < SLOT_PRICE ? 'disabled' : ''}>${confirmText('slot', `Buy a slot · ${plural(SLOT_PRICE)}`, SLOT_PRICE)}</button>`
      : '<span class="shop-feature-done">All slots bought</span>'}`);
  const form = (kind, cost, fields) => ordering === kind
    ? `<form class="shop-order-form" data-commission="${kind}">${fields}
      <div class="shop-order-actions"><button type="button" data-order-open="${kind}">Cancel</button><button type="submit" class="shop-feature-cta ${confirming === `commission-${kind}` ? 'confirm' : ''}" ${tokens < cost ? 'disabled' : ''}>${confirmText(`commission-${kind}`, `Order · ${plural(cost)}`, cost)}</button></div></form>`
    : `<button type="button" class="shop-feature-cta" data-order-open="${kind}" ${tokens < cost ? 'disabled' : ''}>${tokens < cost ? `Needs ${plural(cost)}` : 'Start an order'}</button>`;
  const d1 = drafts.single, d2 = drafts.team;
  const own = tile('single', '#c39bff', 'Your own item', pricePill(single), 'A signature style, border or finish made with Fav, just for you.',
    form('single', single, `<label>Item <select name="pick">${COMMISSIONS.single.picks.map((p) => `<option value="${p}" ${p === d1.pick ? 'selected' : ''}>${PICKS[p]}</option>`).join('')}</select></label>
      <label>Idea <input name="note" maxlength="300" placeholder="Colours, theme, anything" value="${esc(d1.note)}"></label>`));
  const set = tile('team', '#6fd3ff', 'Team set', pricePill(team), 'Border, finish and signature for your team. Everyone on it gets a copy, and it joins the packs.',
    form('team', team, `<label>Team <input name="team" maxlength="60" required placeholder="Your team’s name" value="${esc(d2.team)}"></label>
      <label>Idea <input name="note" maxlength="300" placeholder="Colours, logo, theme" value="${esc(d2.note)}"></label>`));
  return `<section class="shop-features" aria-label="Extras and commissions">${slot}${own}${set}
    <p class="shop-features-note">Made with Fav: tokens are taken when you order, and come back if Fav can’t make it.</p></section>`;
}

// Fav only: open commission orders to finish or refund, and paid checkouts whose account had no collection.
function adminHtml() {
  if (!adminView) return '<section class="shop-admin"><h3>Fav: orders and payments</h3><button type="button" data-admin-load>Load orders and payments</button></section>';
  const open = adminView.orders.filter((o) => o.status === 'open'), who = (a) => esc(adminView.nicknames[a] ?? `Player ${a}`);
  const payments = Object.entries(adminView.payments).filter(([, p]) => p.status === 'unmatched'), refunds = Object.entries(adminView.payments).filter(([, p]) => p.refundRequested && p.status === 'credited');
  return `<section class="shop-admin"><h3>Fav: orders and payments</h3>
    <h4>Open orders (${open.length})</h4>${open.map((o) => `<div class="shop-order"><strong>${who(o.account)} · ${o.kind === 'team' ? `Team set for ${esc(o.team)}` : PICKS[o.pick]} · ${plural(o.price)}</strong><span>${new Date(o.at).toLocaleString()}${o.note ? ` · “${esc(o.note)}”` : ''}</span>
      <a href="#/all/player/${esc(o.account)}">Profile</a>
      <button type="button" data-close-order="${esc(o.id)}" data-status="done">${confirming === `order-${o.id}-done` ? 'Sure?' : 'Mark done'}</button>
      <button type="button" data-close-order="${esc(o.id)}" data-status="refunded">${confirming === `order-${o.id}-refunded` ? 'Sure?' : 'Refund'}</button></div>`).join('') || '<p class="muted">None.</p>'}
    <h4>Payments with no account (${payments.length})</h4>${payments.map(([id, p]) => `<form class="shop-order" data-assign="${esc(id)}"><strong>$${esc(p.amount)} ${esc(p.currency)} · ${plural(p.tokens)}</strong><span>${new Date(p.at).toLocaleString()}${p.account ? ` · account ${esc(p.account)}` : ''}</span>
      <label>Steam account ID <input name="target" inputmode="numeric" pattern="\\d{1,10}" required></label><button type="submit">Give tokens</button></form>`).join('') || '<p class="muted">None.</p>'}
    <h4>Refund requests (${refunds.length})</h4>${refunds.map(([id, p]) => `<div class="shop-order"><strong>${who(p.account)} · $${esc(p.amount)} · ${plural(p.tokens)}</strong><span>Paid ${new Date(p.at).toLocaleString()} · asked ${new Date(p.refundRequested).toLocaleString()} · ${esc(id)}</span><a href="#/all/player/${esc(p.account)}">Profile</a></div>`).join('') || '<p class="muted">None. Refund them in Stripe; the tokens come back out on their own.</p>'}
  </section>`;
}

// On another player's profile: buy them a card with your tokens (lib/shop.js giftItem).
export async function mountShopGift(host, account, name, me, adapter = null) {
  if (me == null || String(me) === String(account) || !host.isConnected || host.querySelector('.shop-gift-panel')) return;
  const act = adapter?.action ?? collectionAction;
  let state = adapter?.state ?? collectionState() ?? (await act('session', {}).catch(() => null))?.state;
  if (!state || !host.isConnected || host.querySelector('.shop-gift-panel')) return;
  loadStyles();
  const section = document.createElement('section');
  section.className = 'shop-gift-panel panel';
  (host.querySelector('.send-panel') ?? host.querySelector('.gift-panel') ?? host.querySelector('.profile-collection') ?? host.querySelector('.page-head'))?.after(section);
  const draw = (note = '') => {
    const tokens = state.tokens ?? 0;
    section.innerHTML = `<h3>Buy ${esc(name)} a card</h3><p class="muted">Paid with your tokens. You have ${tokens}. They get a notice saying it's from you.</p>
      <form class="gift-form"><label>Card item <select name="item">${SHOP_ORDER.map((i) => `<option value="${esc(i.key)}" ${PRICES[i.rarity] > tokens ? 'disabled' : ''}>${esc(i.name)} · ${esc(i.type === 'translation' ? 'modifier' : i.type)} · ${PRICES[i.rarity]} token${PRICES[i.rarity] === 1 ? '' : 's'}</option>`).join('')}</select></label>
      <label class="gift-note">Note <input name="note" maxlength="120" placeholder="Optional, shown to them"></label><button type="submit" ${tokens ? '' : 'disabled'}>Buy and send</button></form>
      <span class="gift-msg" role="status" aria-live="polite">${esc(note)}</span>`;
    const form = section.querySelector('form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = form.querySelector('button'), msg = section.querySelector('.gift-msg'), item = SHOP_ORDER.find((i) => i.key === form.elements.namedItem('item').value); // elements.item is the collection's item() method
      button.disabled = true; msg.textContent = 'Sending…';
      try {
        const data = await act('gift-item', { target: String(account), item: item.key, note: form.elements.note.value });
        state = data.state ?? state;
        draw(`Sent ${item.name} to ${name}.`);
      } catch (err) { msg.textContent = err.message; button.disabled = false; }
    };
  };
  draw();
}
