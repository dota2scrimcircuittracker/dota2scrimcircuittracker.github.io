// Achievements on a player's profile: each one pays a pack the first time it's claimed.
// The collection Worker (workers/steam-auth/src/cosmetics.js) counts the facts from what it
// stores and grants the packs, so the browser claiming one proves nothing. Achievements marked
// `soon` depend on data the Worker can't read yet: the profile lists them with their reward but they can't be claimed.
import { TIERS } from './cosmetics-catalog.js';
import { parsePack, isThemedPack, themedLabel } from './pack-types.js';

// A reward is a pack (lib/pack-types.js): 'common' (a normal card pack of that rarity or better),
// 'screens' (a background pack of loading screens), or '<rarity>:<kind>' for a themed pack: border,
// finish or signature (which includes modifiers). Player card packs aren't built yet, so a reward
// of that kind is named but can't be claimed.
export function rewardParts(reward) {
  const { tier, kind } = parsePack(reward);
  return reward === 'screens' ? { tier: null, kind: 'background' } : { tier, kind };
}
// "Common pack", "Background pack", "Epic signature pack".
export function rewardLabel(reward) {
  if (reward === 'screens') return 'Background pack';
  const { tier, kind } = parsePack(reward);
  return kind ? themedLabel(reward) : `${tier[0].toUpperCase()}${tier.slice(1)} pack`;
}
export const rewardGrantable = (reward) => TIERS.includes(reward) || reward === 'screens' || isThemedPack(reward);

// goal: how many of `stat` it takes. reward: the pack tier. Order here is the order shown.
export const ACHIEVEMENTS = [
  { id: 'post-1', group: 'Feed', title: 'First post', text: 'Make a post on the Feed.', stat: 'posts', goal: 1, reward: 'common' },
  { id: 'post-5', group: 'Feed', title: 'Regular', text: 'Make 5 posts on the Feed.', stat: 'posts', goal: 5, reward: 'rare:signature' },
  { id: 'comment-1', group: 'Feed', title: 'Chime in', text: "Comment on another player's post.", stat: 'comments', goal: 1, reward: 'common' },
  { id: 'comment-10', group: 'Feed', title: 'Conversation starter', text: "Leave 10 comments on other players' posts.", stat: 'comments', goal: 10, reward: 'rare:finish' },
  { id: 'follow-10', group: 'Feed', title: 'Well connected', text: 'Follow 10 players.', stat: 'follows', goal: 10, reward: 'common' },
  { id: 'followers-25', group: 'Feed', title: 'Fan favourite', text: 'Have 25 followers.', stat: 'followers', goal: 25, reward: 'epic:signature' },
  { id: 'rate-5', group: 'Cards', title: 'Critic', text: "Rate 5 cards from other players.", stat: 'rated', goal: 5, reward: 'common' },
  { id: 'rate-25', group: 'Cards', title: 'Tastemaker', text: "Rate 25 cards from other players.", stat: 'rated', goal: 25, reward: 'rare' },
  { id: 'rate-100', group: 'Cards', title: 'Hall of fame judge', text: "Rate 100 cards from other players.", stat: 'rated', goal: 100, reward: 'epic' },
  { id: 'cards-1', group: 'Cards', title: 'Designer', text: 'Save a card design.', stat: 'cards', goal: 1, reward: 'common:border' },
  { id: 'cards-3', group: 'Cards', title: 'Full set', text: 'Save all 5 of your card designs.', stat: 'cards', goal: 5, reward: 'rare:border' },
  { id: 'legend-5', group: 'Cards', title: 'Crowd pleaser', text: 'Get 5 legendary votes on one of your cards.', stat: 'legendaryVotes', goal: 5, reward: 'rare:finish' },
  { id: 'legend-15', group: 'Cards', title: 'Certified legendary', text: 'Get 15 legendary votes on one of your cards.', stat: 'legendaryVotes', goal: 15, reward: 'epic' },
  { id: 'nickname', group: 'Profile', title: 'Make it yours', text: 'Choose a nickname.', stat: 'nickname', goal: 1, reward: 'common' },
  { id: 'background', group: 'Profile', title: 'Set the scene', text: 'Use a loading screen as your profile background.', stat: 'background', goal: 1, reward: 'common:signature' },
  { id: 'signature', group: 'Profile', title: 'Sign here', text: 'Add your signature to your profile background.', stat: 'signature', goal: 1, reward: 'common:border' },
  { id: 'send-pack', group: 'Profile', title: 'Generous', text: 'Send another player a pack from your inventory.', stat: 'packsSent', goal: 1, reward: 'common' },
  { id: 'playoffs', group: 'League', title: 'Made the cut', text: 'Make the playoffs with your team.', reward: 'rare', stat: 'playoffs', goal: 1 },
  { id: 'upper-bracket', group: 'League', title: 'Upper class', text: 'Start the playoffs in the upper bracket.', reward: 'epic', stat: 'upperBracket', goal: 1 },
  { id: 'grand-final', group: 'League', title: 'Grand finalist', text: 'Play in a grand final.', reward: 'epic', stat: 'grandFinal', goal: 1 },
  { id: 'league-win', group: 'League', title: 'League champion', text: 'Win your league.', reward: 'legendary', stat: 'leagueWin', goal: 1 },
  { id: 'tiebreaker', group: 'League', title: 'Clutch', text: 'Win a week 8 tiebreaker.', reward: 'rare', stat: 'tiebreaker', goal: 1 },
  { id: 'predict', group: 'Predict', title: 'Called it', text: 'Predict a match outcome.', reward: 'common', stat: 'predictions', goal: 1 },
  { id: 'fantasy-lineup', group: 'Predict', title: 'Manager', text: 'Submit a Fantasy lineup.', stat: 'fantasyWeeks', goal: 1, reward: 'common' },
  { id: 'fantasy-streak', group: 'Predict', title: 'Never miss a week', text: 'Submit a Fantasy lineup 5 weeks in a row.', stat: 'fantasyStreak', goal: 5, reward: 'epic' },
  { id: 'bracket', group: 'Predict', title: 'Bracketologist', text: 'Make a playoff bracket.', reward: 'common', stat: 'brackets', goal: 1 },
  { id: 'best-bracket', group: 'Predict', title: 'Best bracket', text: 'Have the highest-scoring playoff bracket in your league.', reward: 'epic', soon: true },
  { id: 'hero-grid', group: 'Drafter', title: 'Grid builder', text: 'Save a hero grid.', reward: 'common', stat: 'heroGrids', goal: 1 },
  { id: 'draft', group: 'Drafter', title: 'Drafted', text: 'Complete a draft with the Drafter.', reward: 'rare', stat: 'drafts', goal: 1 },
  { id: 'fantasy-win', group: 'Predict', title: 'Fantasy champion', text: 'Win a Fantasy league.', reward: 'legendary', soon: true },
];

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id) ?? null;

