// Which saved designs are a player's Winter pack cards (docs/superpowers/specs/2026-11-13-player-packs-design.md
// section 1.1). Pure, shared by the collection Worker and the profile.
//
// Entry is automatic: the first four saved designs by slot (Card 1, Card 2, ...) are the four voted
// cards, each with main null ("the default for their position"). Arcana items on a design (Twin
// Card, stacked finishes) don't matter here: arcana cards come only from the Arcana Cup podium
// (lib/arcana-cup.js arcanaCards). Once the owner changes a stat or swaps a design in, the choice is
// stored on their collection state: packCards [{slot, main}]. A stored slot that is now plain or
// empty is dropped, and the list is filled back up to four from the next unused designs in slot order.
// Locks (spec 1.1 "Lock."): packLocks [slot] on the state, in force until packs open.
import { isPlainDesign } from "./card-ratings.js";
import { statsFor } from "./card-bonus.js";
import { WINTER } from "./winter.js";

export const PACK_VOTED = 4;

const statOrNull = (main) => (typeof main === "string" && main ? main : null);

// state: { cardDesigns (by slot), packCards? }. Old stored entries may carry savedAt: ignored.
// -> { voted: [{ slot, main }] (up to 4, in order) }
export function packCardList({ cardDesigns = [], packCards } = {}) {
  const designs = cardDesigns ?? [];
  const votable = (slot) => Number.isInteger(slot) && !isPlainDesign(designs[slot]);
  const voted = [], used = new Set();
  for (const p of Array.isArray(packCards) ? packCards : []) {
    if (voted.length >= PACK_VOTED || used.has(p?.slot) || !votable(p?.slot)) continue;
    voted.push({ slot: p.slot, main: statOrNull(p.main) });
    used.add(p.slot);
  }
  for (let slot = 0; slot < designs.length && voted.length < PACK_VOTED; slot++) {
    if (!used.has(slot) && votable(slot)) { voted.push({ slot, main: null }); used.add(slot); }
  }
  return { voted };
}

// The slots locked for Winter packs right now: none from WINTER.opensAt on.
export const packLocksOf = (state, now) =>
  now >= WINTER.opensAt ? new Set() : new Set((Array.isArray(state?.packLocks) ? state.packLocks : []).filter(Number.isInteger));

// A card's main stat at a position: its own, else the top-weighted stat there (WEIGHTS order is
// descending). Null when there's no stat and no position yet ("Choose a bonus").
export const mainOrDefault = (main, pos) => main ?? (pos ? statsFor(pos)[0] : null);
