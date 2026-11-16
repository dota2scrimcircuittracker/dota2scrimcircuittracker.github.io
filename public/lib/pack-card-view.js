// Winter pack cards as a profile shows them (parts/pack-cards.js): which saved designs are pack
// cards (lib/pack-card-list.js: the first four designs unless the owner swapped), the rarity each
// holds right now (or froze at when cards locked on Mon Nov 23), which are tied, which are locked, the player's arcana cards from
// the Arcana Cup podium, and the chip text.
// Pure: res is the public /player-cards answer (workers/steam-auth/src/cosmetics.js).
import { assignSlots, votesFromCounts } from "./player-cards.js";
import { RATINGS, designKey } from "./card-ratings.js";
import { packCardList } from "./pack-card-list.js";
import { CATEGORIES, placeLabel } from "./arcana-cup.js";
import { beforeLock } from "./winter.js";

export const rarityLabel = (r) => r[0].toUpperCase() + r.slice(1);

// res: { locked, designs: [{ slot, main, savedAt, self, counts }], arcana: [{ entry, key, design,
// main, category, place }], locks: [slot], slots?, tiebreak?, tied?: [slot] }. Once locked, designs
// are the frozen ones (votes as they stood at the lock).
// designs: the profile's saved designs by slot (to re-check the list, and spot a frozen slot
// redesigned since).
// -> { locked, tiebreak, cards: Map(slot -> { main, rarity, self, changed, tied }), order: [slot]
//      (the four, in order), arcana: [{ entry, key, design, main, category, place, rarity: "arcana" }],
//      locks: Set(slot), count, defaultCommon, tiedCount }
export function packCardView(res, designs = []) {
  const cards = new Map();
  const arcana = (Array.isArray(res?.arcana) ? res.arcana : []).map((a) => ({ ...a, main: a.main ?? null, rarity: "arcana" }));
  const locks = new Set(Array.isArray(res?.locks) ? res.locks : []);
  if (res?.locked) {
    const order = [], frozen = new Map((res.designs ?? []).map((x) => [x.slot, x])), tied = new Set(Array.isArray(res.tied) ? res.tied : []);
    for (const r of RATINGS) {
      const x = res.slots?.[r];
      if (!x || typeof x !== "object") continue;
      cards.set(x.slot, { main: x.main ?? null, rarity: r, self: frozen.get(x.slot)?.self ?? null, changed: changedSince(designs, x), tied: tied.has(x.slot) });
      order.push(x.slot);
    }
    return { locked: true, tiebreak: !!res.tiebreak, cards, order, arcana, locks, count: cards.size, defaultCommon: res.slots?.common === "default", tiedCount: order.filter((s) => tied.has(s)).length };
  }
  const rows = new Map((res?.designs ?? []).map((x) => [x.slot, x]));
  // The Worker's list, run through the same rules against the designs this page shows.
  const list = designs.length
    ? packCardList({ cardDesigns: designs, packCards: res?.designs ?? [] })
    : { voted: (res?.designs ?? []).map((x) => ({ slot: x.slot, main: x.main ?? null })) };
  const seats = assignSlots(list.voted.map((c, i) => {
    const x = rows.get(c.slot);
    return { slot: c.slot, votes: votesFromCounts(x?.counts), self: x?.self ?? null, savedAt: x?.savedAt ?? i };
  }));
  for (const c of list.voted) {
    cards.set(c.slot, { main: c.main, rarity: RATINGS.find((r) => seats[r] === c.slot) ?? null, self: rows.get(c.slot)?.self ?? null, changed: false, tied: false });
  }
  return { locked: false, tiebreak: false, tiedCount: 0, cards, order: list.voted.map((c) => c.slot), arcana, locks, count: cards.size, defaultCommon: seats.common === "default" };
}
const changedSince = (designs, x) => { const now = designs[x.slot]; return !now || designKey(now) !== x.designKey; };

// The chip on a pack card. The owner's own footer says "Winter"; everyone else sees
// "Winter pack card" so voters know the vote counts. Frozen rarities drop "now"; arcana is never voted.
export function chipText({ rarity, changed }, { locked, own }) {
  const head = locked || own || rarity === "arcana" ? "Winter" : "Winter pack card";
  if (!rarity) return `${head} · not in a pack slot right now`;
  const now = locked || rarity === "arcana" ? "" : " now";
  return `${head} · ${rarityLabel(rarity)}${now}${locked && changed ? " (design changed since)" : ""}`;
}
// Where an arcana card came from: "Arcana Cup · Funny · 1st".
export const arcanaPlaceText = ({ category, place }) => `Arcana Cup · ${CATEGORIES[category]?.name ?? category} · ${placeLabel(place)}`;

// The owner's strip above their cards.
export function stripText(view, { closesText }) {
  if (view.locked && view.tiedCount && view.tiebreak) return "Winter pack cards are locked · Tied cards: pick a rarity today";
  if (view.locked && view.tiedCount) return "Winter pack cards are locked · Tied cards pick a rarity Wed Nov 25";
  if (view.locked) return "Winter pack cards are locked.";
  return `Winter pack cards · Cards lock ${closesText}`;
}

// What the Worker's pack-cards action takes after one change: always the full list of four, each
// with its stat (a locked card must be sent unchanged). Sending it stores the owner's choice.
const votedList = (view) => view.order.map((slot) => ({ slot, main: view.cards.get(slot)?.main ?? null }));
// A new main stat for one of the four.
export const withMain = (view, slot, main) => ({ cards: votedList(view).map((c) => (c.slot === slot ? { slot, main } : c)) });
// A new main stat for one of the player's arcana cards (by Cup entry id).
export const withArcanaMain = (view, entry, main) => ({ cards: votedList(view), arcana: [{ entry, main }] });
// A design that sits out takes the place of one of the four (replace: that one's slot), default stat.
export function swapIn(view, slot, replace) {
  return { cards: votedList(view).map((c) => (c.slot === replace ? { slot, main: null } : c)) };
}
// The four a sitting-out design can replace: not the locked ones.
export const swapTargets = (view) => view.order.filter((s) => !view.locks.has(s));
// Whether one of the four can still be locked by its owner: before the Winter lock (which freezes
// the four anyway), before packs open, not yet locked.
export const lockable = (view, slot, now, opensAt) => beforeLock(now) && now < opensAt && view.order.includes(slot) && !view.locks.has(slot);
