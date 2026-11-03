// "New comments on your posts", replies to your comments, @mentions of you or your team, Fav's
// updates and Arcana Cup news (lib/feed.js notices), from the session state any page loads, like
// the pack-gift notice (pack-gifts.js). Each unread notice is its own card in the notice column,
// newest on top. Opening or dismissing a card hides it; once every card is gone the notices are
// marked seen.
import { esc } from '../core.js';
import { collectionAction } from '../lib/cosmetics.js';
import { unreadNotices } from '../lib/feed.js';
import { steamName } from './me.js';
import { pushCard } from './notice-stack.js';

const KINDS = ['comment', 'reply', 'mention', 'announce', 'cup'];
const SHOWN_MAX = 4; // older ones fold into "N more"
// Cards hidden this visit, by notice time, until the rest are seen too.
const hidden = new Set();
let shown = '';
const hoursLeft = (at) => { const h = Math.round((at - Date.now()) / 36e5); return h >= 1 ? `${h} hour${h === 1 ? '' : 's'} left` : 'closing soon'; };
const title = (n) => {
  if (n.kind === 'cup') return `Arcana Cup${n.closesAt > Date.now() ? ` · ${hoursLeft(n.closesAt)}` : ''}`;
  const from = n.fromName ?? steamName(Number(n.from)) ?? 'Someone';
  return `${from} ${{ reply: 'replied to your comment', mention: 'mentioned you', announce: 'posted an update' }[n.kind] ?? 'commented on your post'}`;
};
function showCommentNotice(state) {
  const unread = unreadNotices(state).filter((n) => KINDS.includes(n.kind) && !hidden.has(n.at));
  const id = unread.map((n) => n.at).join(',');
  if (id === shown) return;
  shown = id;
  document.querySelectorAll('.comment-notice').forEach((b) => b.remove());
  if (!unread.length) return;
  const cards = unread.slice(-SHOWN_MAX), more = unread.length - cards.length;
  const done = () => { if (!document.querySelector('.comment-notice')) { hidden.clear(); shown = ''; collectionAction('notices-seen').catch(() => {}); } };
  for (const n of cards) {
    const box = document.createElement('aside');
    box.className = `gift-notice comment-notice${n.kind === 'cup' ? ' cup-notice' : ''}`;
    box.setAttribute('role', 'status');
    box.innerHTML = `<strong>${esc(title(n))}</strong>
      <q>${esc(n.text)}</q>
      ${n === cards[0] && more ? `<small>${more} older notification${more === 1 ? '' : 's'}</small>` : ''}
      <div><button type="button" data-notice-open>${n.kind === 'cup' ? 'Vote' : 'View'}</button><button type="button" class="link-btn" data-notice-dismiss>Dismiss</button></div>`;
    pushCard(box); // the newest ends up on top
    const hide = () => { hidden.add(n.at); if (n === cards[0]) unread.slice(0, more).forEach((o) => hidden.add(o.at)); box.remove(); done(); };
    box.querySelector('[data-notice-dismiss]').onclick = hide;
    box.querySelector('[data-notice-open]').onclick = async () => {
      hide();
      const { openCollection } = await import('./collection.js');
      await openCollection(n.kind === 'cup' ? { tab: 'cup' } : { tab: 'feed', focus: n.post });
    };
  }
}
addEventListener('collection-change', (e) => showCommentNotice(e.detail.state));
