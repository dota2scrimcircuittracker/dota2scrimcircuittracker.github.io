import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowWinterNotice } from "../public/lib/winter-notice.js";
const W = { prepAt: 100, opensAt: 200 };
test("shows from prep until a week after opening, once", () => {
  assert.equal(shouldShowWinterNotice(99, false, W), false);
  assert.equal(shouldShowWinterNotice(150, false, W), true);
  assert.equal(shouldShowWinterNotice(150, true, W), false);
  assert.equal(shouldShowWinterNotice(200 + 7 * 864e5, false, W), false);
});
