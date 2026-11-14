import { test } from "node:test";
import assert from "node:assert/strict";
import { packCardList, packLocksOf, mainOrDefault } from "../public/lib/pack-card-list.js";
import { WINTER } from "../public/lib/winter.js";
import { DEFAULT_EQUIPMENT } from "../public/lib/cosmetics-catalog.js";

const d = (hue, extra = {}) => ({ ...DEFAULT_EQUIPMENT, hue, ...extra });
const twin = d(5, { twin: { turn: "flip", design: d(6) } });
const stacked = d(7, { finish: "satin", finishStack: ["paper"] });

test("derived: the first four designs by slot, plain slots skipped, main null", () => {
  const cardDesigns = [d(1), null, d(0), d(3), d(4), d(5), d(6)];
  assert.deepEqual(packCardList({ cardDesigns }), { voted: [{ slot: 0, main: null }, { slot: 3, main: null }, { slot: 4, main: null }, { slot: 5, main: null }] });
  assert.deepEqual(packCardList({ cardDesigns: [] }), { voted: [] });
  assert.deepEqual(packCardList(), { voted: [] });
});

test("arcana items on a profile design don't make it an arcana card: twins and stacked finishes are among the four", () => {
  const cardDesigns = [d(1), twin, d(2), stacked, d(3)];
  assert.deepEqual(packCardList({ cardDesigns }).voted.map((c) => c.slot), [0, 1, 2, 3]);
  assert.equal("arcana" in packCardList({ cardDesigns }), false);
  assert.deepEqual(packCardList({ cardDesigns, packCards: [{ slot: 3, main: "gpm" }] }).voted[0], { slot: 3, main: "gpm" });
});

test("stored: kept in the owner's order, then repaired and filled from the next unused design", () => {
  const cardDesigns = [d(1), d(2), d(3), d(4), d(5), d(6)];
  const packCards = [{ slot: 0, main: "kills" }, { slot: 5, main: null }, { slot: 2, main: "gpm" }, { slot: 3, main: null }];
  assert.deepEqual(packCardList({ cardDesigns, packCards }).voted, packCards);
  // Slot 5 went plain: dropped, filled from slot 1.
  const changed = [...cardDesigns]; changed[5] = d(0);
  assert.deepEqual(packCardList({ cardDesigns: changed, packCards }).voted, [{ slot: 0, main: "kills" }, { slot: 2, main: "gpm" }, { slot: 3, main: null }, { slot: 1, main: null }]);
  // Duplicates, out-of-range slots and more than four are ignored.
  assert.deepEqual(packCardList({ cardDesigns, packCards: [{ slot: 1 }, { slot: 1 }, { slot: 9 }, { slot: 0 }, { slot: 2 }, { slot: 3 }, { slot: 4 }] }).voted.map((c) => c.slot), [1, 0, 2, 3]);
  assert.deepEqual(packCardList({ cardDesigns, packCards: [] }).voted.map((c) => c.slot), [0, 1, 2, 3]);
});

test("old-shape stored list (opt-in era: savedAt, fewer than four) parses and fills up", () => {
  const cardDesigns = [d(1), d(2), d(3), d(4), d(5), d(6)];
  const old = [{ slot: 4, main: "kills", savedAt: 1700 }, { slot: 1, main: "stuns", savedAt: 1600 }];
  assert.deepEqual(packCardList({ cardDesigns, packCards: old }).voted, [{ slot: 4, main: "kills" }, { slot: 1, main: "stuns" }, { slot: 0, main: null }, { slot: 2, main: null }]);
  // Junk mains read as the default.
  assert.deepEqual(packCardList({ cardDesigns, packCards: [{ slot: 0, main: 7, savedAt: 1 }] }).voted[0], { slot: 0, main: null });
});

test("locks: integer slots from packLocks, none from WINTER.opensAt on", () => {
  const state = { packLocks: [2, 0, "x", null] };
  assert.deepEqual([...packLocksOf(state, WINTER.opensAt - 1)].sort(), [0, 2]);
  assert.equal(packLocksOf(state, WINTER.opensAt).size, 0);
  assert.equal(packLocksOf({}, 0).size, 0);
  assert.equal(packLocksOf(null, 0).size, 0);
});

test("default main: the top-weighted stat for the position, else null", () => {
  assert.equal(mainOrDefault(null, 1), "gpm");
  assert.equal(mainOrDefault(null, 5), "vispct");
  assert.equal(mainOrDefault("kills", 5), "kills");
  assert.equal(mainOrDefault(null, null), null);
});