// Every achievement with how far along `facts` has it: { ...achievement, value, done, claimed }.
// claims: { [id]: claimedAt }.
export function achievementStatus(facts = {}, claims = {}) {
  return ACHIEVEMENTS.map((a) => {
    const value = a.soon ? 0 : Math.min(a.goal, Number(facts[a.stat]) || 0);
    return { ...a, value, done: !a.soon && value >= a.goal, claimed: !!claims?.[a.id], payable: rewardGrantable(a.reward) };
  });
}

// The state after claiming `id`: one pack of its reward tier, and the claim recorded. Throws if
// it's unknown, not yet earned, can't be claimed yet, or already claimed.
export function claimAchievement(state, id, facts, now = Date.now()) {
  const a = achievementById(id);
  if (!a) throw new Error('Choose an achievement.');
  if (a.soon) throw new Error("That achievement isn't available yet.");
  if (state.achievementClaims?.[id]) throw new Error('You already claimed that reward.');
  if ((Number(facts?.[a.stat]) || 0) < a.goal) throw new Error("You haven't earned that yet.");
  if (!rewardGrantable(a.reward)) throw new Error(`${rewardLabel(a.reward)}s aren't available yet.`);
  return { ...state, packs: [...(state.packs ?? []), a.reward], achievementClaims: { ...(state.achievementClaims ?? {}), [id]: now } };
}

// Claimable now: earned, live, its pack exists, not yet claimed.
export const claimable = (facts, claims) => achievementStatus(facts, claims).filter((a) => a.done && !a.claimed && a.payable);

// From a player's Fantasy entries (Firestore, ids "<league>_<week>_<account>", week = "YYYY-MM-DD"):
// how many different weeks they entered, and their longest run of back-to-back weeks. A week
// counts once however many leagues they entered; back to back means exactly 7 days apart.
export function fantasyFacts(entries) {
  const weeks = [...new Set((entries ?? []).map((e) => e?.week).filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w)))].sort();
  const day = (w) => Date.parse(`${w}T00:00:00Z`) / 864e5;
  let streak = 0, run = 0;
  weeks.forEach((w, i) => { run = i && day(w) - day(weeks[i - 1]) === 7 ? run + 1 : 1; streak = Math.max(streak, run); });
  return { fantasyWeeks: weeks.length, fantasyStreak: streak };
}
