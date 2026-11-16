// Winter tournament Fantasy with player packs (docs/superpowers/specs/2026-11-13-player-packs-design.md).
// One Fantasy across every Winter division, stored under the league key "all".
export const WINTER = {
  league: "all",
  divisions: ["ad2l", "heroic", "conqueror", "warrior", "challenger", "voyager", "explorer"], // division keys (lib/divisions.js): Champion is "ad2l". Fav confirms
  prepAt: Date.parse("2026-11-14T00:00:00Z"),  // notice + nominations go live (live as soon as it deploys)
  // The first Winter mini starts Thu Dec 3. All times US Eastern (EST, UTC-5).
  // End of Mon Nov 23: pack cards lock for that mini, with their votes as they stood. Votes keep
  // counting after this (for later minis); they don't move the locked cards.
  lockAt: Date.parse("2026-11-24T05:00:00Z"),
  // Tue Nov 24 is for Fav to sort out problems. All of Wed Nov 25: owners of tied cards (where their
  // own rating decides the rarity, lib/player-cards.js selfDecides) pick the rarity.
  tiebreakAt: Date.parse("2026-11-25T05:00:00Z"),
  opensAt: Date.parse("2026-11-26T05:00:00Z"), // midnight Thu Nov 26: packs, starter grant, daily packs
};
export const STARTER_PACKS = 3;
export const PACK_CARDS_MAX = 4;
export const winterOpen = (now) => now >= WINTER.opensAt;
export const beforeLock = (now) => now < WINTER.lockAt;
export const tiebreakOpen = (now) => now >= WINTER.tiebreakAt && now < WINTER.opensAt;
