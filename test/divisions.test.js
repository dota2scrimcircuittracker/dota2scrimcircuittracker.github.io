import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { SEASON, DIVISIONS, division, slugOf, fullName, collectionOf, divisionCss } from "../public/lib/divisions.js";
import { sharePath, routeOf } from "../public/lib/share.js";

const hex = /^#[0-9a-f]{6}$/;

test("every division is complete and unique", () => {
  assert.match(SEASON.name, /^S\d+$/);
  assert.ok(Number.isInteger(SEASON.dotaLeague));
  for (const field of ["key", "season"]) assert.equal(new Set(DIVISIONS.map((d) => d[field])).size, DIVISIONS.length, `${field} repeats`);
  assert.equal(new Set(DIVISIONS.map(slugOf)).size, DIVISIONS.length, "slug repeats");
  for (const d of DIVISIONS) {
    assert.match(d.key, /^[a-z0-9]+$/, d.key);
    assert.ok(d.name && Number.isInteger(d.season), d.key);
    for (const c of ["color", "dark", "light"]) assert.match(d[c], hex, `${d.key}.${c}`);
    if (d.text) assert.match(d.text, hex, `${d.key}.text`);
    assert.ok(!["all", "scrims", "ad2l", "week", "players", "heroes", "teams", "predict", "upload"].includes(slugOf(d)), `${d.key}'s address clashes with a page`);
  }
  assert.equal(division("ad2l").slug, "champion");
  assert.equal(fullName(division("warrior")), `${SEASON.name} Warrior`);
  assert.equal(collectionOf("heroic"), "heroic_unticketed");
});

test("every division has a data file", () => {
  for (const d of DIVISIONS) assert.ok(existsSync(`public/data/${d.key}.json`), `public/data/${d.key}.json`);
});

test("every division's pages have share paths, views included", () => {
  for (const d of DIVISIONS) {
    const s = slugOf(d);
    for (const tab of ["", "/week", "/players", "/heroes", "/predict", "/upload", "/teams/1", "/game/2"])
      assert.equal(sharePath(`#/${s}${tab}`), `/${s}${tab}/`, `${s}${tab}`);
    assert.equal(routeOf(`/${s}/`), `#/${s}/`);
    for (const v of d.views ?? []) {
      assert.equal(sharePath(`#/${s}/${v}/players`), `/${s}/${v}/players/`);
      assert.equal(sharePath(`#/${s}/${v}/teams/1`), null, "a view has no team pages of its own");
    }
  }
});

test("colours are generated for every division", () => {
  const css = divisionCss();
  for (const d of DIVISIONS) {
    assert.ok(css.includes(`body[data-league="${d.key}"] { --accent: ${d.color};`), d.key);
    assert.ok(css.includes(`html.light body[data-league="${d.key}"] { --accent: ${d.light};`), d.key);
  }
  // style.css no longer hard-codes any division's colours.
  const style = readFileSync("public/style.css", "utf8");
  for (const d of DIVISIONS) assert.ok(!style.includes(`[data-league="${d.key}"]`) && !style.includes(`[data-lg="${d.key}"]`), `style.css still has ${d.key}`);
});

test("the Firestore rules know every division (edited by hand)", () => {
  const rules = readFileSync("firebase/scrimleague.rules", "utf8");
  for (const d of DIVISIONS) {
    assert.ok(new RegExp(`[(|]${d.key}[|)]`).test(rules.match(/function knownColl\(\)[^\n]*/)[0]), `knownColl() is missing ${d.key}`);
    assert.ok(rules.includes(`'${d.key}'`), `the rules' league lists are missing '${d.key}'`);
  }
});
