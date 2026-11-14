import { test } from "node:test";
import assert from "node:assert/strict";
import { packCardView, chipText, stripText, withMain, withArcanaMain, swapIn, swapTargets, lockable, arcanaPlaceText } from "../public/lib/pack-card-view.js";
import { designKey } from "../public/lib/card-ratings.js";
import { DEFAULT_EQUIPMENT } from "../public/lib/cosmetics-catalog.js";
import { WINTER } from "../public/lib/winter.js";

const counts = (o) => ({ common: 0, rare: 0, epic: 0, legendary: 0, ...o });
const live = { locked: false, designs: [
  { slot: 0, main: "kills", savedAt: 1, self: null, counts: counts({ epic: 3 }) },
  { slot: 2, main: "gpm", savedAt: 2, self: "rare", counts: counts({ epic: 1 }) },
] };

test("live view: nominated slots, their rarity now, and the default common", () => {
  const v = packCardView(live);
  assert.equal(v.locked, false);
  assert.equal(v.count, 2);
  assert.deepEqual([...v.cards.keys()].sort(), [0, 2]);
  assert.equal(v.cards.get(2).rarity, "epic"); // the owner's own rating orders the contest
  assert.equal(v.cards.get(0).rarity, "rare"); // the other moves down
  assert.equal(v.cards.get(2).self, "rare");
  assert.equal(v.defaultCommon, true);
  assert.equal(packCardView({ locked: false, designs: [] }).count, 0);
});

test("locked view reads the frozen slots and spots a redesigned slot", () => {
  const d0 = { hue: 10 }, d1 = { hue: 20 };
  const res = { locked: true, designs: [], slots: { common: "default", rare: null, epic: { slot: 1, main: "gpm", designKey: designKey(d1) }, legendary: { slot: 0, main: "kills", designKey: "old" } } };
  const v = packCardView(res, [d0, d1]);
  assert.equal(v.locked, true);
  assert.equal(v.count, 2);
  assert.deepEqual(v.cards.get(0), { main: "kills", rarity: "legendary", self: null, changed: true });
  assert.equal(v.cards.get(1).changed, false);
  assert.equal(v.defaultCommon, true);
});

test("chip text for the owner, visitors and after the lock", () => {
  assert.equal(chipText({ rarity: "epic" }, { locked: false, own: true }), "Winter · Epic now");
  assert.equal(chipText({ rarity: "epic" }, { locked: false, own: false }), "Winter pack card · Epic now");
  assert.equal(chipText({ rarity: "legendary" }, { locked: true, own: false }), "Winter · Legendary");
  assert.equal(chipText({ rarity: "legendary", changed: true }, { locked: true, own: true }), "Winter · Legendary (design changed since)");
  assert.equal(chipText({ rarity: null }, { locked: false, own: true }), "Winter · not in a pack slot right now");
});

test("strip text", () => {
  assert.equal(stripText({ locked: false, count: 2 }, { closesText: "Thanksgiving, Nov 26" }), "Winter pack cards · Voting closes Thanksgiving, Nov 26");
  assert.equal(stripText({ locked: true, count: 2 }, { closesText: "x" }), "Winter pack cards are locked.");
});

const d = (hue, extra = {}) => ({ ...DEFAULT_EQUIPMENT, hue, ...extra });
const twin = d(9, { twin: { turn: "flip", design: d(10) } });
const cupCard = (entry, category, place, main = null) => ({ entry, key: `k${entry}`, design: d(30 + place), main, category, place });

test("live view: a twin design is one of the four; arcana cards are the Cup podium list, never a slot", () => {
  const designs = [d(1), twin, d(2), d(3), d(4), d(5)];
  const res = { locked: false, designs: [0, 1, 2, 3].map((slot, i) => ({ slot, main: null, savedAt: i, self: null, counts: counts({}) })), arcana: [cupCard("7-1", "funny", 0, "gpm"), cupCard("7-2", "artistic", 2)], locks: [1] };
  const v = packCardView(res, designs);
  assert.deepEqual(v.order, [0, 1, 2, 3]);
  assert.equal(v.cards.has(1), true);
  assert.deepEqual(v.arcana.map((a) => [a.entry, a.main, a.rarity]), [["7-1", "gpm", "arcana"], ["7-2", null, "arcana"]]);
  assert.deepEqual([...v.locks], [1]);
  assert.equal(chipText(v.arcana[0], { locked: false, own: true }), "Winter · Arcana");
  assert.equal(chipText(v.arcana[0], { locked: false, own: false }), "Winter · Arcana");
  assert.equal(arcanaPlaceText(v.arcana[0]), "Arcana Cup · Funny · 1st");
  assert.equal(arcanaPlaceText(v.arcana[1]), "Arcana Cup · Artistic · 3rd");
  // No arcana or locks in the answer (an older Worker): empty.
  const bare = packCardView({ locked: false, designs: [] });
  assert.deepEqual(bare.arcana, []); assert.equal(bare.locks.size, 0);
});

test("locked view includes the arcana cards from the Cup", () => {
  const res = { locked: true, slots: { common: "default", rare: null, epic: null, legendary: { slot: 0, main: null, designKey: designKey(d(1)) } }, arcana: [cupCard("7-1", "artistic", 1, "kills")], locks: [] };
  const v = packCardView(res, [d(1), twin]);
  assert.deepEqual(v.arcana.map((a) => [a.entry, a.main, a.place]), [["7-1", "kills", 1]]);
  assert.deepEqual(v.order, [0]);
});

test("payloads: a stat change, a swap and an arcana stat all send the full list of four", () => {
  const designs = [d(1), twin, d(2), d(3), d(4), d(5)];
  const res = { locked: false, designs: [0, 1, 2, 3].map((slot) => ({ slot, main: slot === 2 ? "gpm" : null, counts: counts({}) })), arcana: [cupCard("7-1", "funny", 0)], locks: [2] };
  const v = packCardView(res, designs);
  const four = [{ slot: 0, main: null }, { slot: 1, main: null }, { slot: 2, main: "gpm" }, { slot: 3, main: null }];
  assert.deepEqual(withMain(v, 3, "kills"), { cards: four.map((c) => (c.slot === 3 ? { slot: 3, main: "kills" } : c)) });
  assert.deepEqual(withArcanaMain(v, "7-1", "stuns"), { cards: four, arcana: [{ entry: "7-1", main: "stuns" }] });
  assert.deepEqual(swapIn(v, 5, 1), { cards: four.map((c) => (c.slot === 1 ? { slot: 5, main: null } : c)) });
});

test("locks: locked cards aren't swap targets and can't be locked again; nothing locks once packs open", () => {
  const res = { locked: false, designs: [0, 1, 2, 3].map((slot) => ({ slot, main: null, counts: counts({}) })), locks: [2] };
  const v = packCardView(res, [d(1), d(2), d(3), d(4), d(5)]);
  assert.deepEqual(swapTargets(v), [0, 1, 3]);
  assert.equal(lockable(v, 2, 0, 10), false);
  assert.equal(lockable(v, 1, 0, 10), true);
  assert.equal(lockable(v, 4, 0, 10), false); // sits out
  assert.equal(lockable(v, 1, 10, 10), false);
  // Nothing locks once Winter voting closes on Thanksgiving, though packs haven't opened.
  assert.equal(lockable(v, 1, WINTER.votesCloseAt - 1, WINTER.opensAt), true);
  assert.equal(lockable(v, 1, WINTER.votesCloseAt, WINTER.opensAt), false);
});
