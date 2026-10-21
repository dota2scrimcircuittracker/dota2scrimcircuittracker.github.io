// Gifts from Fav to players. Only the admin account can send them; the Worker checks the
// sender against the verified Steam sign-in, so the button showing in a browser grants nothing.
// The recipient's state keeps unseen gifts in `gifts` until they dismiss the notice.
// A gift is one of: packs (any card rarity, or a loading screen pack), copies of one card item
// (border, finish, signature, name rendering), or one loading screen.
import { NORMAL_PACK_CAP, PACK_INTERVAL_MS } from './cosmetics-engine.js';
import { TIERS, itemByKey } from './cosmetics-catalog.js';
import { THEMED_PACKS, isThemedPack, themedLabel } from './pack-types.js';
import { ALL_SCREENS } from './legendary-screens.js';

export const ADMIN_ACCOUNT = '173365627';
export const MAX_GIFT_PACKS = 10;
export const GIFT_PACKS = [...TIERS, ...THEMED_PACKS, 'screens'];
const MAX_NOTE = 120;
export const isAdmin = account => String(account ?? '') === ADMIN_ACCOUNT;

export function giftPacks(state, { kind = 'pack', tier = 'common', item = null, count = 1, note = '' } = {}, now = Date.now()) {
  const text = String(note ?? '').replace(/\s+/g, ' ').trim();
  if ([...text].length > MAX_NOTE || /[\u0000-\u001f\u007f<>]/.test(text)) throw new Error(`Notes are up to ${MAX_NOTE} characters, plain text.`);
  const record = { kind, count: 1, note: text || null, at: now };
  const next = { ...state };
  if (kind === 'screen') {
    if (!ALL_SCREENS.some((s) => s.id === item)) throw new Error('Choose a loading screen.');
    if ((state.screens ?? []).includes(item)) throw new Error('They already have that loading screen.');
    next.screens = [...(state.screens ?? []), item];
    record.item = item;
  } else {
    if (!Number.isInteger(count) || count < 1 || count > MAX_GIFT_PACKS) throw new Error(`Gift 1 to ${MAX_GIFT_PACKS} at a time.`);
    record.count = count;
    if (kind === 'item') {
      if (!itemByKey(item)) throw new Error('Choose a card item.');
      next.inventory = { ...state.inventory, [item]: (state.inventory?.[item] ?? 0) + count };
      record.item = item;
    } else if (kind === 'pack') {
      if (!GIFT_PACKS.includes(tier)) throw new Error('Choose a pack type.');
      next.packs = [...(state.packs ?? []), ...Array(count).fill(tier)];
      record.tier = tier;
    } else throw new Error('Choose what to gift.');
  }
  next.gifts = [...(state.gifts ?? []), record].slice(-20);
  return next;
}

// One player sending another a pack from their own inventory: the pack leaves the sender's list and
// joins the recipient's, with a notice (gifts) naming who sent it. Unlike Fav's gifts nothing is
// created, so the only limits are what the sender holds and how many they send a day. Returns
// { sender, recipient, pack }; the Worker writes both in one transaction.
export const MAX_SENT_PER_DAY = 5;
export function sendPack(sender, recipient, { index, from, fromName = null, note = '' }, now = Date.now()) {
  const text = String(note ?? '').replace(/\s+/g, ' ').trim();
  if ([...text].length > MAX_NOTE || /[\u0000-\u001f\u007f<>]/.test(text)) throw new Error(`Notes are up to ${MAX_NOTE} characters, plain text.`);
  if (!Number.isInteger(index) || index < 0 || index >= (sender.packs ?? []).length) throw new Error('Choose one of your packs to send.');
  const recent = (sender.sentPackAt ?? []).filter((t) => now - t < 864e5);
  if (recent.length >= MAX_SENT_PER_DAY) throw new Error(`You can send ${MAX_SENT_PER_DAY} packs a day. Try again tomorrow.`);
  const pack = sender.packs[index], packs = sender.packs.filter((_, i) => i !== index);
  const left = { ...sender, packs, packsSent: (sender.packsSent ?? 0) + 1, sentPackAt: [...recent, now] };
  if (left.nextPackAt == null && packs.filter((p) => p === 'common').length < NORMAL_PACK_CAP) left.nextPackAt = now + PACK_INTERVAL_MS;
  const record = { kind: 'pack', tier: pack, count: 1, note: text || null, at: now, from: String(from), fromName: fromName ?? null };
  return { sender: left, recipient: { ...recipient, packs: [...(recipient.packs ?? []), pack], gifts: [...(recipient.gifts ?? []), record].slice(-20) }, pack };
}

export function clearGifts(state) {
  const { gifts, ...rest } = state;
  return rest;
}

const capital = (s) => s[0].toUpperCase() + s.slice(1);
const article = (s) => `a${/^[aeiou]/i.test(s) ? 'n' : ''} ${s}`;
const ITEM_TYPES = { border: 'border', finish: 'finish', autograph: 'signature', translation: 'modifier' };
// "2 Epic packs" / "a loading screen pack" / "the Gold border" / "the Chemical Rage loading screen"
export function giftLabel({ kind = 'pack', tier, item, count = 1 }) {
  if (kind === 'screen') return `the ${ALL_SCREENS.find((s) => s.id === item)?.label ?? 'new'} loading screen`;
  if (kind === 'item') {
    const it = itemByKey(item), name = `${it?.name ?? 'card'} ${ITEM_TYPES[it?.type] ?? 'item'}`;
    return count === 1 ? `the ${name}` : `${count} × the ${name}`;
  }
  const name = tier === 'screens' ? 'loading screen pack' : isThemedPack(tier) ? themedLabel(tier).toLowerCase() : `${capital(tier)} pack`;
  return count === 1 ? article(name) : `${count} ${name}s`;
}
