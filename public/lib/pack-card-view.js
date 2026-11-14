// Winter pack cards as a profile shows them (parts/pack-cards.js): which saved designs are pack
// cards (lib/pack-card-list.js: the first four designs unless the owner swapped), the rarity each
// holds right now (or froze at on Thanksgiving), the arcana 5th card, and the chip text.
// Pure: res is the public /player-cards answer (workers/steam-auth/src/cosmetics.js).
import { assignSlots, votesFromCounts } from "./player-cards.js";
import { RATINGS, designKey } from "./card-ratings.js";
import { packCardList } from "./pack-card-list.js";

export const rarityLabel = (r) => r[0].toUpperCase() + r.slice(1);

// res: { locked, designs: [{ slot, main, savedAt, self, counts }], arcana: { slot, main } | null, slots? }.
// designs: the profile's saved designs by slot (to re-check the list, and spot a frozen slot
// redesigned since).
// -> { locked, cards: Map(slot -> { main, rarity, self, changed }), order: [slot] (the four, in order),
//      arcana: { slot, main, rarity: "arcana", changed } | null, count, defaultCommon }
export function packCardView(res, designs = []) {
  const cards = new Map();
  if (res?.locked) {
    const order = [];
    for (const r of RATINGS) {
      const x = res.slots?.[r];
      if (!x || typeof x !== "object") continue;
      cards.set(x.slot, { main: x.main ?? null, rarity: r, self: null, changed: changedSince(designs, x) });
      order.push(x.slot);
    }
    const a = res.slots?.arcana;
    const arcana = a && typeof a === "object" ? { slot: a.slot, main: a.main ?? null, rarity: "arcana", changed: changedSince(designs, a) } : null;
    return { locked: true, cards, order, arcana, count: cards.size, defaultCommon: res.slots?.common === "default" };
  }
  const rows = new Map((res?.designs ?? []).map((x) => [x.slot, x]));
  // The Worker's list, run through the same rules against the designs this page shows.
  const list = designs.length
    ? packCardList({ cardDesigns: designs, packCards: res?.designs ?? [], packArcana: res?.arcana ?? null })
    : { voted: (res?.designs ?? []).map((x) => ({ slot: x.slot, main: x.main ?? null })), arcana: res?.arcana ?? null };
  const seats = assignSlots(list.voted.map((c, i) => {
    const x = rows.get(c.slot);
    return { slot: c.slot, votes: votesFromCounts(x?.counts), self: x?.self ?? null, savedAt: x?.savedAt ?? i };
  }));
  for (const c of list.voted) {
    cards.set(c.slot, { main: c.main, rarity: RATINGS.find((r) => seats[r] === c.slot) ?? null, self: rows.get(c.slot)?.self ?? null, changed: false });
  }
  const arcana = list.arcana ? { slot: list.arcana.slot, main: list.arcana.main ?? null, rarity: "arcana", changed: false } : null;
  return { locked: false, cards, order: list.voted.map((c) => c.slot), arcana, count: cards.size, defaultCommon: seats.common === "default" };
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

// The owner's strip above their cards.
export function stripText(view, { closesText }) {
  if (view.locked) return "Winter pack cards are locked.";
  return `Winter pack cards · Voting closes ${closesText}`;
}

// What the Worker's pack-cards action takes after one change: the full list of four, each with
// its stat, plus the arcana card when that's what changed. Sending it stores the owner's choice.
const votedList = (view) => view.order.map((slot) => ({ slot, main: view.cards.get(slot)?.main ?? null }));
// A new main stat for one pack card (one of the four, or the arcana card).
export function withMain(view, slot, main) {
  if (view.arcana?.slot === slot && !view.cards.has(slot)) return { cards: votedList(view), arcana: { slot, main } };
  return { cards: votedList(view).map((c) => (c.slot === slot ? { slot, main } : c)) };
}
// A design that sits out takes the place of one of the four (replace: that one's slot), default stat.
export function swapIn(view, slot, replace) {
  return { cards: votedList(view).map((c) => (c.slot === replace ? { slot, main: null } : c)) };
}
// Another arcana design becomes the arcana card, default stat.
export const swapArcana = (view, slot) => ({ cards: votedList(view), arcana: { slot, main: null } });
