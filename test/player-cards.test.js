import { test } from "node:test";
import assert from "node:assert/strict";
import { assignSlots, mainPositions, votesFromCounts } from "../public/lib/player-cards.js";
import { tally } from "../public/lib/card-ratings.js";

const v = (...ratings) => Object.fromEntries(ratings.map((r, i) => [`voter${i}`, r]));
const d = (slot, votes, self = null, savedAt = slot) => ({ slot, votes, self, savedAt });

test("no designs: default common only", () => {
  assert.deepEqual(assignSlots([]), { common: "default", rare: null, epic: null, legendary: null });
});
test("one design voted epic: epic + default common", () => {
  assert.deepEqual(assignSlots([d(0, v("epic"))]), { common: "default", rare: null, epic: 0, legendary: null });
});
test("one design voted common: their common, no default", () => {
  assert.deepEqual(assignSlots([d(2, v("common", "common"))]), { common: 2, rare: null, epic: null, legendary: null });
});
test("two voted rare: owner's higher pick stays rare, the other drops to common", () => {
  assert.deepEqual(assignSlots([d(0, v("rare"), "rare"), d(1, v("rare"), "epic")]), { common: 0, rare: 1, epic: null, legendary: null });
});
test("two voted epic with rare and common taken: the owner's favourite goes up", () => {
  // The spec's example: A and B voted epic, owner rated A legendary -> A legendary, B epic.
  const r = assignSlots([d(0, v("epic"), "legendary"), d(1, v("epic"), "epic"), d(2, v("rare")), d(3, v("common"))]);
  assert.deepEqual(r, { common: 3, rare: 2, epic: 1, legendary: 0 });
});
test("loser moves up when nothing below is open", () => {
  const r = assignSlots([d(0, v("common"), "rare"), d(1, v("common"), "common")]);
  assert.deepEqual(r, { common: 1, rare: 0, epic: null, legendary: null });
});
test("owner's rating never lifts a design over one with a higher voted rarity", () => {
  const r = assignSlots([d(0, v("common"), "legendary"), d(1, v("epic"), "common")]);
  assert.equal(r.epic, 1); assert.equal(r.common, 0);
});
test("no votes: the owner's rating stands in; neither: common", () => {
  assert.deepEqual(assignSlots([d(0, {}, "legendary"), d(1, {}, null)]), { common: 1, rare: null, epic: null, legendary: 0 });
});
test("equal owner ratings: higher community score, then the older design", () => {
  const r = assignSlots([d(0, v("rare", "rare"), "rare", 5), d(1, v("rare", "legendary", "rare"), "rare", 9)]);
  assert.equal(r.rare, 1);
  const s = assignSlots([d(0, v("rare"), "rare", 5), d(1, v("rare"), "rare", 2)]);
  assert.equal(s.rare, 1);
});
test("four designs fill one of each", () => {
  const r = assignSlots([d(0, v("legendary"), "common"), d(1, v("legendary"), "legendary"), d(2, v("legendary"), "rare"), d(3, v("legendary"), "epic")]);
  assert.deepEqual(r, { common: 0, rare: 2, epic: 3, legendary: 1 });
});
test("a lower-voted design never ends above a higher-voted one, even with two ties", () => {
  const all = { common: 3, rare: 2, epic: 1, legendary: 0 };
  assert.deepEqual(assignSlots([d(0, v("epic"), "legendary"), d(1, v("epic"), "common"), d(2, v("common"), "legendary"), d(3, v("common"), "common")]), all);
  assert.deepEqual(assignSlots([d(0, v("epic"), "legendary"), d(1, v("epic"), "common"), d(2, v("rare"), "legendary"), d(3, v("rare"), "common")]), all);
});
test("an unknown self rating counts as no self rating", () => {
  assert.deepEqual(assignSlots([d(0, {}, "mythic")]), { common: 0, rare: null, epic: null, legendary: null });
});

test("main position: the position played most, stand-in rows skipped", () => {
  const games = [1, 1, 3].map((pos, i) => ({ id: i, players: [{ account_id: 7, position: pos, standin: false }, { account_id: 8, position: 5, standin: true }] }));
  assert.deepEqual(Object.fromEntries(mainPositions(games)), { 7: 1 });
});

test("votesFromCounts: stand-in votes tally to the same counts and pick", () => {
  const counts = { common: 1, rare: 2, epic: 2, legendary: 0 };
  const votes = votesFromCounts(counts);
  assert.equal(Object.keys(votes).length, 5);
  assert.deepEqual(tally(votes), { counts, total: 5, pick: "epic" });
  assert.deepEqual(votesFromCounts(undefined), {});
});
test("votesFromCounts: assignSlots gives the same seats as raw votes", () => {
  const raw = [d(0, v("rare", "rare", "epic")), d(1, v("rare")), d(2, v("legendary", "common"))];
  const fromCounts = raw.map((x) => ({ ...x, votes: votesFromCounts(tally(x.votes).counts) }));
  assert.deepEqual(assignSlots(fromCounts), assignSlots(raw));
});

test("selfDecides: tied when the owner's rating can change the slots", async () => {
  const { selfDecides } = await import("../public/lib/player-cards.js");
  const v = (r, n = 1) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${r}${i}`, r]));
  const designs = [
    { slot: 0, votes: v("legendary"), self: null, savedAt: 1 },
    { slot: 1, votes: v("epic"), self: null, savedAt: 2 },
    { slot: 2, votes: v("epic"), self: null, savedAt: 3 },
  ];
  assert.equal(selfDecides(designs, 0), false); // alone at legendary: votes decide
  assert.equal(selfDecides(designs, 1), true);  // shares epic with slot 2
  assert.equal(selfDecides(designs, 2), true);
  assert.equal(selfDecides(designs, 9), false); // not one of the designs
  // A design with no votes takes its owner's rating: tied.
  assert.equal(selfDecides([{ slot: 0, votes: {}, self: null, savedAt: 1 }], 0), true);
});
