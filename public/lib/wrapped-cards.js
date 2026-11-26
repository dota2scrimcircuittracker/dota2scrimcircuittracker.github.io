// AD2L Wrapped's card names, apart from its maths (lib/wrapped.js) so the Worker can check a pin
// without loading game code. award:<key> cards are an award the player won.
export const PLAYER_CARDS = ["intro", "finish", "heroes", "bans", "signature", "best", "rating", "highlights", "playoffs", "mvps", "lane", "nemesis", "hit", "dead", "personality", "summary"];
export const AWARDS = ["champions", "mvp", "playoffMvp", "support", "laner", "duo", "sandbagged", "series", "upset", "overachiever"];
export const validCard = (card) => typeof card === "string" && (PLAYER_CARDS.includes(card) || (card.startsWith("award:") && AWARDS.includes(card.slice(6))));
