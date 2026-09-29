import { test } from "node:test";
import assert from "node:assert/strict";
import { leadScale } from "../public/lib/charts.js";

test("leadScale fits each side to its own biggest lead", () => {
  const s = leadScale([0, 1500, -2500, 8000, 16000]);
  assert.equal(s.top, 20000);
  assert.equal(s.bot, 5000);
  assert.deepEqual(s.ticks, [20000, 15000, 10000, 5000, -5000]);
  const y = s.y(0, 250);
  assert.equal(y(20000), 0);
  assert.equal(y(-5000), 250);
  assert.equal(y(0), 200);
});

test("leadScale gives the side that never led one step, and handles a flat game", () => {
  const s = leadScale([0, 3000, 6000]);
  assert.equal(s.bot, 2000);
  assert.equal(s.top, 8000);
  const flat = leadScale([0, 0, 0]);
  assert.ok(flat.top > 0 && flat.bot > 0);
});
