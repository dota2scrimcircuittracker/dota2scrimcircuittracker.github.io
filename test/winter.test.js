import { test } from "node:test";
import assert from "node:assert/strict";
import { WINTER, votingOpen } from "../public/lib/winter.js";
test("voting on pack cards closes at the end of Thanksgiving, US Eastern", () => {
  assert.equal(WINTER.votesCloseAt, Date.parse("2026-11-27T05:00:00Z"));
  assert.equal(WINTER.prepAt, Date.parse("2026-11-14T00:00:00Z"));
  assert.equal(WINTER.opensAt, Date.parse("2026-12-01T05:00:00Z")); // midnight Dec 1, US Eastern
  assert.ok(WINTER.prepAt < WINTER.votesCloseAt && WINTER.votesCloseAt < WINTER.opensAt);
  assert.equal(votingOpen(WINTER.votesCloseAt - 1), true);
  assert.equal(votingOpen(WINTER.votesCloseAt), false);
});
