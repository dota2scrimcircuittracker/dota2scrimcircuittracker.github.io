import { test } from "node:test";
import assert from "node:assert/strict";
import { heroIdOf, positionPools, gridConfig, mergeGrid, configName, heroSources, templateRows, layoutConfig, columnConfig, boxHeroes, addToBox, dropFromBox, placeHero, placeRows, freezeLayout, placedConfig, fitIcons, freeSpot, TEMPLATES } from "../public/lib/herogrid.js";
import { HEROES } from "../public/lib/heroes.js";

const pl = (team, name, hero, position) => ({ team, name, hero, position });
const game = (winner, start_time, a) => ({ m: { winner, start_time, players: [...a, pl("b", "Enemy", "Axe", 1)] }, side: "a" });

test("heroIdOf: every hero the site knows has a Dota id", () => {
  assert.deepEqual(HEROES.filter((h) => heroIdOf(h) == null), []);
  assert.equal(heroIdOf("Anti-Mage"), 1);
  assert.equal(heroIdOf("Outworld Devourer"), 76);
  assert.equal(heroIdOf("Not A Hero"), null);
});

test("positionPools: own side only, by the position played, most games first", () => {
  const pools = positionPools([
    game("a", 1, [pl("a", "Carl", "Anti-Mage", 1), pl("a", "Sup", "Lion", 5)]),
    game("b", 2, [pl("a", "Carl", "Anti-Mage", 1), pl("a", "Sup", "Lion", 5)]),
    game("a", 3, [pl("a", "Stand", "Juggernaut", 1), pl("a", "Sup", "Crystal Maiden", 5)]),
  ]);
  assert.equal(pools.length, 5);
  assert.deepEqual(pools[0].heroes.map((h) => [h.hero, h.games, h.wins]), [["Anti-Mage", 2, 1], ["Juggernaut", 1, 1]]);
  assert.equal(pools[0].player, "Carl");
  assert.deepEqual(pools[4].heroes.map((h) => h.hero), ["Lion", "Crystal Maiden"]);
  assert.equal(pools[1].games, 0);
  assert.ok(!pools.flatMap((p) => p.heroes).some((h) => h.hero === "Axe"));
});

test("gridConfig: a row per played position, stacked, taller for big pools", () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ hero: ["Anti-Mage", "Axe", "Bane", "Bloodseeker", "Crystal Maiden", "Drow Ranger", "Earthshaker", "Juggernaut", "Mirana", "Morphling", "Shadow Fiend", "Phantom Lancer", "Puck"][i] }));
  const c = gridConfig("Team X", [
    { pos: 1, player: "Carl", heroes: many },
    { pos: 2, player: null, heroes: [] },
    { pos: 5, player: "Sup", heroes: [{ hero: "Lion" }] },
  ]);
  assert.equal(c.config_name, "vs Team X");
  assert.deepEqual(c.categories.map((x) => [x.category_name, x.y_position, x.height, x.hero_ids.length]), [
    ["Pos 1 Carry · Carl", 0, 200, 13],
    ["Pos 5 Hard support · Sup", 220, 100, 1],
  ]);
  assert.equal(c.categories[0].hero_ids[0], 1);
});

