// Pack gifts (lib/pack-gifts.js). Fav sees a "Gift packs" box on other players' profiles; the
// recipient gets a notice on their next page load, which stays until they open or dismiss it.
import { esc } from '../core.js';
import { steamAccount } from '../lib/store.js';
import { collectionAction, collectionState } from '../lib/cosmetics.js';
import { TIERS, CATALOG } from '../lib/cosmetics-catalog.js';
import { SCREEN_ART } from '../lib/screen-art-data.js';
import { THEMED_PACKS, themedLabel, parsePack, packName } from '../lib/pack-types.js';
import { isAdmin, giftLabel, MAX_GIFT_PACKS, MAX_SENT_PER_DAY } from '../lib/pack-gifts.js';

export async function mountGiftPanel(host, account, name, adapter = null) {
  const me = adapter?.account ?? await steamAccount().catch(() => null);
  await mountSendPanel(host, account, name, me, adapter);
  if (!isAdmin(me) || !host.isConnected || host.querySelector('.gift-panel')) return;
  const section = document.createElement('section');
  section.className = 'gift-panel panel';
  section.innerHTML = `<h3>Send a gift</h3><p class="muted">Only you see this. ${esc(name)} gets a notice next time they visit.</p>
    <form class="gift-form">
      <label>Gift type <select name="kind"><option value="pack">Packs</option><option value="item">Card item</option><option value="screen">Loading screen</option></select></label>
      <label data-gift-count>Quantity <input type="number" name="count" min="1" max="${MAX_GIFT_PACKS}" value="1" required></label>
      <label data-gift-tier>Pack <select name="tier">${TIERS.map((t) => `<option value="${t}">${t === 'common' ? 'Normal card pack' : t[0].toUpperCase() + t.slice(1) + ' or better'}</option>`).join('')}${THEMED_PACKS.map((p) => `<option value="${p}">${themedLabel(p)} · 3 ${parsePack(p).kind} items</option>`).join('')}<option value="screens">Loading screen pack · 5 new screens</option></select></label>
      <label data-gift-item hidden>Card item <select name="item">${CATALOG.map(i=>`<option value="${esc(i.key)}">${esc(i.name)} · ${esc(i.type)} · ${i.rarity}</option>`).join('')}</select></label>
      <label data-gift-screen hidden>Loading screen <select name="screen">${SCREEN_ART.map(s=>`<option value="${esc(s.id)}">${esc(s.label)} · ${esc(s.hero??'Any hero')}</option>`).join('')}</select></label>
      <label class="gift-note">Note <input name="note" maxlength="120" placeholder="Optional, shown to them"></label>
      <button type="submit">Send gift</button>
      <span class="gift-msg" role="status" aria-live="polite"></span>
    </form>`;
  (host.querySelector('.profile-collection') ?? host.querySelector('.page-head'))?.after(section);
  const form = section.querySelector('form'), msg = section.querySelector('.gift-msg');
  const fields = Object.fromEntries(['kind','count','tier','item','screen','note'].map(key=>[key,form.elements.namedItem(key)]));
  const sync = () => {
    for (const type of ['tier','item','screen','count']) {
      const show = type==='count' ? fields.kind.value!=='screen' : fields.kind.value===(type==='tier'?'pack':type);
      section.querySelector(`[data-gift-${type}]`).hidden=!show;
      fields[type].disabled=!show;
    }
  };
  fields.kind.onchange=sync;sync();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const kind=fields.kind.value;
    const gift = { kind, count: kind==='screen'?1:Number(fields.count.value), note: fields.note.value };
    if(kind==='pack')gift.tier=fields.tier.value;
    else gift.item=fields[kind==='screen'?'screen':'item'].value;
    const button = form.querySelector('button');
    button.disabled = true; msg.textContent = 'Sending…';
    try {
      await (adapter?.action??collectionAction)('gift', { target: String(account), ...gift });
      msg.textContent = `Sent ${giftLabel(gift)} to ${name}.`;
      fields.note.value = '';
    } catch (err) { msg.textContent = err.message; }
    button.disabled = false;
  };
}

