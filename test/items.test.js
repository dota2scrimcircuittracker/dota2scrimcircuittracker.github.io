import { test } from "node:test";
import assert from "node:assert/strict";
import { itemsFrom, isCore, itemName, itemImg, timingsOf, itemStats, averageTimes, fastestCore, itemIcon, clock, leadAt, itemSwing } from "../public/lib/items.js";

test("core items: built 1000+, Blink and Shard; not parts, consumables or recipes", () => {
  for (const k of ["bfury", "black_king_bar", "power_treads", "blink", "aghanims_shard"]) assert.ok(isCore(k), k);
  for (const k of ["magic_wand", "demon_edge", "tpscroll", "recipe_bfury", "branches", "ward_observer", "nope"]) assert.ok(!isCore(k), k);
});

test("itemsFrom reads final slots and first core purchases in order", () => {
  const p = {
    item_0: 145, item_1: 0, item_2: 1, item_3: 0, item_4: 0, item_5: 0, item_neutral: 0,
    purchase_log: [
      { time: -89, key: "tango" }, { time: 419, key: "power_treads" }, { time: 700, key: "broadsword" },
      { time: 900, key: "bfury" }, { time: 1300, key: "blink" }, { time: 2000, key: "blink" },
    ],
  };
  const { items, item_times } = itemsFrom(p);
  assert.deepEqual(items, ["bfury", null, "blink", null, null, null, null]);
  assert.deepEqual(item_times, ["power_treads", 419, "bfury", 900, "blink", 1300]);
});

test("itemsFrom drops parts built into a later item, but keeps Blink and Scepter", () => {
  const log = (...xs) => ({ purchase_log: xs.map(([key, time]) => ({ key, time })) });
  const { item_times } = itemsFrom(log(["pers", 700], ["bfury", 900], ["yasha", 1000], ["manta", 1200],
    ["blink", 1300], ["ultimate_scepter", 1800], ["lesser_crit", 2000], ["overwhelming_blink", 2400], ["ultimate_scepter_2", 2600]));
  assert.deepEqual(item_times, ["bfury", 900, "manta", 1200, "blink", 1300, "ultimate_scepter", 1800, "lesser_crit", 2000, "overwhelming_blink", 2400, "ultimate_scepter_2", 2600]);
});

test("itemsFrom without a parsed replay gives nulls", () => {
  assert.deepEqual(itemsFrom({ kills: 1 }), { items: null, item_times: null });
});

test("names and icons come from the catalog", () => {
  assert.equal(itemName("bfury"), "Battle Fury");
  assert.match(itemImg("bfury"), /items\/bfury\.png$/);
  assert.equal(itemImg("recipe_bfury").endsWith("/recipe.png"), true);
  assert.match(itemIcon("bfury", 900), /title="Battle Fury · 15:00"/);
  assert.equal(clock(-89), "-1:29");
});

const g = (winner, players) => ({ winner, players });
const pl = (team, hero, item_times) => ({ team, hero, item_times });

test("itemStats: share, average, fastest, win rate", () => {
  const a = pl("a", "Anti-Mage", ["bfury", 900, "manta", 1500]);
  const b = pl("a", "Anti-Mage", ["bfury", 1100]);
  const c = pl("a", "Anti-Mage", null); // unparsed: not counted
  const m1 = g("a", [a]), m2 = g("b", [b]), m3 = g("a", [c]);
  const stats = itemStats([{ p: a, m: m1 }, { p: b, m: m2 }, { p: c, m: m3 }]);
  assert.equal(stats[0].key, "bfury");
  assert.equal(stats[0].n, 2);
  assert.equal(stats[0].share, 1);
  assert.equal(stats[0].avg, 1000);
  assert.equal(stats[0].best.sec, 900);
  assert.equal(stats[0].winRate, 0.5);
  assert.equal(stats[1].key, "manta");
  assert.equal(stats[1].share, 0.5);
});

test("averageTimes per item and per hero; fastestCore picks the biggest lead", () => {
  const ms = [
    g("a", [pl("a", "Anti-Mage", ["bfury", 800]), pl("b", "Axe", ["blink", 600])]),
    g("a", [pl("a", "Anti-Mage", ["bfury", 1200]), pl("b", "Axe", ["blink", 700])]),
  ];
  assert.deepEqual(averageTimes(ms).get("bfury"), { avg: 1000, n: 2 });
  assert.deepEqual(averageTimes(ms, { perHero: true }).get("Axe|blink"), { avg: 650, n: 2 });
  const top = fastestCore(ms, ms, { minSamples: 2 });
  assert.equal(top.key, "bfury");
  assert.equal(top.sec, 800);
  assert.equal(top.ahead, 200);
  assert.equal(fastestCore(ms, ms, { minSamples: 3 }), null);
});

test("fastestCore skips an item the hero rarely builds", () => {
  // Axe: Blink in all 4 games; a Lotus in 1 (early). Lotus is situational, so Blink wins.
  const axe = (t) => g("a", [pl("a", "Axe", t)]);
  const ms = [axe(["blink", 500, "lotus_orb", 600]), axe(["blink", 700]), axe(["blink", 800]), axe(["blink", 800])];
  const lotusLate = [...ms, axe(["lotus_orb", 2400])]; // Lotus in 2 of 5 Axe games
  const top = fastestCore(ms.slice(0, 1), lotusLate, { minSamples: 1 });
  assert.equal(top.key, "blink");
});

test("leadAt interpolates between minutes", () => {
  const adv = [0, 600, 1200];
  assert.equal(leadAt(adv, 90), 900);
  assert.equal(leadAt(adv, 120), 1200);
  assert.equal(leadAt(adv, 121), null);
  assert.equal(leadAt(null, 10), null);
});

test("itemSwing: lead change after minus before, from the buyer's side", () => {
  // Team A's lead: flat at +1000 until 10', then climbs 1000 a minute.
  const adv = [...Array(11).fill(1000), 2000, 3000, 4000, 5000];
  const m = { gold_adv: adv };
  assert.deepEqual(itemSwing(m, "a", 600), { before: 0, after: 3000, swing: 3000 });
  assert.deepEqual(itemSwing(m, "b", 600), { before: 0, after: -3000, swing: -3000 });
  assert.equal(itemSwing(m, "a", 700), null); // window runs past the end
  assert.equal(itemSwing({}, "a", 600), null);
});

test("itemStats averages the swing over games with a lead series", () => {
  const adv = [...Array(11).fill(0), 1000, 2000, 3000, 4000];
  const a = pl("a", "Axe", ["blink", 600]), b = pl("a", "Axe", ["blink", 600]);
  const s = itemStats([{ p: a, m: { winner: "a", players: [a], gold_adv: adv } }, { p: b, m: { winner: "a", players: [b] } }]);
  assert.equal(s[0].swing, 3000);
  assert.equal(s[0].swings, 1);
});

test("timingsOf pairs keys and seconds", () => {
  assert.deepEqual(timingsOf({ item_times: ["bfury", 900] }), [{ key: "bfury", sec: 900 }]);
  assert.deepEqual(timingsOf({}), []);
});
