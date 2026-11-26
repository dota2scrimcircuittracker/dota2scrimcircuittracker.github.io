import { test } from "node:test";
import assert from "node:assert/strict";
import { slideMs, highlightCards, resumeKey, resumeAt, lowData, BASE_MS, MAX_MS } from "../public/lib/story-player.js";

test("a short card stays up the base time, a busy one longer, capped", () => {
  assert.equal(slideMs({ key: "x", kicker: "Part 1", body: "<div class=\"wr-big\">Heroes</div>" }), BASE_MS);
  assert.equal(slideMs(null), BASE_MS);
  const words = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
  assert.equal(slideMs({ key: "x", body: `<p>${words}</p>` }), BASE_MS + 20 * 150);
  const stats = `<dl>${"<div><dt>a</dt><dd>1</dd></div>".repeat(6)}</dl>`;
  assert.equal(slideMs({ key: "x", body: stats }), BASE_MS + 3 * 400);
  // A switch card counts its first view.
  assert.equal(slideMs({ key: "x", body: "", views: [{ body: stats }, { body: stats + stats }] }), BASE_MS + 3 * 400);
  assert.equal(slideMs({ key: "x", body: `<ol>${"<li>a b c d e</li>".repeat(60)}</ol>` }), MAX_MS);
  assert.equal(slideMs({ key: "clip", body: "" }), MAX_MS);
});

test("highlights keep the opening, best game, signature, MVPs, awards, summary, in that order", () => {
  const k = (key) => ({ key });
  const cards = ["intro", "finish", "heroes", "signature", "best", "rating", "mvps", "award:mvp", "award:duo", "award:farm", "lane", "summary", "signature", "award:mvp"].map(k);
  assert.deepEqual(highlightCards(cards).map((c) => c.key), ["intro", "best", "signature", "mvps", "award:mvp", "award:duo", "summary"]);
  // 8 with the ending: room for two awards here.
  assert.equal(highlightCards(cards).length + 1, 8);
  // Fewer of the fixed cards leave more room for awards; the cut never repeats a key.
  const few = highlightCards(["intro", "award:a", "award:b", "award:a", "award:c", "award:d", "award:e", "award:f", "award:g"].map(k));
  assert.deepEqual(few.map((c) => c.key), ["intro", "award:a", "award:b", "award:c", "award:d", "award:e", "award:f"]);
  assert.deepEqual(highlightCards([]), []);
});

test("resume keys and the card to continue from", () => {
  assert.equal(resumeKey("/champion/wrapped/123/"), "wr-resume:/champion/wrapped/123");
  assert.equal(resumeKey("/champion/wrapped/123/", true), "wr-resume:/champion/wrapped/123?short");
  assert.equal(resumeKey("/"), "wr-resume:/");
  assert.equal(resumeAt("5", 20), 5);
  assert.equal(resumeAt(null, 20), null);
  assert.equal(resumeAt("0", 20), null);
  assert.equal(resumeAt("19", 20), null, "the last card starts over");
  assert.equal(resumeAt("25", 20), null, "past the end of a shorter story");
  assert.equal(resumeAt("abc", 20), null);
});

test("data saver: save-data or a 2G/3G connection", () => {
  assert.equal(lowData(undefined), false);
  assert.equal(lowData({ effectiveType: "4g" }), false);
  assert.equal(lowData({ effectiveType: "4g", saveData: true }), true);
  for (const t of ["slow-2g", "2g", "3g"]) assert.equal(lowData({ effectiveType: t }), true, t);
});
