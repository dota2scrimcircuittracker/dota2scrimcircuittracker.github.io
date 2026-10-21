// Legendary backgrounds: hand-made loading screens that never come in normal or loading-screen packs.
// Each border pack has the legendary pack odds (PACK_ODDS.legendary, 4%) of one the player doesn't have yet
// (cosmetics-engine.js rollThemedPack). The image is img/loading-screens/<id without "scr:">.webp.
// Add more here.
import { SCREEN_ART } from './screen-art-data.js';

export const LEGENDARY_SCREENS = [
  { id: 'scr:saint-gaben', label: 'Saint Gaben', rarity: 'Legendary', legendary: true },
];
// Every screen a player can own: pack screens first, then the legendary ones.
export const ALL_SCREENS = [...SCREEN_ART, ...LEGENDARY_SCREENS];
export const isLegendaryScreen = (id) => LEGENDARY_SCREENS.some((s) => s.id === id);
