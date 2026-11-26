// AD2L Wrapped's card names, apart from its maths (lib/wrapped.js) so the Worker can check a pin
// without loading game code. award:<key> cards are an award the player won.
export const PLAYER_CARDS = ["intro", "finish", "heroes", "bans", "signature", "best", "rating", "highlights", "playoffs", "mvps", "lane", "nemesis", "hit", "dead", "personality", "summary"];
export const AWARDS = ["champions", "mvp", "playoffMvp", "support", "laner", "duo", "sandbagged", "series", "upset", "overachiever"];
// The rest of a player's story (pages/wrapped.js storyCardList): its clip, performance and showdown
// slides, and the More and record cards (m-<key>). "story" is the whole Wrapped, posted from its first slide.
export const STORY_CARDS = ["story", "clip", "perf-team", "perf-division", "perf-league", "showdown"];
export const validCard = (card) => typeof card === "string" && (PLAYER_CARDS.includes(card) || STORY_CARDS.includes(card) || /^m-[a-zA-Z0-9-]{1,40}$/.test(card) || (card.startsWith("award:") && AWARDS.includes(card.slice(6))));
// A card reference ({ season 'S48', div a league id such as 'ad2l' (Champion), 'heroic_a', 'all'; card }) as a pin or a Feed post sends it:
// the three fields only, or an Error naming what's wrong. The card drawn is always the poster's
// own (pages/wrapped.js pinnedCardHtml), so a reference can't show someone else's season.
export function wrappedRef(ref) {
  if (typeof ref !== "object" || ref == null || Array.isArray(ref)) throw new Error("Choose a Wrapped card.");
  const { season, div, card } = ref;
  if (typeof season !== "string" || !/^S\d{1,3}$/.test(season)) throw new Error("Choose a season.");
  if (typeof div !== "string" || !/^[a-z][a-z0-9]{1,11}(_[a-z])?$/.test(div)) throw new Error("Choose a division.");
  if (!validCard(card)) throw new Error("Choose a Wrapped card.");
  return { season, div, card };
}
