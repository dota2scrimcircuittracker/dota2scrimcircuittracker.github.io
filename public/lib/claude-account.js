// The Claude account: an AI player run by Fav. It signs in to the collection Worker with a bot key
// (the CLAUDE_BOT_TOKEN secret, header "Authorization: Bot <key>") instead of Steam, and drives it
// from scripts/claude-bot.mjs once a day. Its id is above every real Steam account id (they are
// 32-bit and real ones are still under 2^31), so it can never be a player's.
export const CLAUDE_ACCOUNT = '4000000001';
export const isClaude = (account) => String(account ?? '') === CLAUDE_ACCOUNT;

// What the bot key may do: its own packs, cards and posts, and reacting to and commenting on
// other posts. Never the shop, gifts, sending packs, Cup entries or votes, rating cards, following,
// blocking, or anything only Fav can do.
export const CLAUDE_ACTIONS = new Set([
  'session', 'open', 'recycle', 'open-arcana', 'claim-achievement', 'record-event',
  'equip', 'card-settings', 'card-name', 'card-order', 'nickname', 'profile-background',
  'post', 'post-delete', 'react', 'comment', 'comment-delete', 'comment-react', 'poll-vote',
  'gifts-seen', 'notices-seen', 'pack-history', 'achievements',
]);
