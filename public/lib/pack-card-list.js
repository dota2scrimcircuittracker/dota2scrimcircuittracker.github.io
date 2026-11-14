// Which saved designs are a player's Winter pack cards (docs/superpowers/specs/2026-11-13-player-packs-design.md
// section 1 "Arcana", 1.1). Pure, shared by the collection Worker and the profile.
//
// Entry is automatic: the first four saved non-arcana designs by slot (Card 1, Card 2, ...) are the
// four voted cards, each with main null ("the default for their position"). The lowest-slot arcana
// design is a 5th card, never voted. Once the owner changes a stat or swaps a design in, the choice is
// stored on their collection state: packCards [{slot, main}] and packArcana {slot, main}. A stored
// slot that is now plain, empty or arcana is dropped, and the list is filled back up to four from the
// next unused designs in slot order.
import { isPlainDesign } from "./card-ratings.js";
import { twinOf } from "./card-arcana.js";
import { statsFor } from "./card-bonus.js";

export const PACK_VOTED = 4;

// A design is arcana if it uses an arcana-rarity item (lib/cosmetics-arcana-catalog.js): a Twin Card
// (equipment.twin, a tool:twin-<turn>) or finishes stacked by Double finish (equipment.finishStack,
// a non-empty list of finish ids; saveCardDesign drops an empty one). Living borders are legendary.
export const isArcanaDesign = (design) =>
  !isPlainDesign(design) && (!!twinOf(design) || (Array.isArray(design.finishStack) && design.finishStack.length > 0));

const statOrNull = (main) => (typeof main === "string" && main ? main : null);

// state: { cardDesigns (by slot), packCards?, packArcana? }.
// -> { voted: [{ slot, main }] (up to 4, in order), arcana: { slot, main } | null }
export function packCardList({ cardDesigns = [], packCards, packArcana } = {}) {
  const designs = cardDesigns ?? [];
  const votable = (slot) => Number.isInteger(slot) && !isPlainDesign(designs[slot]) && !isArcanaDesign(designs[slot]);
  const voted = [], used = new Set();
  for (const p of Array.isArray(packCards) ? packCards : []) {
    if (voted.length >= PACK_VOTED || used.has(p?.slot) || !votable(p?.slot)) continue;
    voted.push({ slot: p.slot, main: statOrNull(p.main) });
    used.add(p.slot);
  }
  for (let slot = 0; slot < designs.length && voted.length < PACK_VOTED; slot++) {
    if (!used.has(slot) && votable(slot)) { voted.push({ slot, main: null }); used.add(slot); }
  }
  let arcana = null;
  if (Number.isInteger(packArcana?.slot) && isArcanaDesign(designs[packArcana.slot])) arcana = { slot: packArcana.slot, main: statOrNull(packArcana.main) };
  else {
    const slot = designs.findIndex((d) => isArcanaDesign(d));
    if (slot >= 0) arcana = { slot, main: null };
  }
  return { voted, arcana };
}

// A card's main stat at a position: its own, else the top-weighted stat there (WEIGHTS order is
// descending). Null when there's no stat and no position yet ("Choose a bonus").
export const mainOrDefault = (main, pos) => main ?? (pos ? statsFor(pos)[0] : null);
