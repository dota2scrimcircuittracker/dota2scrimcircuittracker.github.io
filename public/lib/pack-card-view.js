// Winter pack cards as a profile shows them (parts/pack-cards.js): which saved designs are
// nominated, the rarity each holds right now (or froze at on Thanksgiving), and the chip text.
// Pure: res is the public /player-cards answer (lib/cosmetics.js playerCards).
import { assignSlots, votesFromCounts } from "./player-cards.js";
import { RATINGS, designKey } from "./card-ratings.js";

export const rarityLabel = (r) => r[0].toUpperCase() + r.slice(1);

// res: { locked, designs: [{ slot, main, savedAt, self, counts }], slots? }. designs: the profile's
// saved designs by slot (to spot a frozen slot redesigned since).
// -> { locked, cards: Map(slot -> { main, rarity, self, changed }), count, defaultCommon }
export function packCardView(res, designs = []) {
  const cards = new Map();
  if (res?.locked) {
    for (const r of RATINGS) {
      const x = res.slots?.[r];
      if (!x || typeof x !== "object") continue;
      const now = designs[x.slot];
      cards.set(x.slot, { main: x.main ?? null, rarity: r, self: null, changed: !now || designKey(now) !== x.designKey });
    }
    return { locked: true, cards, count: cards.size, defaultCommon: res.slots?.common === "default" };
  }
  const list = res?.designs ?? [];
  const seats = assignSlots(list.map((x) => ({ slot: x.slot, votes: votesFromCounts(x.counts), self: x.self, savedAt: x.savedAt })));
  for (const x of list) {
    cards.set(x.slot, { main: x.main, rarity: RATINGS.find((r) => seats[r] === x.slot) ?? null, self: x.self ?? null, changed: false });
  }
  return { locked: false, cards, count: cards.size, defaultCommon: seats.common === "default" };
}

// The chip on a nominated card. The owner's own footer says "Winter"; everyone else sees
// "Winter pack card" so voters know the vote counts. Frozen rarities drop "now".
export function chipText({ rarity, changed }, { locked, own }) {
  const head = locked || own ? "Winter" : "Winter pack card";
  if (!rarity) return `${head} · not in a pack slot right now`;
  return `${head} · ${rarityLabel(rarity)}${locked ? "" : " now"}${locked && changed ? " (design changed since)" : ""}`;
}

// The owner's strip above their cards.
export function stripText(view, { max, closesText }) {
  if (view.locked) return "Winter pack cards are locked.";
  return `Winter pack cards · ${view.count} of ${max} chosen · Voting closes ${closesText}`;
}

// The full nomination list the Worker's pack-cards action takes, after one change.
// change: { slot, main } to add or restat, or { slot, remove: true }.
export function nextPackCards(cards, change) {
  const list = [...cards].map(([slot, c]) => ({ slot, main: c.main }));
  const at = list.findIndex((c) => c.slot === change.slot);
  if (change.remove) return list.filter((c) => c.slot !== change.slot);
  if (at >= 0) list[at] = { slot: change.slot, main: change.main };
  else list.push({ slot: change.slot, main: change.main });
  return list;
}
