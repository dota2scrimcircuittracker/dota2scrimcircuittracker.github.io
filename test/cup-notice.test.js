import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowCupNotice, timeLeft } from "../public/lib/cup-notice.js";
import { CUP } from "../public/lib/arcana-cup.js";

const DAY = 864e5;

test("cup notice shows until dismissed, only while entries are open", () => {
  assert.equal(shouldShowCupNotice(CUP.votingAt - DAY, false), true);
  assert.equal(shouldShowCupNotice(CUP.votingAt - DAY, true), false);
  assert.equal(shouldShowCupNotice(CUP.votingAt, false), false);
  assert.equal(shouldShowCupNotice(CUP.votingAt + DAY, false), false);
});

test("cup notice counts whole days left", () => {
  assert.equal(timeLeft(CUP.votingAt - 6.5 * DAY), "7 days left");
  assert.equal(timeLeft(CUP.votingAt - 1.5 * DAY), "2 days left");
  assert.equal(timeLeft(CUP.votingAt - DAY), "Last day");
  assert.equal(timeLeft(CUP.votingAt - 3600e3), "Last day");
});
