// Winter tournament Fantasy with player packs (docs/superpowers/specs/2026-11-13-player-packs-design.md).
// One Fantasy across every Winter division, stored under the league key "all".
export const WINTER = {
  league: "all",
  divisions: ["ad2l", "heroic", "conqueror", "warrior", "challenger", "voyager", "explorer"], // division keys (lib/divisions.js): Champion is "ad2l". Fav confirms
  prepAt: Date.parse("2026-11-17T00:00:00Z"),  // Fav confirms: notice + nominations go live
  opensAt: Date.parse("2026-12-01T00:00:00Z"), // Fav confirms: packs, starter grant, daily packs
};
export const STARTER_PACKS = 3;
export const PACK_CARDS_MAX = 4;
export const winterOpen = (now) => now >= WINTER.opensAt;
