import { test } from "node:test";
import assert from "node:assert/strict";
import { packCardView, chipText, stripText, withMain, swapIn, swapArcana } from "../public/lib/pack-card-view.js";
import { designKey } from "../public/lib/card-ratings.js";
import { DEFAULT_EQUIPMENT } from "../public/lib/cosmetics-catalog.js";

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

test("live view re-checks the list against the page's designs: order, arcana card, arcana chip", () => {
  const designs = [d(1), twin, d(2), d(3), d(4), d(5)];
  const res = { locked: false, designs: [0, 2, 3, 4].map((slot, i) => ({ slot, main: null, savedAt: i, self: null, counts: counts({}) })), arcana: { slot: 1, main: null } };
  const v = packCardView(res, designs);
  assert.deepEqual(v.order, [0, 2, 3, 4]);
  assert.deepEqual(v.arcana, { slot: 1, main: null, rarity: "arcana", changed: false });
  assert.equal(v.cards.has(1), false);
  assert.equal(chipText(v.arcana, { locked: false, own: true }), "Winter · Arcana");
  assert.equal(chipText(v.arcana, { locked: false, own: false }), "Winter · Arcana");
});

test("locked view includes the frozen arcana card", () => {
  const res = { locked: true, slots: { common: "default", rare: null, epic: null, legendary: { slot: 0, main: null, designKey: designKey(d(1)) }, arcana: { slot: 1, main: "gpm", designKey: designKey(twin) } } };
  const v = packCardView(res, [d(1), twin]);
  assert.deepEqual(v.arcana, { slot: 1, main: "gpm", rarity: "arcana", changed: false });
  assert.deepEqual(v.order, [0]);
});

test("payloads: a stat change, a swap and an arcana swap all send the full list of four", () => {
  const designs = [d(1), twin, d(2), d(3), d(4), d(5), d(6, { finishStack: ["paper"] })];
  const res = { locked: false, designs: [0, 2, 3, 4].map((slot) => ({ slot, main: slot === 2 ? "gpm" : null, counts: counts({}) })), arcana: null };
  const v = packCardView(res, designs);
  assert.deepEqual(withMain(v, 3, "kills"), { cards: [{ slot: 0, main: null }, { slot: 2, main: "gpm" }, { slot: 3, main: "kills" }, { slot: 4, main: null }] });
  assert.deepEqual(withMain(v, 1, "stuns"), { cards: [{ slot: 0, main: null }, { slot: 2, main: "gpm" }, { slot: 3, main: null }, { slot: 4, main: null }], arcana: { slot: 1, main: "stuns" } });
  assert.deepEqual(swapIn(v, 5, 2), { cards: [{ slot: 0, main: null }, { slot: 5, main: null }, { slot: 3, main: null }, { slot: 4, main: null }] });
  assert.deepEqual(swapArcana(v, 6).arcana, { slot: 6, main: null });
});
