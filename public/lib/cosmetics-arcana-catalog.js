// Card editing tools and living borders (lib/cosmetics-catalog.js adds them to CATALOG).
//
// Arcana tools (type "tool", rarity "arcana"): sold in the shop, and the arcana a pack card or a
// recycle of ten legendaries can turn into (giveArcana in lib/cosmetics-engine.js). Double finish stacks
// finishes, one layer per copy. A Twin Card gives a card a designed back, turning between them its own way.
// They're editing tools, not player cards: arcana player cards (ARCANA_CARDS) are never for sale.
//
// Living borders (type "living", rarity "legendary"): a moving effect over whatever border is
// equipped, in that border's colours. Like any legendary they drop in packs and sell in the shop.
const tool = (id, name, description, extra = {}) => ({ id, name, type: 'tool', rarity: 'arcana', key: `tool:${id}`, a: '#ff5ab4', b: '#7a3cff', description, ...extra });
const living = (id, name, description) => ({ id, name, type: 'living', rarity: 'legendary', key: `living:${id}`, a: '#ffd36b', b: '#ff5ab4', description });

// Twin Card turns, in shop order. The id after "twin-" is what a saved design stores (equipment.twin.turn).
export const TWIN_TURNS = ['flip', 'peel', 'shuffle', 'scan', 'glitch'];

export const ARCANA_TOOLS = [
  tool('double-finish', 'Double finish', 'Stack finishes over your main one, each on its own moving layer. Every copy you own adds one more layer, up to five in all.'),
  tool('twin-flip', 'Twin Card: Flip', 'Your card shows a second of your saved designs. It turns over in 3D every few seconds.', { turn: 'flip' }),
  tool('twin-peel', 'Twin Card: Corner Peel', 'Your card shows a second of your saved designs. Hover it and it peels from the corner to show the one underneath.', { turn: 'peel' }),
  tool('twin-shuffle', 'Twin Card: Shuffle', 'Your card shows a second of your saved designs. The two shuffle like a deck: the front one slides off and tucks in behind.', { turn: 'shuffle' }),
  tool('twin-scan', 'Twin Card: Scan', 'Your card shows a second of your saved designs. A scan line passes down the card and the other design appears behind it.', { turn: 'scan' }),
  tool('twin-glitch', 'Twin Card: Glitch Swap', 'Your card shows a second of your saved designs. It glitches for a split second and comes back as the other one.', { turn: 'glitch' }),
];

export const LIVING_BORDERS = [
  living('pulse', 'Pulse Glow', 'Your border breathes light in its own colours.'),
  living('orbit', 'Orbiting Spark', 'A bright spark travels round and round your border.'),
  living('shimmer', 'Shimmer Sweep', 'A sheen of light runs across your border every few seconds.'),
  living('embers', 'Rising Embers', 'Sparks lift off your border and drift up the card.'),
  living('trace', 'Rune Trace', 'A line of light traces your border, like a rune being drawn.'),
];
