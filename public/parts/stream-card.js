// Stream card: a player page with ?stream=card shows only that player's card, full size and
// animating, on a transparent page. Casters add the address as an OBS Browser Source.
// Anyone can open the address (cards are public); the "Copy stream link" panel shows only to
// STREAMERS on player profiles.
import { esc } from '../core.js';
import { steamAccount } from '../lib/store.js';
import { ADMIN_ACCOUNT } from '../lib/pack-gifts.js';
import { showBigCard } from './player-card.js';

// Fav and Brown (Champion caster).
export const STREAMERS = new Set([ADMIN_ACCOUNT, '75379546']);
export const isStreamCard = () => new URLSearchParams(location.search).get('stream') === 'card';
export function streamCardUrl(href = location.href) {
  const url = new URL(href);
  const slot = url.searchParams.get('card');
  url.search = /^\d+$/.test(slot ?? '') ? `?stream=card&card=${slot}` : '?stream=card';
  return url.toString();
}

// Opens the profile's main card in the full-size view and keeps it open. &card=<slot> picks one of
// the player's saved designs instead (the profile showcase's data-design-slot); an empty slot falls
// back to the main card. The main card and the showcase render together (parts/collection.js).
export function startStreamCard() {
  document.documentElement.classList.add('stream-card'); // app.js sets it at startup too; the CSS is in style.css
  const slot = new URLSearchParams(location.search).get('card');
  const open = () => {
    if (document.querySelector('dialog.ft-big')) return true;
    const main = document.querySelector('.ft-card .ft-expand')?.closest('.ft-card');
    if (!main) return false;
    const card = (/^\d+$/.test(slot ?? '') && document.querySelector(`.ft-card[data-design-slot="${slot}"]`)) || main;
    showBigCard(card);
    const dlg = document.querySelector('dialog.ft-big');
    dlg?.addEventListener('cancel', (e) => e.preventDefault());
    return !!dlg;
  };
  if (open()) return;
  const watch = new MutationObserver(() => { if (open()) watch.disconnect(); });
  watch.observe(document.body, { childList: true, subtree: true });
}

export async function mountStreamLink(host, name) {
  const me = await steamAccount().catch(() => null);
  if (!STREAMERS.has(String(me ?? '')) || !host.isConnected || host.querySelector('.stream-link-panel')) return;
  const url = streamCardUrl();
  const section = document.createElement('section');
  section.className = 'stream-link-panel panel';
  section.innerHTML = `<h3>Stream card</h3>
    <p class="muted">${esc(name)}'s card alone on a transparent background, animated. In OBS add a Browser Source with this address, width 600, height 840.</p>
    <p><input type="text" readonly value="${esc(url)}" aria-label="Stream card address" style="width:100%"></p>
    <p><button type="button" data-copy>Copy stream link</button> <a href="${esc(url)}" target="_blank" rel="noopener">Open</a> <span class="stream-link-msg" role="status" aria-live="polite"></span></p>`;
  const msg = section.querySelector('.stream-link-msg');
  section.querySelector('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(url); msg.textContent = 'Copied.'; }
    catch { section.querySelector('input').select(); msg.textContent = 'Press Ctrl+C to copy.'; }
  };
  host.append(section);
}
