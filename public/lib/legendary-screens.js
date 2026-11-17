// Legendary backgrounds: hand-made loading screens that never come in normal or loading-screen packs.
// Each border pack has the legendary pack odds (PACK_ODDS.legendary, 4%) of one the player doesn't have yet
// (cosmetics-engine.js rollThemedPack). The image is img/loading-screens/<id without "scr:">.webp.
// hero ties one to that hero's card art list (and only that hero); without it, it sits under Miscellaneous.
// Add more here. drops:false makes one gift-only: border packs skip it and Fav hands it out with a gift.
import { SCREEN_ART } from './screen-art-data.js';

export const LEGENDARY_SCREENS = [
  { id: 'scr:saint-gaben', label: 'Saint Gaben', rarity: 'Legendary', legendary: true },
  { id: 'scr:el-sombrero', label: 'El Sombrero', rarity: 'Legendary', legendary: true, hero: 'Storm Spirit' },
  // Made for Spiroar.
  { id: 'scr:chen-spiroar', label: 'Chen', rarity: 'Legendary', legendary: true, drops: false, hero: 'Chen' },
];
// Every screen a player can own: pack screens first, then the legendary ones.
export const ALL_SCREENS = [...SCREEN_ART, ...LEGENDARY_SCREENS];
export const isLegendaryScreen = (id) => LEGENDARY_SCREENS.some((s) => s.id === id);
