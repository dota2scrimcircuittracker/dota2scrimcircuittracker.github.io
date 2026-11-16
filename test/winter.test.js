import { test } from "node:test";
import assert from "node:assert/strict";
import { WINTER, beforeLock, tiebreakOpen } from "../public/lib/winter.js";
test("first mini: cards lock end of Mon Nov 23, tiebreak picks Wed Nov 25, packs open Thu Nov 26 (US Eastern)", () => {
  assert.equal(WINTER.prepAt, Date.parse("2026-11-14T00:00:00Z"));
  assert.equal(WINTER.lockAt, Date.parse("2026-11-24T05:00:00Z"));     // end of Mon Nov 23
  assert.equal(WINTER.tiebreakAt, Date.parse("2026-11-25T05:00:00Z")); // start of Wed Nov 25
  assert.equal(WINTER.opensAt, Date.parse("2026-11-26T05:00:00Z"));    // midnight Thu Nov 26, a week before the Dec 3 mini
  assert.ok(WINTER.prepAt < WINTER.lockAt && WINTER.lockAt < WINTER.tiebreakAt && WINTER.tiebreakAt < WINTER.opensAt);
  assert.equal(beforeLock(WINTER.lockAt - 1), true);
  assert.equal(beforeLock(WINTER.lockAt), false);
  assert.equal(tiebreakOpen(WINTER.tiebreakAt - 1), false);
  assert.equal(tiebreakOpen(WINTER.tiebreakAt), true);
  assert.equal(tiebreakOpen(WINTER.opensAt - 1), true);
  assert.equal(tiebreakOpen(WINTER.opensAt), false);
});
