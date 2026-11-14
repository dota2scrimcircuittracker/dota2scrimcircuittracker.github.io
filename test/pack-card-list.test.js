import { test } from "node:test";
import assert from "node:assert/strict";
import { isArcanaDesign, packCardList, mainOrDefault } from "../public/lib/pack-card-list.js";
import { DEFAULT_EQUIPMENT } from "../public/lib/cosmetics-catalog.js";

const d = (hue, extra = {}) => ({ ...DEFAULT_EQUIPMENT, hue, ...extra });
const twin = d(5, { twin: { turn: "flip", design: d(6) } });
const stacked = d(7, { finish: "satin", finishStack: ["paper"] });
const legendary = d(8, { border: "gold", finish: "metallic", living: "pulse" });

test("arcana designs: a Twin Card or stacked finishes; a legendary design with a living border is not", () => {
  assert.equal(isArcanaDesign(twin), true);
  assert.equal(isArcanaDesign(stacked), true);
  assert.equal(isArcanaDesign(legendary), false);
  assert.equal(isArcanaDesign(d(9, { finishStack: [] })), false);
  assert.equal(isArcanaDesign(d(9, { twin: { turn: "nope", design: d(1) } })), false); // unknown turn
  assert.equal(isArcanaDesign(null), false);
  assert.equal(isArcanaDesign(d(0)), false); // the plain default card
});

test("derived: the first four non-arcana designs by slot, plain slots skipped, main null", () => {
  const cardDesigns = [d(1), null, d(0), d(3), d(4), d(5), d(6)];
  assert.deepEqual(packCardList({ cardDesigns }), { voted: [{ slot: 0, main: null }, { slot: 3, main: null }, { slot: 4, main: null }, { slot: 5, main: null }], arcana: null });
  assert.deepEqual(packCardList({ cardDesigns: [] }), { voted: [], arcana: null });
  assert.deepEqual(packCardList(), { voted: [], arcana: null });
});

test("arcana: never in the four; the lowest arcana slot is the 5th card unless another was chosen", () => {
  const cardDesigns = [d(1), twin, d(2), stacked, d(3), d(4)];
  const derived = packCardList({ cardDesigns });
  assert.deepEqual(derived.voted.map((c) => c.slot), [0, 2, 4, 5]);
  assert.deepEqual(derived.arcana, { slot: 1, main: null });
  assert.deepEqual(packCardList({ cardDesigns, packArcana: { slot: 3, main: "gpm" } }).arcana, { slot: 3, main: "gpm" });
  // A chosen arcana slot that is no longer arcana falls back to the lowest one.
  assert.deepEqual(packCardList({ cardDesigns, packArcana: { slot: 2, main: "gpm" } }).arcana, { slot: 1, main: null });
});

test("stored: kept in the owner's order, then repaired and filled from the next unused design", () => {
  const cardDesigns = [d(1), d(2), d(3), d(4), d(5), d(6)];
  const packCards = [{ slot: 0, main: "kills" }, { slot: 5, main: null }, { slot: 2, main: "gpm" }, { slot: 3, main: null }];
  assert.deepEqual(packCardList({ cardDesigns, packCards }).voted, packCards);
  // Slot 5 went plain and slot 2 became arcana: both dropped, filled from slots 1 and 4.
  const changed = [...cardDesigns]; changed[5] = d(0); changed[2] = stacked;
  assert.deepEqual(packCardList({ cardDesigns: changed, packCards }).voted, [{ slot: 0, main: "kills" }, { slot: 3, main: null }, { slot: 1, main: null }, { slot: 4, main: null }]);
  // Duplicates, out-of-range slots and more than four are ignored.
  assert.deepEqual(packCardList({ cardDesigns, packCards: [{ slot: 1 }, { slot: 1 }, { slot: 9 }, { slot: 0 }, { slot: 2 }, { slot: 3 }, { slot: 4 }] }).voted.map((c) => c.slot), [1, 0, 2, 3]);
  // An old opt-in list shorter than four fills up.
  assert.deepEqual(packCardList({ cardDesigns, packCards: [] }).voted.map((c) => c.slot), [0, 1, 2, 3]);
});

test("default main: the top-weighted stat for the position, else null", () => {
  assert.equal(mainOrDefault(null, 1), "gpm");
  assert.equal(mainOrDefault(null, 5), "vispct");
  assert.equal(mainOrDefault("kills", 5), "kills");
  assert.equal(mainOrDefault(null, null), null);
});
