import { test } from "node:test";
import assert from "node:assert/strict";
import { packCardView, chipText, stripText, nextPackCards } from "../public/lib/pack-card-view.js";
import { designKey } from "../public/lib/card-ratings.js";

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
  assert.equal(stripText({ locked: false, count: 2 }, { max: 4, closesText: "Thanksgiving, Nov 26" }), "Winter pack cards · 2 of 4 chosen · Voting closes Thanksgiving, Nov 26");
  assert.equal(stripText({ locked: true, count: 2 }, { max: 4, closesText: "x" }), "Winter pack cards are locked.");
});

test("nextPackCards sends the full list after one change", () => {
  const cards = packCardView(live).cards;
  assert.deepEqual(nextPackCards(cards, { slot: 3, main: "stuns" }), [{ slot: 0, main: "kills" }, { slot: 2, main: "gpm" }, { slot: 3, main: "stuns" }]);
  assert.deepEqual(nextPackCards(cards, { slot: 2, main: "kills" }), [{ slot: 0, main: "kills" }, { slot: 2, main: "kills" }]);
  assert.deepEqual(nextPackCards(cards, { slot: 0, remove: true }), [{ slot: 2, main: "gpm" }]);
});