test("mergeGrid: keeps the player's grids, replaces an earlier export for the same team", () => {
  const mine = { version: 3, configs: [{ config_name: "Tier list", categories: [] }, { config_name: "vs Team X", categories: [{ old: 1 }] }] };
  const out = mergeGrid(mine, { config_name: "vs Team X", categories: [] });
  assert.deepEqual(out.configs.map((c) => c.config_name), ["Tier list", "vs Team X"]);
  assert.deepEqual(out.configs[1].categories, []);
  assert.deepEqual(mine.configs.length, 2, "input untouched");
  assert.deepEqual(mergeGrid(null, { config_name: "vs Y", categories: [] }), { version: 3, configs: [{ config_name: "vs Y", categories: [] }] });
  assert.throws(() => mergeGrid({ foo: 1 }, { config_name: "x" }), /isn't a Dota hero grid file/);
  assert.equal(configName("  " + "A".repeat(60)).length, 40);
});

test("heroSources: players by games, picks, bans and bans against; threats only when given", () => {
  const g = (winner, players, draft) => ({ m: { winner, start_time: 1, players: [...players, pl("b", "Enemy", "Axe", 1)], draft }, side: "a" });
  const src = heroSources([
    g("a", [pl("a", "Carl", "Anti-Mage", 1), pl("a", "Sup", "Lion", 5)], [{ side: "a", pick: false, hero: "Pudge" }, { side: "b", pick: false, hero: "Tinker" }]),
    g("b", [pl("a", "Carl", "Juggernaut", 1)], [{ side: "a", pick: false, hero: "Pudge" }]),
  ]);
  assert.equal(src.player1.name, "Carl");
  assert.deepEqual(src.player1.heroes.map((h) => h.hero), ["Anti-Mage", "Juggernaut"]);
  assert.equal(src.player2.name, "Sup");
  assert.deepEqual(src.bans.heroes.map((h) => [h.hero, h.games]), [["Pudge", 2]]);
  assert.deepEqual(src.banned.heroes.map((h) => h.hero), ["Tinker"]);
  assert.ok(!src.picks.heroes.some((h) => h.hero === "Axe"));
  assert.equal(src.threats, undefined);
  const t = heroSources([], { model: { threats: [{ hero: "Lion", tag: 60, pos: [3, 4] }, { hero: "Axe", tag: 55, pos: [2] }], likely: [{ hero: "Puck" }], banvs: [] } });
  assert.deepEqual(t.likely.heroes.map((h) => h.hero), ["Puck"]);
  assert.equal(t.banvs, undefined, "an empty model list is no source");
  assert.deepEqual(t.threat5.heroes.map((h) => h.hero), ["Lion"]);
  assert.deepEqual(t.threats.heroes.map((h) => h.hero), ["Lion", "Axe"]);
});

test("templateRows: own labels, max per box, unknown sources skipped, columns read their own team", () => {
  const them = { picks: { name: "Picks most", note: "", heroes: [{ hero: "Axe" }, { hero: "Lion" }, { hero: "Puck" }] } };
  const us = { picks: { name: "Picks most", note: "", heroes: [{ hero: "Mirana" }] } };
  const rows = templateRows({ boxes: [{ source: "picks", label: "Comfort", max: 2 }, { source: "threat1" }, { col: "bans", source: "picks" }, { col: "us", source: "picks" }] }, them, us);
  assert.deepEqual(rows.map((r) => [r.name, r.col, r.heroes.map((h) => h.hero).join()]), [["Comfort", "them", "Axe,Lion"], ["Picks most", "bans", "Axe,Lion,Puck"], ["Picks most", "us", "Mirana"]]);
  assert.deepEqual(templateRows({ boxes: [{ col: "us", source: "picks" }] }, them, null), [], "no team of mine: the right column is empty");
  assert.equal(templateRows({ boxes: [{ source: "threat1" }] }, them, null, { all: true })[0].missing, true);
  assert.ok(TEMPLATES.find((x) => x.id === "threats").needs);
  for (const t of TEMPLATES) assert.ok(t.boxes.some((b) => b.col === "us") && t.boxes.some((b) => b.col === "bans"), `${t.id} has all three columns`);
});

test("boxHeroes: taken-off heroes stay off, added ones follow, edits survive a different team", () => {
  const src = { picks: { name: "P", heroes: [{ hero: "Axe", games: 3 }, { hero: "Lion", games: 2 }, { hero: "Puck", games: 1 }] } };
  const b = { source: "picks", max: 2 };
  dropFromBox(b, "Axe");
  addToBox(b, "Mirana");
  addToBox(b, "Lion"); // already there: no double
  assert.deepEqual(boxHeroes(b, src).map((h) => h.hero), ["Lion", "Puck", "Mirana"]);
  addToBox(b, "Axe");
  assert.deepEqual(boxHeroes(b, src).map((h) => h.hero), ["Axe", "Lion", "Mirana"], "put back: no longer taken off");
  const own = { source: "custom" };
  addToBox(own, "Tinker"); addToBox(own, "Pudge"); dropFromBox(own, "Tinker");
  assert.deepEqual(own, { source: "custom", add: ["Pudge"], remove: [] });
  assert.deepEqual(boxHeroes(own, src).map((h) => h.hero), ["Pudge"]);
});

test("heroSources with pubs: per-player pub boxes, and league heroes they've pubbed lately are marked", () => {
  const now = 2_000_000_000, day = 86400;
  const pubs = { 1: [now - day, "Anti-Mage", 1, 0, 0, 0, 1, now - 2 * day, "Faceless Void", 0, 0, 0, 0, 1, now - 40 * day, "Juggernaut", 1, 0, 0, 0, 1] };
  const m = { winner: "a", start_time: now - day, players: [{ team: "a", player_key: "1", name: "Carl", hero: "Anti-Mage", position: 1 }, { team: "a", player_key: "2", name: "Sup", hero: "Lion", position: 5 }] };
  const src = heroSources([{ m, side: "a" }], { pubs, now });
  assert.deepEqual(src.pubs1.heroes.map((h) => h.hero), ["Anti-Mage", "Faceless Void"], "older than 30 days left out");
  assert.equal(src.pubs2, undefined);
  assert.equal(src.player1.heroes[0].pubs, 1);
  assert.equal(src.pos5.heroes[0].pubs, undefined);
  assert.deepEqual(TEMPLATES.find((t) => t.id === "pubs").needs, "pubs");
});

test("columnConfig: enemy left, bans middle, you right, each stacked on its own", () => {
  const h = (n) => ({ hero: n });
  const c = columnConfig("vs X", [
    { col: "them", name: "A", heroes: [h("Axe")] },
    { col: "us", name: "B", heroes: Array.from({ length: 5 }, () => h("Lion")) },
    { col: "them", name: "C", heroes: [h("Puck")] },
    { col: "bans", name: "D", heroes: [h("Not A Hero")] },
  ]);
  assert.deepEqual(c.categories.map((x) => [x.category_name, x.x_position, x.y_position, x.width, x.height]), [
    ["A", 0, 0, 353, 100], ["B", 746, 0, 353, 200], ["C", 0, 120, 353, 100],
  ]);
});

test("layoutConfig: two half boxes share a line, a full one starts the next", () => {
  const h = (n) => ({ hero: n });
  const c = layoutConfig("vs X", [
    { name: "A", heroes: [h("Axe")], half: true },
    { name: "B", heroes: Array.from({ length: 7 }, () => h("Lion")), half: true },
    { name: "C", heroes: [h("Puck")] },
    { name: "D", heroes: [h("Not A Hero")] },
  ]);
  assert.deepEqual(c.categories.map((x) => [x.category_name, x.x_position, x.y_position, x.width, x.height]), [
    ["A", 0, 0, 540, 100], ["B", 560, 0, 540, 200], ["C", 0, 220, 1100, 100],
  ]);
});

test("placeRows: a placed box keeps its place; the rest stack in their column", () => {
  const h = (n) => ({ hero: n });
  const t = { boxes: [{ col: "them", source: "a", x: 500, y: 40, w: 200, h: 90 }, { col: "them", source: "b" }, { col: "us", source: "c" }] };
  const rows = [{ box: 0, col: "them", heroes: [h("Axe")] }, { box: 1, col: "them", heroes: Array.from({ length: 5 }, () => h("Lion")) }, { box: 2, col: "us", heroes: [] }];
  assert.deepEqual(placeRows(t, rows).map((r) => [r.x, r.y, r.w, r.h]), [[500, 40, 200, 90], [0, 0, 353, 80], [746, 0, 353, 80]]);
  freezeLayout(t, rows);
  assert.deepEqual(t.boxes.map((b) => [b.x, b.y, b.w, b.h]), [[500, 40, 200, 90], [0, 0, 353, 80], [746, 0, 353, 80]]);
  assert.deepEqual(freeSpot(t), { x: 0, y: 150, w: 353, h: 80 }, "below the lowest box, the placed one at 40 + 90");
  const c = placedConfig("vs X", placeRows(t, rows));
  assert.deepEqual(c.categories.map((x) => [x.x_position, x.y_position, x.width, x.height, x.hero_ids.length]), [[500, 40, 200, 90, 1], [0, 0, 353, 80, 5]], "empty boxes left out");
});

test("freezeLayout: boxes with no row here go below the rest", () => {
  const t = { boxes: [{ col: "them", source: "a" }, { col: "them", source: "gone" }] };
  freezeLayout(t, [{ box: 0, col: "them", heroes: [] }]);
  assert.deepEqual(t.boxes[1], { col: "them", source: "gone", x: 0, y: 100, w: 353, h: 80 });
});

test("placeHero: puts a hero before another, moving it if already there", () => {
  const src = { p: { heroes: [{ hero: "Axe" }, { hero: "Lion" }, { hero: "Puck" }] } };
  const b = { source: "p" };
  placeHero(b, "Puck", "Axe", src);
  assert.deepEqual(boxHeroes(b, src).map((h) => h.hero), ["Puck", "Axe", "Lion"]);
  placeHero(b, "Tinker", "Lion", src);
  assert.deepEqual(boxHeroes(b, src).map((h) => h.hero), ["Puck", "Axe", "Tinker", "Lion"]);
  placeHero(b, "Mirana", null, src);
  assert.equal(boxHeroes(b, src).at(-1).hero, "Mirana");
});

test("fitIcons: the biggest icons that fit, fewer per line in a tall box", () => {
  const wide = fitIcons(12, 1100, 100), tall = fitIcons(12, 200, 600);
  assert.ok(wide.cols >= 12 / 2 && wide.size * wide.cols <= 1100);
  assert.ok(tall.cols <= 3);
  for (const f of [wide, tall]) assert.ok(Math.ceil(12 / f.cols) * (f.size * 9 / 16) <= (f === wide ? 100 : 600) - 24 + 1);
  assert.deepEqual(fitIcons(0, 100, 100), { size: 0, cols: 0 });
});

test("heroSources: bans split by Captains Mode ban phase, theirs and against them", () => {
  const ban = (order, side, hero) => ({ order, side, pick: false, hero }), pick = (order, side, hero) => ({ order, side, pick: true, hero });
  const draft = [ban(0, "b", "Pudge"), ban(1, "a", "Tinker"), pick(2, "a", "Axe"), pick(3, "b", "Lion"), ban(4, "b", "Puck"), pick(5, "a", "Mirana"), ban(6, "b", "Sniper"), ban(7, "a", "Zeus")];
  const m = { winner: "a", start_time: 1, draft, players: [{ team: "a", name: "Carl", hero: "Axe", position: 1 }] };
  const src = heroSources([{ m, side: "a" }]);
  assert.deepEqual([1, 2, 3].map((p) => src[`banned${p}`]?.heroes.map((h) => h.hero)), [["Pudge"], ["Puck"], ["Sniper"]]);
  assert.deepEqual([1, 2, 3].map((p) => src[`bans${p}`]?.heroes.map((h) => h.hero)), [["Tinker"], undefined, ["Zeus"]]);
  assert.deepEqual(src.banned.heroes.map((h) => h.hero).sort(), ["Puck", "Pudge", "Sniper"]);
  const model = heroSources([], { model: { banPhases: [[{ hero: "Axe" }], [], [{ hero: "Lion" }]] } });
  assert.deepEqual([model.banvs1?.heroes[0].hero, model.banvs2, model.banvs3?.heroes[0].hero], ["Axe", undefined, "Lion"]);
});

test("placedConfig: a box name both sides share says whose it is", () => {
  const row = (name, col, hero) => ({ name, col, heroes: [{ hero }], x: 0, y: 0, w: 300, h: 100 });
  const c = placedConfig("vs X", [row("Threats pos 1 Carry", "them", "Axe"), row("Threats pos 1 Carry", "us", "Lion"), row("Ban phase 1", "bans", "Zeus")], { them: "WOT", us: null });
  assert.deepEqual(c.categories.map((x) => x.category_name), ["WOT: Threats pos 1 Carry", "Us: Threats pos 1 Carry", "Ban phase 1"]);
});
