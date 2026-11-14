import { test } from "node:test";
import assert from "node:assert/strict";
import { arcanaCards, podium, placeLabel, buildBracket, placings } from "../public/lib/arcana-cup.js";

const e = (id, account, category, extra = {}) => ({ id, account, category, key: `k-${id}`, design: { hue: id.length }, ...extra });

test("arcana cards: the top 3 of each settled bracket, 6 in all, with each entry's owner and frozen design", () => {
  const artistic = [e("11-1", "11", "artistic"), e("12-1", "12", "artistic"), e("11-2", "11", "artistic"), e("13-1", "13", "artistic")];
  const funny = [e("21-1", "21", "funny"), e("22-1", "22", "funny"), e("23-1", "23", "funny"), e("24-1", "24", "funny"), e("25-1", "25", "funny")];
  const cards = arcanaCards({
    artistic: { order: ["11-1", "12-1", "11-2", "13-1"], entries: artistic },
    funny: { order: ["22-1", "21-1", "24-1", "23-1", "25-1"], entries: funny },
  });
  assert.equal(cards.length, 6);
  assert.deepEqual(cards.map((c) => [c.category, c.place, c.entry, c.account]), [
    ["artistic", 0, "11-1", "11"], ["artistic", 1, "12-1", "12"], ["artistic", 2, "11-2", "11"],
    ["funny", 0, "22-1", "22"], ["funny", 1, "21-1", "21"], ["funny", 2, "24-1", "24"],
  ]);
  assert.deepEqual(cards[0], { entry: "11-1", account: "11", key: "k-11-1", design: { hue: 4 }, category: "artistic", place: 0 });
  // One owner, two podium entries: two arcana cards.
  assert.equal(cards.filter((c) => c.account === "11").length, 2);
});

test("arcana cards: an unsettled bracket has none; removed entries never place", () => {
  const entries = [e("1-1", 1, "artistic"), e("2-1", 2, "artistic", { removed: 5 }), e("3-1", 3, "artistic"), e("4-1", 4, "artistic")];
  assert.deepEqual(arcanaCards({ artistic: { order: null, entries }, funny: { order: null, entries: [] } }), []);
  assert.deepEqual(arcanaCards({}), []);
  assert.deepEqual(arcanaCards(undefined), []);
  // Removed 2nd: 3rd and 4th move up, as with the Cup's prize packs.
  assert.deepEqual(arcanaCards({ artistic: { order: ["1-1", "2-1", "3-1", "4-1"], entries } }).map((c) => [c.entry, c.place, c.account]), [["1-1", 0, "1"], ["3-1", 1, "3"], ["4-1", 2, "4"]]);
  assert.deepEqual(podium(null, entries), []);
  assert.deepEqual(podium(["1-1", "3-1"], entries).map((x) => x.id), ["1-1", "3-1"]);
});

test("arcana cards from a settled bracket: placings, then the podium", () => {
  const cup = { votingAt: 0, roundMs: 1, firstRoundMs: 1 };
  const r = (winner, loser) => ({ winner, loser, votes: {} });
  const results = { "w0-0": r("a", "b"), "w0-1": r("c", "d"), "w1-0": r("a", "c"), "l0-0": r("b", "d"), "l1-0": r("b", "c"), gf: r("a", "b") };
  const order = placings(buildBracket(["a", "b", "c", "d"], results, cup));
  const entries = ["a", "b", "c", "d"].map((id, i) => e(id, 100 + i, "funny"));
  assert.deepEqual(arcanaCards({ funny: { order, entries } }).map((c) => c.entry), ["a", "b", "c"]);
  assert.equal(placeLabel(0), "1st"); assert.equal(placeLabel(2), "3rd");
});
