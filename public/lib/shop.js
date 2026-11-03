// The token shop (Gallery's Shop tab, parts/shop.js). NOT RELEASED: the tab shows only on a local
// dev host, and the Worker refuses every shop action unless its SHOP_ENABLED variable is "on".
// Tokens are bought through Stripe Checkout in fixed bundles, more per dollar in the bigger ones; the
// Worker makes the checkout with the player's account on it, so payments credit themselves. Card items are sold
// directly at a fixed price by rarity, never in random packs. Loading screens (Valve's art) are
// never sold. Copies bought with tokens can't be recycled, since recycling rolls a random pack.
import { CATALOG, itemByKey, TIERS } from './cosmetics-catalog.js';
import { slotCount, cardDesignState, grantArcana } from './cosmetics-engine.js';

export const BUNDLES = [{ dollars: 5, tokens: 10 }, { dollars: 10, tokens: 25 }, { dollars: 20, tokens: 55 }, { dollars: 30, tokens: 85 }];
export const bundleFor = (dollars) => BUNDLES.find((b) => b.dollars === Number(dollars)) ?? null;
// How many more tokens a bundle gives than the same money in the smallest one, in percent.
export const bundleBonus = (b) => Math.round((b.tokens / b.dollars / (BUNDLES[0].tokens / BUNDLES[0].dollars) - 1) * 100);
export const PRICES = { common: 1, rare: 3, epic: 5, legendary: 10 };
// Commissioned items (catalog `commission: true`) go in packs, never on sale here.
export const SHOP_ITEMS = CATALOG.filter((i) => PRICES[i.rarity] != null && !i.commission);
// DRAFT prices Fav hasn't settled: an extra card design slot, up to MAX_EXTRA_SLOTS of them.
export const SLOT_PRICE = 10, MAX_EXTRA_SLOTS = 3;
// DRAFT: an arcana card (lib/cosmetics-engine.js grantArcana), with the sealed Double finish if it's the first.
export const ARCANA_PRICE = 30;
// Commissions: Fav designs it with you. single = one signature style, border or finish;
// team = a border, finish and team signature, a copy to each player on the team, then into packs.
export const COMMISSIONS = { single: { price: 15, picks: ['autograph', 'border', 'finish'] }, team: { price: 30 } };
const MAX_NOTE = 300, MAX_TEAM = 60;

export { shopVisible } from './shop-flag.js';

export const priceOf = (key) => PRICES[itemByKey(key)?.rarity] ?? null;

// The tokens a paid checkout buys: one bundle exactly, in US cents. Anything else buys none.
export function tokensForPayment(cents, currency = 'usd') {
  if (String(currency).toLowerCase() !== 'usd' || !Number.isSafeInteger(cents)) return 0;
  return BUNDLES.find((b) => b.dollars * 100 === cents)?.tokens ?? 0;
}

export function creditTokens(state, tokens, txId) {
  if (!Number.isSafeInteger(tokens) || tokens < 1) throw new Error('Nothing to credit.');
  if (!txId) throw new Error('Missing payment ID.');
  if (state.tokenPayments?.includes(txId)) return state;
  // Anyone who has bought tokens is a supporter; whether the badge shows is theirs to choose.
  return { ...state, tokens: (state.tokens ?? 0) + tokens, tokenPayments: [...(state.tokenPayments ?? []), txId], supporter: true };
}

const spend = (state, price) => {
  if ((state.tokens ?? 0) < price) throw new Error(`You need ${price} token${price === 1 ? '' : 's'}.`);
  return { ...state, tokens: state.tokens - price };
};
const plainText = (raw, max, what) => {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if ([...text].length > max) throw new Error(`${what} is up to ${max} characters.`);
  if (/[<>]/.test(text)) throw new Error(`${what} can't use < or >.`);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw new Error(`${what} is plain text only.`);
  return text;
};
// A bought copy goes into `bought` too, so it can't be recycled.
const addCopy = (state, key) => ({ ...state, inventory: { ...state.inventory, [key]: (state.inventory?.[key] ?? 0) + 1 }, bought: { ...(state.bought ?? {}), [key]: (state.bought?.[key] ?? 0) + 1 } });
const forSale = (key) => {
  const price = priceOf(key);
  if (price == null || !SHOP_ITEMS.some((i) => i.key === key)) throw new Error('That item is not for sale.');
  return price;
};

export function buyArcana(state, random = Math.random) {
  const got = grantArcana(spend(state, ARCANA_PRICE), random);
  return { ...got, price: ARCANA_PRICE };
}

export function buyItem(state, key) {
  const price = forSale(key);
  return { state: addCopy(spend(state, price), key), item: key, price };
}

// Buying a card for another player: the tokens leave the buyer, the copy joins the recipient with a
// gift notice (parts/pack-gifts.js) naming who sent it.
export function giftItem(sender, recipient, { key, from, fromName = null, note = '' }, now = Date.now()) {
  const price = forSale(key), text = plainText(note, 120, 'A note');
  const record = { kind: 'item', item: key, count: 1, note: text || null, at: now, from: String(from), fromName: fromName ?? null };
  const got = addCopy(recipient, key);
  return { sender: spend(sender, price), recipient: { ...got, gifts: [...(recipient.gifts ?? []), record].slice(-20) }, price };
}

export const extraSlots = (state) => state?.extraSlots ?? 0;
export function buySlot(state) {
  if (extraSlots(state) >= MAX_EXTRA_SLOTS) throw new Error(`You have all ${MAX_EXTRA_SLOTS} extra card slots.`);
  // A profile order the player set keeps its shape, with the new slot at the end.
  const n = slotCount(state), order = cardDesignState(state).cardOrder;
  return { state: { ...spend(state, SLOT_PRICE), extraSlots: extraSlots(state) + 1, cardOrder: [...order, n] }, price: SLOT_PRICE };
}

// Where a supporter shows their badge: on their profile, on their cards, both or neither.
export { supporterShown } from './cosmetics-engine.js';
export function setSupporterBadge(state, { profile, card }) {
  if (!state.supporter) throw new Error('The badge comes with your first token purchase.');
  if (typeof profile !== 'boolean' || typeof card !== 'boolean') throw new Error('Choose where the badge shows.');
  return { ...state, supporterBadge: { profile, card } };
}

// A commission order. Tokens are taken now; Fav makes it with the player, then marks it done or
// refunds it. Returns the order to store beside the new state.
export function orderCommission(state, { kind, pick = null, team = '', note = '' }, now = Date.now()) {
  const c = COMMISSIONS[kind];
  if (!c) throw new Error('Choose a commission.');
  if (kind === 'single' && !c.picks.includes(pick)) throw new Error('Choose a signature style, border or finish.');
  const teamName = kind === 'team' ? plainText(team, MAX_TEAM, 'A team name') : null;
  if (kind === 'team' && !teamName) throw new Error('Choose your team.');
  const order = { kind, pick: kind === 'single' ? pick : null, team: teamName, note: plainText(note, MAX_NOTE, 'A note') || null, price: c.price, at: now, status: 'open' };
  return { state: spend(state, c.price), order };
}
export const refundCommission = (state, order) => ({ ...state, tokens: (state.tokens ?? 0) + order.price });

// Copies that can go into a recycle: all but the last one, and none bought with tokens.
export const recyclable = (state, key) => Math.max(0, (state.inventory?.[key] ?? 0) - 1 - (state.bought?.[key] ?? 0));

// Cheapest first, then catalog order.
export const SHOP_ORDER = [...SHOP_ITEMS].sort((a, b) => TIERS.indexOf(a.rarity) - TIERS.indexOf(b.rarity));
