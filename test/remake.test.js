import { test } from "node:test";
import assert from "node:assert/strict";
import { isRemake } from "../public/lib/stats.js";

const game = (kda) => ({ players: Array.from({ length: 10 }, (_, i) => ({ kills: 0, deaths: 0, assists: 0, ...(i === 0 ? kda : {}) })) });

test("a game where all ten players are 0/0/0 is a remake", () => {
  assert.equal(isRemake(game({})), true);
});

test("one kill, death or assist anywhere means the game was played", () => {
  assert.equal(isRemake(game({ kills: 1 })), false);
  assert.equal(isRemake(game({ deaths: 1 })), false);
  assert.equal(isRemake(game({ assists: 1 })), false);
});

test("a game with no player rows isn't treated as a remake", () => {
  assert.equal(isRemake({ players: [] }), false);
  assert.equal(isRemake({}), false);
});