// Anyone signed in can send another player a pack they hold. Only packs in your own inventory are
// offered; the Worker moves it from your list to theirs (lib/pack-gifts.js sendPack).
async function mountSendPanel(host, account, name, me, adapter) {
  if (me == null || String(me) === String(account) || !host.isConnected || host.querySelector('.send-panel')) return;
  const act = adapter?.action ?? collectionAction;
  let state = collectionState() ?? (await act('session', {}).catch(() => null))?.state;
  if (!state || !host.isConnected || host.querySelector('.send-panel')) return;
  const section = document.createElement('section');
  section.className = 'send-panel panel';
  (host.querySelector('.gift-panel') ?? host.querySelector('.profile-collection') ?? host.querySelector('.page-head'))?.after(section);
  const draw = (note = '') => {
    const packs = state.packs ?? [];
    section.innerHTML = `<h3>Send ${esc(name)} a pack</h3><p class="muted">Sent from your own packs, so you lose the one you send. Up to ${MAX_SENT_PER_DAY} a day.</p>${packs.length
      ? `<form class="gift-form"><label>Pack <select name="pack">${packs.map((p, i) => `<option value="${i}">${esc(packName(p))}</option>`).join('')}</select></label>
        <label class="gift-note">Note <input name="note" maxlength="120" placeholder="Optional, shown to them"></label><button type="submit">Send pack</button></form>`
      : '<p class="muted">You have no packs to send right now.</p>'}<span class="gift-msg" role="status" aria-live="polite">${esc(note)}</span>`;
    const form = section.querySelector('form');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const button = form.querySelector('button'), msg = section.querySelector('.gift-msg'), index = Number(form.elements.pack.value);
      const label = packName(packs[index]);
      button.disabled = true; msg.textContent = 'Sending…';
      try {
        const data = await act('send-pack', { target: String(account), packIndex: index, note: form.elements.note.value });
        state = data.state ?? state;
        draw(`Sent a ${label} to ${name}.`);
      } catch (err) { msg.textContent = err.message; button.disabled = false; }
    };
  };
  draw();
}

// The recipient's notice, from the session state any page loads (collection.js mountGift).
let shown = '';
function showGiftNotice(state) {
  const gifts = state?.gifts ?? [];
  const id = gifts.map((g) => g.at).join(',');
  if (!gifts.length) { document.querySelector('.gift-notice')?.remove(); shown = ''; return; }
  if (id === shown) return;
  shown = id;
  document.querySelector('.gift-notice')?.remove();
  const notes = gifts.map((g) => g.note).filter(Boolean);
  const box = document.createElement('aside');
  box.className = 'gift-notice';
  box.setAttribute('role', 'status');
  const from = (g) => (g.from ? (g.fromName ?? `Player ${g.from}`) : 'Fav');
  box.innerHTML = `<strong>${gifts.map((g) => `${esc(from(g))} sent you ${esc(giftLabel(g))}`).join(', ')}</strong>
    ${notes.map((n) => `<q>${esc(n)}</q>`).join('')}
    <div><button type="button" data-gift-open>View gifts</button><button type="button" class="link-btn" data-gift-dismiss>Dismiss</button></div>`;
  document.body.append(box);
  const seen = () => { box.remove(); collectionAction('gifts-seen').catch(() => {}); };
  box.querySelector('[data-gift-dismiss]').onclick = seen;
  box.querySelector('[data-gift-open]').onclick = async () => {
    const tab=gifts.some(g=>(g.kind??'pack')==='pack')?'packs':'collection';
    seen();
    const {openCollection}=await import('./collection.js');
    await openCollection({tab});
  };
}
addEventListener('collection-change', (e) => showGiftNotice(e.detail.state));
