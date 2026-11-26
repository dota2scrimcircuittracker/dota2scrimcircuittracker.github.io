// AD2L Wrapped: a season in review. The league's awards and each player's own recap, worked out
// from a division's (or All's) withDerived games. No page code: pages/wrapped.js draws it, and a
// player's profile shows the one card they pinned (lib/cosmetics-engine.js setWrappedPin).
import { playerKey, mainAccount, gameMvp, mvpRate, hasDetails, isRemake } from "./stats.js";
import { laneBoard } from "./lanes.js";
import { postseason, playoffPicture, TBD } from "./playoffs.js";
import { fitRatings, gameSeriesOdds, gamePostOdds } from "./predict.js";
import { isPostseason, groupStage } from "./divisions.js";
import { isPlayed } from "./schedule.js";
import { ordinal } from "./ranks.js";
import { phasedDraft } from "./draft.js";

// The cards a player's recap can show (lib/wrapped-cards.js), in story order. award:<key> cards
// (an award they won) sit after "mvps". A pin names one of these.
export { PLAYER_CARDS, AWARDS, validCard } from "./wrapped-cards.js";

// Played games only: details on all ten players and not a remake.
export const seasonGames = (games) => games.filter((m) => hasDetails(m) && !isRemake(m) && m.winner);

const sum = (xs, f) => xs.reduce((s, x) => s + (f(x) ?? 0), 0);
const won = (m, p) => p.team === m.winner;

// Every player's rows: key → { key, p (latest row), rows: [{ m, p }] }.
// The team a player played most of their games for (newest game breaks a tie): { name, id }.
// Games come newest first, so a sub's one-off game for another side is often their *last* row;
// it must not become their team (Icarus: one sub game for o-b-j, the rest for Damage Over Time).
export function mainTeamOf(rows) {
  const n = new Map();
  rows.forEach(({ m, p }, i) => {
    const id = p.team === "a" ? m.team_a_id : m.team_b_id, name = p.team_name ?? (p.team === "a" ? m.team_a : m.team_b);
    const k = id ?? name, e = n.get(k) ?? { id, name, n: 0, first: i };
    e.n++; n.set(k, e);
  });
  const best = [...n.values()].sort((a, b) => b.n - a.n || a.first - b.first)[0];
  return best ? { id: best.id ?? null, name: best.name ?? null } : { id: null, name: null };
}
export function byPlayer(games) {
  const out = new Map();
  for (const m of games) for (const p of m.players) {
    const k = playerKey(p), e = out.get(k) ?? { key: k, p, rows: [] };
    e.rows.push({ m, p }); e.p = p; out.set(k, e);
  }
  for (const e of out.values()) e.team = mainTeamOf(e.rows);
  return out;
}

// Per-game averages a player can rank in. Each: [key, label, value(rows), format].
const per = (rows, f) => sum(rows, ({ m, p }) => f(p, m)) / rows.length;
export const SIGNATURE_STATS = [
  ["kills", "kills a game", (r) => per(r, (p) => p.kills), 1],
  ["assists", "assists a game", (r) => per(r, (p) => p.assists), 1],
  ["kp", "kill participation", (r) => per(r, (p) => p.kill_participation), "%"],
  ["gpm", "gold a minute", (r) => per(r, (p) => p.gpm), 0],
  ["dpm", "hero damage a minute", (r) => per(r, (p) => p.dmg_per_min), 0],
  ["tower", "tower damage a game", (r) => per(r, (p) => p.tower_damage), 0],
  ["heal", "healing a game", (r) => per(r, (p) => p.hero_healing), 0],
  ["wards", "wards placed a game", (r) => per(r, (p) => (p.obs_placed ?? 0) + (p.sen_placed ?? 0)), 1],
  ["dewards", "wards killed a game", (r) => per(r, (p) => (p.obs_killed ?? 0) + (p.sen_killed ?? 0)), 1],
  ["stacks", "camps stacked a game", (r) => per(r, (p) => p.camps_stacked), 1],
  ["stuns", "seconds of stuns a game", (r) => per(r, (p) => p.stuns), 1],
  ["lh10", "last hits at 10 minutes", (r) => per(r, (p) => p.lh10), 1],
];
// Stats a position isn't judged on: a support's last hits, a carry's wards.
const SKIP = { lh10: [4, 5], heal: [], wards: [1, 2], stacks: [], dewards: [] };

// Players with at least min games, the bar for awards and ranks.
export const MIN_GAMES = 3;
const mainPos = (rows) => {
  const n = {};
  for (const { p } of rows) if (p.position) n[p.position] = (n[p.position] ?? 0) + 1;
  return Number(Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0]) || null;
};

// One player's season. games: the division's season games; key: their playerKey. cuts: lane cuts
// (lib/lanes.js laneCuts) or null. Null when they played no games.
// results: the league's seasonResults, for the team's finish and the playoffs/group split.
export function playerWrapped(games, key, { cuts = null, awards = [], results = null } = {}) {
  const players = byPlayer(games), me = players.get(key);
  if (!me) return null;
  const rows = me.rows, wins = rows.filter(({ m, p }) => won(m, p)).length;
  const heroes = new Map();
  for (const { m, p } of rows) {
    const h = heroes.get(p.hero) ?? { hero: p.hero, n: 0, w: 0, k: 0, d: 0, a: 0 };
    h.n++; h.w += won(m, p) ? 1 : 0; h.k += p.kills; h.d += p.deaths; h.a += p.assists;
    heroes.set(p.hero, h);
  }
  const byPlays = [...heroes.values()].sort((a, b) => b.n - a.n || b.w - a.w);
  const topHeroes = byPlays.slice(0, 3);
  // Best hero: the highest win rate on 2+ games, then more games, then more wins.
  const bestHero = [...heroes.values()].filter((h) => h.n >= 2).sort((a, b) => b.w / b.n - a.w / a.n || b.n - a.n || b.w - a.w)[0] ?? null;
  // Best game: their highest share of a game they won (any game if they never won).
  const pool = rows.some(({ m, p }) => won(m, p)) ? rows.filter(({ m, p }) => won(m, p)) : rows;
  const best = pool.reduce((top, x) => (!top || mvpRate(x.m, x.p) > mvpRate(top.m, top.p) ? x : top), null);
  const mvps = rows.filter(({ m, p }) => gameMvp(m) === p).length;
  // MVP rank: among players with MIN_GAMES, by MVPs then fewer games.
  const ranked = [...players.values()].filter((e) => e.rows.length >= MIN_GAMES);
  const mvpOf = (e) => e.rows.filter(({ m, p }) => gameMvp(m) === p).length;
  const mvpRank = rows.length >= MIN_GAMES && mvps ? 1 + ranked.filter((e) => mvpOf(e) > mvps).length : null;
  return {
    key, p: me.p, team: me.team.name, games: rows.length, wins, losses: rows.length - wins,
    minutes: Math.round(sum(rows, ({ m }) => m.duration_sec) / 60),
    kills: sum(rows, ({ p }) => p.kills), deaths: sum(rows, ({ p }) => p.deaths), assists: sum(rows, ({ p }) => p.assists),
    // played: every hero they played, most played first (the Wrapped slides take turns with them).
    heroCount: heroes.size, heroes: topHeroes, played: byPlays.map((h) => h.hero), bestHero,
    best: best && { m: best.m, p: best.p, rate: mvpRate(best.m, best.p), won: won(best.m, best.p) },
    mvps, mvpRank, ranked: ranked.length,
    signature: signatureOf(players, me),
    lane: cuts ? laneOf(games, key, cuts) : null,
    nemesis: nemesisOf(rows),
    bans: targetedBans(rows, heroPlays(players)),
    awards: awards.filter((a) => a.player === key),
    dead: deadTimeOf(rows),
    hit: biggestHitOf(rows),
    highlights: highlightsOf(rows),
    personality: personalityOf(players, me),
    ...phasesOf(rows, results),
    // The new version's extras (pages/wrapped.js, FAV_WALLS): Fav's feedback, 2026-11-24.
    heroes5: byPlays.slice(0, 5),
    sigMore: sigMoreOf(players, me),
    mvpWhy: mvpWhyOf(players, me),
    hits: topHitsOf(rows, 3),
    deadRole: deadRoleOf(players, me),
    nemesisMore: nemesisMoreOf(rows),
    mostStacks: rows.reduce((b, x) => ((x.p.camps_stacked ?? 0) > (b?.p.camps_stacked ?? 0) ? x : b), null),
  };
}

// Time spent dead: seconds over the games that record it, and the game they spent longest dead in.
// { seconds, games, worst: { m, p, seconds } }, or null with no record.
// The signature stat's best single game and the division's average, plus kill share for kills.
function sigMoreOf(players, me) {
  const sig = signatureOf(players, me);
  if (!sig) return null;
  const f = SIGNATURE_STATS.find(([k]) => k === sig.stat)[2];
  const best = me.rows.reduce((b, x) => { const v = f([x]); return v != null && (!b || v > b.v) ? { v, m: x.m, p: x.p } : b; }, null);
  const field = [...players.values()].filter((e) => e.rows.length >= MIN_GAMES).map((e) => f(e.rows)).filter(Number.isFinite);
  const out = { best, avg: field.reduce((a, b) => a + b, 0) / Math.max(1, field.length) };
  if (sig.stat === "kills") {
    const team = sum(me.rows, ({ m, p }) => sum(m.players.filter((q) => q.team === p.team), (q) => q.kills));
    out.share = team ? sum(me.rows, ({ p }) => p.kills) / team : null;
    out.multi = [0, 1, 2, 3].map((i) => sum(me.rows, ({ p }) => (Array.isArray(p.multi) ? p.multi[i] ?? 0 : 0)));
  }
  return out;
}
// What earns a game MVP (stats.js mvpRate): their average damage share, kill participation and
// net-worth share, against the average of everyone with MIN_GAMES. Plus their best MVP game.
function mvpWhyOf(players, me) {
  const parts = (rows) => {
    const nw = (m, p) => p.net_worth / (m.teamTotals?.[p.team]?.net_worth || sum(m.players.filter((q) => q.team === p.team), (q) => q.net_worth) || 1);
    return { dmg: sum(rows, ({ p }) => p.dmg_share ?? 0) / rows.length, kp: sum(rows, ({ p }) => p.kill_participation ?? 0) / rows.length, nw: sum(rows, ({ m, p }) => nw(m, p)) / rows.length };
  };
  const field = [...players.values()].filter((e) => e.rows.length >= MIN_GAMES).map((e) => parts(e.rows));
  const avg = (k) => field.reduce((a, b) => a + b[k], 0) / Math.max(1, field.length);
  const mvps = me.rows.filter(({ m, p }) => gameMvp(m) === p);
  const best = mvps.reduce((b, x) => (!b || mvpRate(x.m, x.p) > mvpRate(b.m, b.p) ? x : b), null);
  const byHero = new Map(); for (const { p } of mvps) byHero.set(p.hero, (byHero.get(p.hero) ?? 0) + 1);
  return { me: parts(me.rows), avg: { dmg: avg("dmg"), kp: avg("kp"), nw: avg("nw") }, best, topHero: [...byHero].sort((a, b) => b[1] - a[1])[0] ?? null };
}
// Their biggest per-game hits, biggest first.
function topHitsOf(rows, n) {
  return rows.filter(({ p }) => Array.isArray(p.max_hit) && p.max_hit[0] > 0)
    .map(({ m, p }) => ({ damage: p.max_hit[0], source: p.max_hit[1] ?? null, target: p.max_hit[2] ?? null, m, p }))
    .sort((a, b) => b.damage - a.damage).slice(0, n);
}
// Time dead a game for players at their main position in the division (MIN_GAMES), to compare.
function deadRoleOf(players, me) {
  const pos = mainPos(me.rows);
  if (!pos) return null;
  const vals = [...players.values()].filter((e) => e.rows.length >= MIN_GAMES && mainPos(e.rows) === pos)
    .map((e) => sum(e.rows, ({ p }) => p.time_dead) / e.rows.length).filter((v) => v > 0);
  return vals.length >= 3 ? { pos, perGame: vals.reduce((a, b) => a + b, 0) / vals.length, of: vals.length } : null;
}
// The nemesis's detail: who played it against them, their record and KDA in those games against
// their season's, and the runner-up.
function nemesisMoreOf(rows) {
  const top = nemesisOf(rows);
  if (!top) return null;
  const games = rows.filter(({ m, p }) => m.players.some((q) => q.team !== p.team && q.hero === top.hero));
  const who = new Map(); for (const { m, p } of games) { const q = m.players.find((x) => x.team !== p.team && x.hero === top.hero); who.set(q.name, (who.get(q.name) ?? 0) + 1); }
  const kda = (rs) => (sum(rs, ({ p }) => p.kills + p.assists) / Math.max(1, sum(rs, ({ p }) => p.deaths)));
  const win = games.find(({ m, p }) => won(m, p)) ?? null;
  const by = new Map();
  for (const { m, p } of rows) for (const q of m.players) {
    if (q.team === p.team || q.hero === top.hero) continue;
    const e = by.get(q.hero) ?? { hero: q.hero, n: 0, lost: 0 }; e.n++; if (!won(m, p)) e.lost++; by.set(q.hero, e);
  }
  const next = [...by.values()].filter((e) => e.lost >= 2).sort((a, b) => b.lost - a.lost || a.n - b.n)[0] ?? null;
  return { who: [...who].sort((a, b) => b[1] - a[1]), kdaVs: kda(games), kdaAll: kda(rows), win, next };
}
export function deadTimeOf(rows) {
  const xs = rows.filter(({ p }) => Number.isFinite(p.time_dead));
  if (!xs.length) return null;
  const worst = xs.reduce((a, b) => (b.p.time_dead > a.p.time_dead ? b : a));
  return { seconds: sum(xs, ({ p }) => p.time_dead), games: xs.length, worst: { m: worst.m, p: worst.p, seconds: worst.p.time_dead } };
}

// Their hardest single hit of the season (max_hit: [damage, ability or item key, target hero slug]).
// { damage, source, target, m, p }, or null.
export function biggestHitOf(rows) {
  let top = null;
  for (const { m, p } of rows) {
    const h = p.max_hit;
    if (!Array.isArray(h) || !(h[0] > 0)) continue;
    if (!top || h[0] > top.damage) top = { damage: h[0], source: h[1] ?? null, target: h[2] ?? null, m, p };
  }
  return top;
}

// Multi-kills [double, triple, ultra, rampage], their longest kill streak (3 … 10, 10 = 10+) and
// first bloods, over the games with combat stats. Null with none.
export function highlightsOf(rows) {
  const xs = rows.filter(({ p }) => Array.isArray(p.multi));
  if (!xs.length) return null;
  const multi = [0, 0, 0, 0];
  let streak = 0, firstBloods = 0;
  for (const { p } of xs) {
    p.multi.forEach((n, i) => { if (i < 4) multi[i] += n ?? 0; });
    const top = Array.isArray(p.streaks) ? p.streaks.findLastIndex((n) => n > 0) : -1;
    if (top >= 0) streak = Math.max(streak, top + 3);
    if (p.first_blood === 1) firstBloods++;
  }
  return { games: xs.length, multi, streak, firstBloods };
}

// Dota personalities: how a player plays, from where they rank among players with MIN_GAMES on
// fourteen traits (eighteen with the draft ones). A personality is named for two traits (PERSONALITY_NAMES, "a+b" in TRAITS
// order), or one alone: every trait alone and every pair but UNNAMED_PAIRS (the same stat both
// ways). personalityOf is a player's best fit; leaguePersonalities shares the names out across
// the league so few players share one (lib/wrapped.js).
// Each trait: [key, label of the stat shown, value per game (p, m, x: see draft traits), { low: fewer
// is the trait, fmt, draft: a draft trait (opt.draft only), only: average over the games it has a
// value for (drafted games), not every game }].
const avg = (rows, f, e, only) => {
  if (!only) return per(rows, (p, m) => f(p, m, e) ?? 0);
  const v = rows.map(({ p, m }) => f(p, m, e)).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};
const has = (rows, f, e) => rows.some(({ p, m }) => f(p, m, e) != null);
// Draft traits. x: { e (the player's entry), plays (heroPlays of the league) }.
// A player's games on each hero, and on their most played.
const heroCache = new WeakMap();
const heroGames = (e) => {
  if (heroCache.has(e)) return heroCache.get(e);
  const n = new Map();
  for (const { p } of e.rows) if (p.hero) n.set(p.hero, (n.get(p.hero) ?? 0) + 1);
  const out = { n, top: Math.max(0, ...n.values()) };
  heroCache.set(e, out);
  return out;
};
// Opponents' bans on their heroes in a drafted game, by targetedBans' rule: a ban is theirs when
// they've played that hero at least as often as any teammate in that game.
const bansOn = (p, m, x) => {
  if (!m?.draft?.length) return null;
  const mates = m.players.filter((q) => q.team === p.team);
  return m.draft.filter((s) => {
    if (s.pick || s.side === p.team) return false;
    const n = x.plays(playerKey(p), s.hero);
    return n > 0 && !mates.some((q) => x.plays(playerKey(q), s.hero) > n);
  }).length;
};
// 1 when their hero was their team's last (5th) pick, 0 when not, null with no draft.
const lastPick = (p, m) => {
  if (!m?.draft?.length) return null;
  const s = phasedDraft(m.draft).find((d) => d.kind === "pick" && d.side === p.team && d.hero === p.hero);
  return s ? (s.team_pick === 5 ? 1 : 0) : null;
};
export const TRAITS = [
  ["vision", "wards placed and killed a game", (p) => (p.obs_placed ?? 0) + (p.sen_placed ?? 0) + (p.obs_killed ?? 0) + (p.sen_killed ?? 0), { fmt: 1 }],
  ["stacks", "camps stacked a game", (p) => p.camps_stacked, { fmt: 1 }],
  ["damage", "hero damage a minute", (p) => p.dmg_per_min],
  ["deaths", "deaths a game", (p) => p.deaths, { fmt: 1 }],
  ["towers", "tower damage a game", (p) => p.tower_damage],
  ["fights", "of their team's fights joined", (p) => p.tf_part, { fmt: "%" }],
  ["gold", "gold a minute", (p) => p.gpm],
  ["alive", "deaths a game", (p) => p.deaths, { low: true, fmt: 1 }],
  ["heal", "healing a game", (p) => p.hero_healing],
  ["stuns", "seconds of stuns a game", (p) => p.stuns, { fmt: 1 }],
  ["pings", "map pings a game", (p) => p.pings],
  ["apm", "actions a minute", (p) => p.apm],
  ["kills", "kills a game", (p) => p.kills, { fmt: 1 }],
  ["runes", "runes picked up a game", (p) => (Array.isArray(p.runes) ? p.runes.reduce((a, b) => a + (b ?? 0), 0) : null), { fmt: 1 }],
  // Draft traits (Fav 2026-11-25: "having some dota personalities around draft attributes").
  ["banned", "bans on their heroes a game", bansOn, { fmt: 1, draft: true, only: true }],
  ["pool", "different heroes played", (p, m, x) => heroGames(x.e).n.size, { draft: true }],
  ["comfort", "of games on their top hero", (p, m, x) => heroGames(x.e).top / x.e.rows.length, { fmt: "%", draft: true }],
  ["last", "of drafts as the last pick", lastPick, { fmt: "%", draft: true, only: true }],
];
// Pairs with no name: the same stat both ways, or near enough.
export const UNNAMED_PAIRS = ["deaths+alive", "pool+comfort"];
export const PERSONALITY_NAMES = {
  vision: ["The Ward Goblin", "Every bush, every cliff, every high ground. If it's dark, they lit it."],
  stacks: ["The Stacker", "Pulls camps at :53 in their sleep. The carry's favourite teammate."],
  damage: ["The Nuke", "Shows up, presses everything, leaves a crater."],
  deaths: ["The Kamikaze", "First in, first dead, first to type 'my bad'."],
  towers: ["The Rat", "While everyone fights, a tower quietly falls somewhere else."],
  fights: ["The Teamfight Magnet", "Never misses a fight. Shows up to every one, invited or not."],
  gold: ["The Farmer", "The jungle is a buffet and they have a reservation."],
  alive: ["The Unkillable", "Dies less than anyone. Enemy heroes have stopped trying."],
  heal: ["The Healer", "Keeping four people alive, one heal at a time."],
  stuns: ["The Lockdown", "If it moves, it gets stunned. If it doesn't move, it was already stunned."],
  pings: ["The Pinger", "Their team heard every single one."],
  apm: ["The Button Masher", "Their keyboard has filed a complaint."],
  "vision+stacks": ["The Jungle Janitor", "Wards the camp, stacks the camp, tidies the camp."],
  "vision+damage": ["The Sniper Scout", "Sees you first. Hits you hardest."],
  "vision+deaths": ["The Ward Martyr", "Died for that ward. Would do it again."],
  "vision+towers": ["The Map Thief", "Lights up the map, then takes it piece by piece."],
  "vision+fights": ["The Spotter", "Lights the fight, then shows up for it."],
  "vision+gold": ["The Rich Support", "Somehow farmed while warding. Nobody knows how."],
  "vision+alive": ["The Ghost", "Plants a ward and vanishes. Never caught."],
  "vision+heal": ["The Lighthouse", "Lights the way, and patches you up when you get lost anyway."],
  "vision+stuns": ["The Trapper", "Sees you coming. You don't see the stun coming."],
  "vision+pings": ["The Air Traffic Controller", "Wards everything, then pings every ward."],
  "vision+apm": ["The Overcaffeinated Support", "Wards, dewards, rewards. All in the same second."],
  "stacks+damage": ["The Chef", "Preps the camps, cooks the enemies."],
  "stacks+deaths": ["The Pull Gone Wrong", "Went to stack the camp. The camp stacked them."],
  "stacks+towers": ["The Quartermaster", "Stacks for the carry, pushes for the team."],
  "stacks+fights": ["The Prepper", "Stacks between fights. Never misses one."],
  "stacks+gold": ["The Investor", "Stacks today, cashes out tomorrow."],
  "stacks+alive": ["The Camp Counselor", "Always at a camp, never in trouble."],
  "stacks+heal": ["The Team Mom", "Snacks stacked, wounds patched."],
  "stacks+stuns": ["The Ambusher", "Waits by the camp. Stuns whoever comes to farm it."],
  "stacks+pings": ["The Stopwatch", "Pings the stack timing. Every. Single. Minute."],
  "stacks+apm": ["The Speedrunner", "Pulled, stacked and pulled again before you blinked."],
  "damage+deaths": ["The Glass Cannon", "Hits like a truck. Folds like a lawn chair."],
  "damage+towers": ["The Wrecking Ball", "Heroes or buildings, it all comes down."],
  "damage+fights": ["The Main Character", "Every teamfight is their highlight reel."],
  "damage+gold": ["The Hard Carry", "Farmed it, spent it, dealt it."],
  "damage+alive": ["The Assassin", "Deals all the damage, takes none of it."],
  "damage+heal": ["The Battle Medic", "Hurts them, heals you. Why pick one?"],
  "damage+stuns": ["The Executioner", "Stuns you, then finishes the job."],
  "damage+pings": ["The Backseat Carry", "Does the damage and makes sure everyone knows it."],
  "damage+apm": ["The Combo Machine", "Fast fingers, big numbers."],
  "deaths+towers": ["The Tower Diver", "Dove the tower. Got the tower. Died to the tower."],
  "deaths+fights": ["The Frontliner", "First into every fight, rarely the last one out."],
  "deaths+gold": ["The Walking Bounty", "Rich, reckless, and worth a lot to the other team."],
  "deaths+heal": ["The Martyr Medic", "Heals everyone but themselves."],
  "deaths+stuns": ["The Initiator", "Jumps in, stuns five, dies happy."],
  "deaths+pings": ["The Danger Ping", "Pinged danger. Walked into it anyway."],
  "deaths+apm": ["The Panic Button", "A lot of buttons got pressed. Some of them helped."],
  "towers+fights": ["The Siege Engine", "Wins the fight, takes the tower, every time."],
  "towers+gold": ["The Split Pusher", "Farms a lane nobody's watching, then a tower's gone."],
  "towers+alive": ["The Rat King", "Takes towers alone and is never caught."],
  "towers+heal": ["The Siege Support", "Keeps the push alive, one heal at a time."],
  "towers+stuns": ["The Breacher", "Locks the defenders down, kicks the door in."],
  "towers+pings": ["The Objective Caller", "'Tower.' 'Tower.' 'Tower.' They were right."],
  "towers+apm": ["The Demolition Crew", "Hits buildings fast. Very, very fast."],
  "fights+gold": ["The Rich Brawler", "Farms fast, fights faster."],
  "fights+alive": ["The Survivor", "In every fight, still standing after it."],
  "fights+heal": ["The Field Medic", "Wherever the fight is, so is the heal."],
  "fights+stuns": ["The Playmaker", "Starts the fights the team wins."],
  "fights+pings": ["The Shotcaller", "Calls the fight, then shows up for it."],
  "fights+apm": ["The Brawler", "Every fight, every button."],
  "gold+alive": ["The Bank", "Rich, alive, and very hard to rob."],
  "gold+heal": ["The Benefactor", "Farmed it all, then spent it keeping you alive."],
  "gold+stuns": ["The Bully", "Big net worth, bigger stuns."],
  "gold+pings": ["The Accountant", "Pings the farm, takes the farm."],
  "gold+apm": ["The Farming Simulator", "Every creep, every camp, every second."],
  "alive+heal": ["The Guardian Angel", "Never dies, and won't let you either."],
  "alive+stuns": ["The Untouchable", "Stuns you from somewhere you can't reach."],
  "alive+pings": ["The Lookout", "Pings the danger. Never in it."],
  "alive+apm": ["The Escape Artist", "Fast hands, faster exits."],
  "heal+stuns": ["The Swiss Army Support", "Stun, heal, repeat."],
  "heal+pings": ["The Nurse on Call", "Pings for help, then brings the help."],
  "heal+apm": ["The Paramedic", "Heals fast. Like, really fast."],
  "stuns+pings": ["The Drill Sergeant", "Pings the target, stuns the target."],
  "stuns+apm": ["The Chain Disabler", "Stun, stun, stun, stun. Gone."],
  "pings+apm": ["The Keyboard Warrior", "Their keyboard and their minimap are both exhausted."],
  kills: ["The Hunter", "Counts kills, not minutes."],
  "vision+kills": ["The Stalker", "Lights up the map, then hunts whoever's on it."],
  "stacks+kills": ["The Poacher", "Stacks the camp, steals the kill."],
  "damage+kills": ["The Slayer", "Big damage, bigger kill count."],
  "deaths+kills": ["The Coin Flip", "Kill or be killed. Usually both."],
  "towers+kills": ["The Raider", "Takes the heroes, then takes the base."],
  "fights+kills": ["The Vulture", "Shows up to every fight, leaves with every kill."],
  "gold+kills": ["The Headhunter", "Every kill is a paycheck."],
  "alive+kills": ["The Terminator", "Kills everyone. Dies to no one."],
  "heal+kills": ["The Vampire", "Takes lives, gives life back."],
  "stuns+kills": ["The Predator", "Catches you, then finishes you."],
  "pings+kills": ["The Kill Caller", "Pings the target, then takes the kill."],
  "apm+kills": ["The Blender", "Fast hands, a lot of corpses."],
  runes: ["The Rune Collector", "Every two minutes, a little treat."],
  "vision+runes": ["The River Warden", "Wards the river, owns the runes."],
  "stacks+runes": ["The Errand Runner", "Stacks a camp, grabs a rune, back before anyone noticed."],
  "damage+runes": ["The Double Damage", "Grabbed the rune and made it count."],
  "deaths+runes": ["The Rune Chaser", "Went for the rune. Found five enemies instead."],
  "towers+runes": ["The Opportunist", "Rune up, tower down."],
  "fights+runes": ["The Power-Up", "Never shows up to a fight without a rune."],
  "gold+runes": ["The Bounty Grabber", "Every bounty rune, every time. Pure profit."],
  "alive+runes": ["The Invisible One", "Grabs the rune and disappears."],
  "heal+runes": ["The Regen Fiend", "Lives off regen runes and gives the rest away."],
  "stuns+runes": ["The Ganker", "Rune in hand, stun ready, here they come."],
  "pings+runes": ["The Rune Reminder", "'Rune.' 'Rune.' 'Rune.' Every two minutes."],
  "apm+runes": ["The Hyperactive Mid", "Fast fingers, faster rune timings."],
  "kills+runes": ["The Mid Menace", "Takes the rune, takes the gank, takes the kill."],
  // Draft personalities.
  banned: ["The Ban Magnet", "The other team spends its bans on them. Every draft."],
  "vision+banned": ["The Most Wanted Support", "They ban the hero. They can't ban the wards."],
  "stacks+banned": ["The Forbidden Support", "Banned on sight. Stacks anyway."],
  "damage+banned": ["The Public Enemy", "Hits so hard the other team drafts around it."],
  "deaths+banned": ["The Reputation", "Banned like a threat. The deaths tell another story."],
  "towers+banned": ["The Siege Threat", "They ban the hero. The towers still fall."],
  "fights+banned": ["The Teamfight Threat", "Ban their hero and they still show up to every fight."],
  "gold+banned": ["The Banned Carry", "Banned first, farmed anyway."],
  "alive+banned": ["The Fugitive", "Wanted in every draft. Never caught in the game."],
  "heal+banned": ["The Contraband Medic", "Their healers keep getting banned. They heal anyway."],
  "stuns+banned": ["The Restraining Order", "The other team keeps them away in the draft. The stuns still land."],
  "pings+banned": ["The Loud Threat", "Banned in the draft, heard all game."],
  "apm+banned": ["The Mechanic", "Their hands are the reason the ban exists."],
  "kills+banned": ["The Most Wanted", "Banned in the draft. Kills you anyway."],
  "runes+banned": ["The Banned Mid", "Their mid heroes go in the ban phase. The runes still go to them."],
  pool: ["The Hero Collector", "A different hero every game. Good luck banning that."],
  "vision+pool": ["The Utility Player", "Any support, any game, wards up."],
  "stacks+pool": ["The Handyman", "Whatever hero you need, the camps get stacked."],
  "damage+pool": ["The Arsenal", "A different weapon every game. All of them hurt."],
  "deaths+pool": ["The Tourist", "Tries every hero once. Dies on most of them."],
  "towers+pool": ["The Contractor", "Any hero, any lane, the tower comes down."],
  "fights+pool": ["The Mercenary", "Picks whatever, joins every fight."],
  "gold+pool": ["The Jack of All Farms", "Farms on every hero they've ever picked."],
  "alive+pool": ["The Chameleon", "A new hero every game, and you never catch any of them."],
  "heal+pool": ["The Locum", "Different hero, same job: keep everyone alive."],
  "stuns+pool": ["The Flex Initiator", "Any hero with a stun is their hero."],
  "pings+pool": ["The Coach", "Has played every hero, so has an opinion on all of them."],
  "apm+pool": ["The Quick Study", "Learns a new hero mid-game. Fast."],
  "kills+pool": ["The Wildcard", "You never know what they'll pick. You know it'll get kills."],
  "runes+pool": ["The Mixtape Mid", "New mid every game, same rune timings."],
  comfort: ["The One-Trick", "One hero. Every game. Ban it, we dare you."],
  "vision+comfort": ["The Lantern Keeper", "Same support, same ward spots, every game."],
  "stacks+comfort": ["The Creature of Habit", "Same hero, same camp, same :53."],
  "damage+comfort": ["The Specialist", "One hero, mastered, aimed at you."],
  "deaths+comfort": ["The Loyalist", "Same hero every game. Same deaths too."],
  "towers+comfort": ["The Pocket Pusher", "One hero, one job: the towers."],
  "fights+comfort": ["The Signature Fighter", "Brings the same hero to every fight. It works."],
  "gold+comfort": ["The Comfort Carry", "One hero, one farm route, one very full inventory."],
  "alive+comfort": ["The Veteran", "Knows one hero so well it never dies."],
  "heal+comfort": ["The Family Doctor", "Same hero, same patients, every game."],
  "stuns+comfort": ["The Stun Specialist", "One hero, one stun, perfect timing."],
  "pings+comfort": ["The Broken Record", "Same hero. Same pings."],
  "apm+comfort": ["The Muscle Memory", "Played that hero so much their hands do it alone."],
  "kills+comfort": ["The Hitman", "One hero, one job, a lot of kills."],
  "runes+comfort": ["The Mid Main", "Same mid hero, every rune, every game."],
  last: ["The Counterpick", "Saved for last, picked to ruin your draft."],
  "vision+last": ["The Last Ward", "Picked last, wards first."],
  "stacks+last": ["The Afterthought", "Picked last, stacks the camps that win it."],
  "damage+last": ["The Hard Counter", "Saved for last, built to delete your draft."],
  "deaths+last": ["The Desperate Pick", "Picked last to counter. Got countered."],
  "towers+last": ["The Siege Answer", "Picked last, and your towers had no answer."],
  "fights+last": ["The Final Piece", "The last pick that makes the teamfight work."],
  "gold+last": ["The Hidden Carry", "Picked last so you can't counter the farm."],
  "alive+last": ["The Unanswered", "Picked last, so nobody had an answer. Never dies."],
  "heal+last": ["The Emergency Pick", "Last pick, there to keep everyone alive."],
  "stuns+last": ["The Lockdown Counter", "Saved for last to stun whatever you picked."],
  "pings+last": ["The Last Word", "Gets the last pick and the last word."],
  "apm+last": ["The Trick Pick", "Last pick, fast hands, you didn't see it coming."],
  "kills+last": ["The Closer", "Picked last, finishes everything."],
  "runes+last": ["The Mid Counter", "Last pick, mid lane, your mid's worst game."],
  "banned+pool": ["The Unbannable", "Ban one hero, they play another. You'd need more bans."],
  "banned+comfort": ["The Permaban", "One hero, banned every game it can be."],
  "banned+last": ["The Hidden Threat", "The other team bans what it can. Then they pick last."],
  "pool+last": ["The Counter Library", "A hero for every draft, picked last."],
  "comfort+last": ["The Pocket Pick", "Always the last pick, always the same hero."],
};
const traitAt = (k) => TRAITS.findIndex(([x]) => x === k);
const nameKey = (ts) => ts.map((t) => t.key).sort((a, b) => traitAt(a) - traitAt(b)).join("+");
// How well a name fits (lower is better): a pair by its weaker trait, one trait alone by that trait
// plus SOLO, so a pair wins whenever its second trait is within SOLO of the first.
const SOLO = 0.25;
// No more than this many players league-wide share a personality.
export const PERSONALITY_CAP = 5;

// Each ranked player's traits in one league: key -> [{ key, label, value, fmt, top }] (strongest
// first; top: the share of the field at or ahead of them, 0-1), and the field's size.
function leagueTraits(players, { draft = false } = {}) {
  const field = [...players.values()].filter((e) => e.rows.length >= MIN_GAMES);
  const out = new Map(), plays = heroPlays(players);
  let of = 0;
  const byTrait = TRAITS.filter(([, , , o = {}]) => draft || !o.draft).map(([key, label, f, o = {}]) => {
    const ctx = (e) => ({ e, plays });
    const vals = new Map(field.filter((e) => has(e.rows, f, ctx(e))).map((e) => [e.key, avg(e.rows, f, ctx(e), o.only)]));
    of = Math.max(of, vals.size);
    return { key, label, o, vals, all: [...vals.values()] };
  });
  for (const e of field) {
    const ts = [];
    for (const { key, label, o, vals, all } of byTrait) {
      const mine = vals.get(e.key);
      if (mine == null || (!(mine > 0) && !o.low)) continue;
      ts.push({ key, label, value: mine, fmt: o.fmt ?? 0, top: all.filter((v) => (o.low ? v <= mine : v >= mine)).length / all.length });
    }
    out.set(e.key, ts.sort((a, b) => a.top - b.top || traitAt(a.key) - traitAt(b.key)));
  }
  return { traits: out, of };
}
// Every name a player could take, best fit first: [{ key, traits, fit }].
// pairsOnly (the new version, Fav 2026-11-24: "nobody wants a one-dimensional personality"; 2026-11-25:
// "i need 2 traits per player minimum"): two-trait names only, never one alone. A player with no
// nameable pair gets no personality.
function candidates(ts, { pairsOnly = false } = {}) {
  const out = ts.map((t) => ({ key: t.key, traits: [t], fit: t.top + SOLO }));
  if (pairsOnly) out.length = 0;
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const key = nameKey([ts[i], ts[j]]);
    if (PERSONALITY_NAMES[key]) out.push({ key, traits: [ts[i], ts[j]], fit: Math.max(ts[i].top, ts[j].top) });
  }
  return out.sort((a, b) => a.fit - b.fit || b.traits.length - a.traits.length);
}
const named = (c, of) => { const [title, blurb] = PERSONALITY_NAMES[c.key]; return { key: c.key, title, blurb, traits: c.traits, of }; };

// A player's personality on their own (their best fit): { key, title, blurb, traits (one or two,
// strongest first), of (players ranked) }, or null under MIN_GAMES.
export function personalityOf(players, me, opt = {}) {
  if (me.rows.length < MIN_GAMES) return null;
  const { traits, of } = leagueTraits(players, opt);
  const best = candidates(traits.get(me.key) ?? [], opt)[0];
  return best ? named(best, of) : null;
}

// Personalities shared out across the league: at most PERSONALITY_CAP players per name, and
// never two in the same division. Best fits go first: every (player, name) pair in fit order, each
// player taking the first name still open to them. A player nothing is open to keeps their best
// fit. leagues: [{ id, players (byPlayer), divisionOf(key) -> a division id }]. Returns
// Map id -> Map key -> personality.
export function leaguePersonalities(leagues, opt = {}) {
  const pairs = [], ofs = new Map(), out = new Map();
  for (const { id, players, divisionOf } of leagues) {
    const { traits, of } = leagueTraits(players, opt);
    ofs.set(id, of); out.set(id, new Map());
    for (const [key, ts] of traits) for (const c of candidates(ts, opt)) pairs.push({ id, key, div: `${id}|${divisionOf(key) ?? ""}`, c });
  }
  pairs.sort((a, b) => a.c.fit - b.c.fit || b.c.traits.length - a.c.traits.length);
  const holders = new Map(); // name -> Set of division ids holding it
  const done = new Set();
  for (const x of pairs) {
    const who = `${x.id}|${x.key}`;
    if (done.has(who)) continue;
    const h = holders.get(x.c.key) ?? holders.set(x.c.key, new Set()).get(x.c.key);
    if (h.size >= PERSONALITY_CAP || h.has(x.div)) continue;
    h.add(x.div); done.add(who);
    out.get(x.id).set(x.key, named(x.c, ofs.get(x.id)));
  }
  // Anyone left (every name full for them) keeps their best fit.
  for (const { id, players } of leagues) {
    const { traits, of } = leagueTraits(players, opt);
    for (const [key, ts] of traits) if (!out.get(id).has(key)) { const c = candidates(ts, opt)[0]; if (c) out.get(id).set(key, named(c, of)); }
  }
  return out;
}

// A player's team finish (their latest team's) and their playoff games against their group-stage
// ones: { finish, playoffs: { games, wins, kills, deaths, assists, mvps, heroes } | null, group: same }.
function phasesOf(rows, results) {
  if (!results) return { finish: null, playoffs: null, group: null };
  const team = mainTeamOf(rows).id;
  const split = (xs) => {
    if (!xs.length) return null;
    const heroes = new Map();
    for (const { m, p } of xs) { const h = heroes.get(p.hero) ?? { hero: p.hero, n: 0, w: 0 }; h.n++; h.w += won(m, p) ? 1 : 0; heroes.set(p.hero, h); }
    return {
      games: xs.length, wins: xs.filter(({ m, p }) => won(m, p)).length,
      kills: sum(xs, ({ p }) => p.kills), deaths: sum(xs, ({ p }) => p.deaths), assists: sum(xs, ({ p }) => p.assists),
      mvps: xs.filter(({ m, p }) => gameMvp(m) === p).length,
      heroes: [...heroes.values()].sort((a, b) => b.n - a.n || b.w - a.w).slice(0, 3),
    };
  };
  const inPlayoffs = ({ m }) => results.playoffSeries.has(m.series_id);
  return { finish: results.teams.get(team) ?? null, playoffs: split(rows.filter(inPlayoffs)), group: split(rows.filter((r) => !inPlayoffs(r))) };
}

// How each team's season went: its group stage (its table's place, game and series records) and
// its playoffs (bracket, finish, series record, who knocked it out). d: a division's { teams,
// series }; split: Heroic/Aegis (two brackets). { teams: Map id -> { team, group: { rank, of,
// division, gw, gl, w, t, l }, playoff: { bracket, place, size, label, w, l, out: { by, label,
// score } | null, alive } | null }, playoffSeries: Set of bracket series ids, champions: [{ team,
// bracket, final: { against, score } }] }.
export function seasonResults(d, { split = false } = {}) {
  const ratings = fitRatings(d.teams, d.series);
  const pic = playoffPicture(d.teams, d.series, ratings, { split });
  const ps = postseason(d.teams, d.series, ratings, { split });
  const playoffSeries = new Set([...ps.roles].filter(([, r]) => r.kind === "bracket").map(([id]) => id));
  const teams = new Map();
  const group = groupStage(d.series).filter(isPlayed);
  for (const dv of pic.divisions) dv.rows.forEach((r, i) => {
    let gw = 0, gl = 0, w = 0, t = 0, l = 0;
    for (const x of group) {
      if (x.home !== r.id && x.away !== r.id) continue;
      const [us, them] = x.home === r.id ? [x.home_score, x.away_score] : [x.away_score, x.home_score];
      gw += us; gl += them; if (us > them) w++; else if (us < them) l++; else t++;
    }
    teams.set(r.id, { team: r.id, group: { rank: i + 1, of: dv.rows.length, division: dv.division || null, gw, gl, w, t, l }, playoff: null });
  });
  const champions = [];
  const brackets = split ? (pic.brackets ?? []).map((b) => [b.name, b.bracket]) : pic.divisions.map((dv) => ["", dv.bracket]);
  for (const [name, b] of brackets) {
    if (!b) continue;
    const ms = b.matches.filter((m) => m.real && !m.bye);
    const ids = [...new Set(b.matches.flatMap((m) => [m.a, m.b]).filter((x) => x != null && x !== TBD))];
    const gf = ms.find((m) => m.id === "gf");
    // Out: lost a lower-bracket match or the grand final. Places go by how late a team went out.
    const outAt = new Map();
    for (const m of ms) if (m.side === "lower" || m.id === "gf") if (m.loser != null && m.loser !== TBD) outAt.set(m.loser, m);
    const champ = gf && gf.winner !== TBD ? gf.winner : null;
    if (champ != null) champions.push({ team: champ, bracket: name || null, final: { against: gf.loser, score: gf.score, series: gf.series_id ?? null } });
    for (const id of ids) {
      const mine = ms.filter((m) => m.a === id || m.b === id);
      const w = mine.filter((m) => m.winner === id).length, l = mine.filter((m) => m.loser === id).length;
      const out = outAt.get(id);
      let place = null, size = 1;
      if (id === champ) place = 1;
      else if (out) {
        // Ahead of it: every team still in (the champion too) and every team out later.
        const later = [...outAt.values()].filter((m) => m.week > out.week).length + ids.filter((x) => !outAt.has(x)).length;
        size = [...outAt.values()].filter((m) => m.week === out.week).length;
        place = later + 1;
      }
      const label = place == null ? "Still in the playoffs" : place === 1 ? "Champions" : place === 2 ? "Runners-up" : size > 1 ? `${ordinal(place)}–${ordinal(place + size - 1)}` : ordinal(place);
      const entry = teams.get(id) ?? { team: id, group: null, playoff: null };
      entry.playoff = { bracket: name || null, place, size, label, w, l, alive: place == null,
        out: out ? { by: out.winner, label: out.label, score: out.score } : null };
      teams.set(id, entry);
    }
  }
  return { teams, playoffSeries, champions };
}
// Every league's results as one (All divisions).
export const mergeResults = (list) => ({
  teams: new Map(list.flatMap((r) => [...r.teams])),
  playoffSeries: new Set(list.flatMap((r) => [...r.playoffSeries])),
  champions: list.flatMap((r) => r.champions),
});

// The stat they rank best in among players with MIN_GAMES at their main position's stats (rank
// 1 = top). Ties go to the earlier stat in SIGNATURE_STATS. Null under MIN_GAMES.
export function signatureOf(players, me) {
  if (me.rows.length < MIN_GAMES) return null;
  const field = [...players.values()].filter((e) => e.rows.length >= MIN_GAMES);
  const pos = mainPos(me.rows);
  let top = null;
  for (const [stat, label, value, fmt] of SIGNATURE_STATS) {
    if ((SKIP[stat] ?? []).includes(pos)) continue;
    const mine = value(me.rows);
    if (mine == null || !Number.isFinite(mine) || mine <= 0) continue;
    const vals = field.map((e) => value(e.rows)).filter((v) => v != null && Number.isFinite(v));
    const rank = 1 + vals.filter((v) => v > mine).length;
    const pctile = rank / vals.length;
    if (!top || pctile < top.pctile) top = { stat, label, value: mine, fmt, rank, of: vals.length, pctile };
  }
  return top;
}

function laneOf(games, key, cuts) {
  const rows = laneBoard(games, cuts, playerKey, 0).filter((r) => r.key === key && r.lanes);
  if (!rows.length) return null;
  const main = rows.sort((a, b) => b.lanes - a.lanes)[0];
  return { group: main.group, lanes: main.lanes, won: main.won, even: main.even, lost: main.lost, margin: main.margin };
}

// Targeted bans: the other side's bans, in their drafted games, of heroes that are theirs. A ban
// is theirs when, of the five on their side that game, they've played that hero the most this
// season (a tie credits each tied player), so a hero two teammates share goes to whoever plays it
// more. plays(key, hero): season games on it. share: the average, over their drafted games, of the
// part of that game's enemy bans that were theirs. { drafts, total, share, heroes: [{ hero, n }]
// (top 3) }, or null with none.
export function targetedBans(rows, plays) {
  const by = new Map();
  let drafts = 0, total = 0, shares = 0;
  for (const { m, p } of rows) {
    if (!m.draft?.length) continue;
    drafts++;
    const mates = m.players.filter((q) => q.team === p.team);
    let bans = 0, mine = 0;
    for (const s of m.draft) {
      if (s.pick || s.side === p.team) continue;
      bans++;
      const n = plays(playerKey(p), s.hero);
      if (!n || mates.some((q) => plays(playerKey(q), s.hero) > n)) continue;
      by.set(s.hero, (by.get(s.hero) ?? 0) + 1); total++; mine++;
    }
    if (bans) shares += mine / bans;
  }
  if (!total) return null;
  const heroes = [...by].map(([hero, n]) => ({ hero, n })).sort((a, b) => b.n - a.n || a.hero.localeCompare(b.hero)).slice(0, 3);
  // byHero: every targeted hero's ban count (the new Wrapped's best-hero pick weighs it).
  return { drafts, total, share: shares / drafts, heroes, byHero: Object.fromEntries(by) };
}
// Season games per player per hero: plays(key, hero).
export function heroPlays(players) {
  const n = new Map();
  for (const e of players.values()) for (const { p } of e.rows) n.set(`${e.key}|${p.hero}`, (n.get(`${e.key}|${p.hero}`) ?? 0) + 1);
  return (key, hero) => n.get(`${key}|${hero}`) ?? 0;
}

// The enemy hero they lost to most (2+ losses), most losses then fewest games against.
export function nemesisOf(rows) {
  const by = new Map();
  for (const { m, p } of rows) for (const q of m.players) {
    if (q.team === p.team) continue;
    const e = by.get(q.hero) ?? { hero: q.hero, n: 0, lost: 0 };
    e.n++; if (!won(m, p)) e.lost++;
    by.set(q.hero, e);
  }
  return [...by.values()].filter((e) => e.lost >= 2).sort((a, b) => b.lost - a.lost || a.n - b.n)[0] ?? null;
}

// Lead changes in a game: the gold lead crossing from one side to the other, after the first
// two minutes and counting only leads of 1k+.
export function leadChanges(m) {
  let side = 0, n = 0;
  for (const [i, g] of (m.gold_adv ?? []).entries()) {
    if (i < 2 || Math.abs(g) < 1000) continue;
    const s = Math.sign(g);
    if (side && s !== side) n++;
    side = s;
  }
  return n;
}

// Series model reads, worked out by the page (pages/wrapped.js): [{ s, home, away, q (home's
// chance in one game), p (the chance of the result that happened) }], decided series only.
// A team's overachievement, scored by surprise: each series it won as the model's underdog
// (its chance to win below its chance to lose) is worth 1 minus that chance, so long-odds wins
// count most. Wins as favourite or in a coin flip score nothing: the model's reads sit near
// 50/50, so counting every win just rewarded the team with the most games (the finalists).
// Postseason series are best-of-n from the winner's score (2 wins: Bo3, 3: Bo5).
export function overachievers(reads) {
  const by = new Map();
  for (const { s, q } of reads) {
    const hs = s.home_score ?? 0, as = s.away_score ?? 0;
    if (hs === as) continue;
    const o = isPostseason(s) ? gamePostOdds(q, s.best_of ?? Math.max(hs, as) * 2 - 1) : gameSeriesOdds(q);
    const [id, opp, win, lose] = hs > as ? [s.home, s.away, o.home, o.away] : [s.away, s.home, o.away, o.home];
    const e = by.get(id) ?? { id, upsets: 0, score: 0, best: null };
    if (win < lose) {
      e.upsets++; e.score += 1 - win;
      if (!e.best || win < e.best.chance) e.best = { opp, chance: win };
    }
    by.set(id, e);
  }
  return [...by.values()].filter((e) => e.upsets).sort((a, b) => b.score - a.score || b.upsets - a.upsets);
}

// An OpenDota rank_tier (tens = medal, ones = stars) as stars from Herald 1, so a climb across
// medals counts each star. Immortal (80, no stars) sits one above Divine 5.
export const medalStars = (rt) => (Math.floor(rt / 10) - 1) * 5 + (rt >= 80 ? 1 : Math.max(rt % 10, 1));
const START_GAMES = 10;

// Ranked pubs since the season began, per player: the draft file's `ranked` (main account only,
// no smurfs; flat groups of 3: start time, won, the lobby's average rank_tier, 0 unknown).
// ranks: main account -> current rank_tier (the roster's). The starting medal is a guess: the
// median lobby average of their first START_GAMES ranked games (matchmaking puts them with their
// own medal); needs 3. Most stars gained first, then net wins, then games.
export function rankedRecords(field, ranked, since, ranks = new Map()) {
  const out = [];
  for (const e of field) {
    const acct = String(mainAccount(e.p)), h = ranked?.[acct];
    if (!h) continue;
    let w = 0, l = 0;
    const lobbies = [];
    for (let i = 0; i < h.length; i += 3) {
      if (h[i] < since) continue;
      h[i + 1] ? w++ : l++;
      if (h[i + 2] > 0 && lobbies.length < START_GAMES) lobbies.push(h[i + 2]);
    }
    if (!(w + l)) continue;
    const sorted = lobbies.sort((a, b) => a - b), from = sorted.length >= 3 ? sorted[Math.floor(sorted.length / 2)] : null;
    const to = ranks.get(acct) ?? null;
    const climb = from && to ? medalStars(to) - medalStars(from) : null;
    out.push({ key: e.key, p: e.p, wins: w, losses: l, net: w - l, from, to, climb, hero: mostPlayed(e.rows) });
  }
  return out.sort((a, b) => (b.climb ?? -99) - (a.climb ?? -99) || b.net - a.net || b.wins + b.losses - (a.wins + a.losses));
}

// The MVP race: the first 4 with at least one game MVP (the winner + the next 3), each on their most played hero.
// sorted: players (byPlayer entries) best first; n: entry -> game MVPs.
const mostPlayed = (rows) => { const c = {}; for (const { p } of rows) c[p.hero] = (c[p.hero] ?? 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
function raceOf(sorted, n) {
  return sorted.filter((e) => n(e) > 0).slice(0, 4).map((e) => ({ key: e.key, p: e.p, value: n(e), games: e.rows.length, hero: mostPlayed(e.rows) }));
}

// The league's awards. games: season games; series, teams: the division's; reads: series model
// reads (above) or []; cuts: lane cuts or null. Each award: { key, title, player?, team?, ... };
// an award nobody qualifies for is left out.
// results (seasonResults): adds Playoff MVP and the champions. ranked, since, ranks: Most sandbagged.
export function seasonAwards(games, { series = [], teams = [], reads = [], cuts = null, results = null, ranked = null, since = null, ranks = new Map() } = {}) {
  const players = byPlayer(games);
  const field = [...players.values()].filter((e) => e.rows.length >= MIN_GAMES);
  const out = [];
  const winRate = (e) => e.rows.filter(({ m, p }) => won(m, p)).length / e.rows.length;

  // MVP: most game MVPs, then the better rate.
  const mvpN = (e) => e.rows.filter(({ m, p }) => gameMvp(m) === p).length;
  const mvpRace = [...field].sort((a, b) => mvpN(b) - mvpN(a) || mvpN(b) / b.rows.length - mvpN(a) / a.rows.length);
  const mvp = mvpRace[0];
  if (mvp && mvpN(mvp)) out.push({ key: "mvp", title: "MVP", player: mvp.key, p: mvp.p, value: mvpN(mvp), games: mvp.rows.length, wins: Math.round(winRate(mvp) * mvp.rows.length), top: raceOf(mvpRace, mvpN) });

  // Playoff MVP: most game MVPs in bracket games (2+ of them), then the better rate, then wins.
  if (results?.playoffSeries.size) {
    const post = games.filter((m) => results.playoffSeries.has(m.series_id));
    const pl = [...byPlayer(post).values()].filter((e) => e.rows.length >= 2);
    const n = (e) => e.rows.filter(({ m, p }) => gameMvp(m) === p).length;
    const wins = (e) => e.rows.filter(({ m, p }) => won(m, p)).length;
    const race = pl.sort((a, b) => n(b) - n(a) || n(b) / b.rows.length - n(a) / a.rows.length || wins(b) - wins(a)), top = race[0];
    if (top && n(top)) out.push({ key: "playoffMvp", title: "Playoff MVP", player: top.key, p: top.p, value: n(top), games: top.rows.length, wins: wins(top), top: raceOf(race, n) });
  }
  // Champions: each bracket's winner (team awards, first in the review).
  for (const c of results?.champions ?? []) out.unshift({ key: "champions", title: c.bracket ? `${c.bracket} champions` : "Champions", team: c.team, bracket: c.bracket, final: c.final, group: results.teams.get(c.team)?.group ?? null });

  // Best support: position 4/5 mains, scored on kill participation, wards placed and killed,
  // stacks and win rate, each as a z-score among the supports.
  const sups = field.filter((e) => [4, 5].includes(mainPos(e.rows)));
  if (sups.length) {
    const parts = [
      (e) => per(e.rows, (p) => p.kill_participation),
      (e) => per(e.rows, (p) => (p.obs_placed ?? 0) + (p.sen_placed ?? 0)),
      (e) => per(e.rows, (p) => (p.obs_killed ?? 0) + (p.sen_killed ?? 0)),
      (e) => per(e.rows, (p) => p.camps_stacked),
      winRate,
    ];
    const z = parts.map((f) => {
      const v = sups.map(f), mean = v.reduce((s, x) => s + x, 0) / v.length;
      const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length) || 1;
      return (e) => (f(e) - mean) / sd;
    });
    const score = (e) => sum(z, (f) => f(e));
    const ranked = [...sups].sort((a, b) => score(b) - score(a)), top = ranked[0];
    out.push({ key: "support", title: "Best support", player: top.key, p: top.p, games: top.rows.length,
      kp: parts[0](top), wards: parts[1](top), dewards: parts[2](top), winRate: winRate(top),
      top: ranked.slice(0, 4).map((e) => ({ key: e.key, p: e.p, games: e.rows.length, hero: mostPlayed(e.rows), kp: parts[0](e), wards: parts[1](e), winRate: winRate(e), score: score(e) })) });
  }

  // Best laner: the best average lane score over 4+ judged lanes (fewer if nobody has 4).
  if (cuts) {
    const board = laneBoard(games, cuts, playerKey).filter((r) => r.lanes);
    const rank = (n) => board.filter((r) => r.lanes >= n).sort((a, b) => b.score - a.score || b.lanes - a.lanes);
    const ranked = rank(4).length ? rank(4) : rank(2), l = ranked[0];
    if (l) out.push({ key: "laner", title: "Best laner", player: l.key, p: l.p, group: l.group, lanes: l.lanes, won: l.won, margin: l.margin,
      top: ranked.slice(0, 4).map((r) => ({ key: r.key, p: r.p, hero: mostPlayed(players.get(r.key)?.rows ?? []) ?? r.p?.hero ?? null, group: r.group, lanes: r.lanes, won: r.won, margin: r.margin })) });
  }

  // Strongest duo: a player on one hero, 3+ games, by win rate with one win and one loss added
  // (so 3–0 doesn't beat 7–1), then games.
  const duos = [];
  for (const e of players.values()) {
    const by = new Map();
    for (const { m, p } of e.rows) {
      const d = by.get(p.hero) ?? { n: 0, w: 0, k: 0, dth: 0, a: 0 };
      d.n++; d.w += won(m, p) ? 1 : 0; d.k += p.kills; d.dth += p.deaths; d.a += p.assists;
      by.set(p.hero, d);
    }
    for (const [hero, d] of by) if (d.n >= 3) duos.push({ key: e.key, p: e.p, hero, ...d, score: (d.w + 1) / (d.n + 2) });
  }
  const duo = duos.sort((a, b) => b.score - a.score || b.n - a.n || (b.k + b.a) / Math.max(b.dth, 1) - (a.k + a.a) / Math.max(a.dth, 1))[0];
  if (duo) out.push({ key: "duo", title: "Strongest player + hero", player: duo.key, p: duo.p, hero: duo.hero, games: duo.n, wins: duo.w, kda: (duo.k + duo.a) / Math.max(duo.dth, 1),
    top: duos.slice(0, 4).map((d) => ({ key: d.key, p: d.p, hero: d.hero, games: d.n, wins: d.w, kda: (d.k + d.a) / Math.max(d.dth, 1) })) });

  // Most sandbagged: the most medal stars gained in ranked since the season began (rankedRecords
  // above), with the top 5. ranked: the draft file's; since: the season's first series; ranks:
  // current medals.
  if (ranked && since) {
    const top = rankedRecords(field, ranked, since, ranks);
    if (top[0]?.climb > 0) out.push({ ...top[0], key: "sandbagged", title: "Most sandbagged", player: top[0].key, top: top.slice(0, 5) });
  }

  // Best series: the most lead changes across its games, then the most games, then kills.
  const bySeries = new Map();
  for (const m of games) if (m.series_id != null) (bySeries.get(m.series_id) ?? bySeries.set(m.series_id, []).get(m.series_id)).push(m);
  const bs = [...bySeries.entries()].map(([id, gs]) => ({ id, games: gs, swings: sum(gs, leadChanges), kills: sum(gs, (m) => sum(m.players, (p) => p.kills)) }))
    .sort((a, b) => b.swings - a.swings || b.games.length - a.games.length || b.kills - a.kills)[0];
  if (bs && bs.swings) {
    const s = series.find((x) => x.id === bs.id);
    out.push({ key: "series", title: "Series of the season", series: bs.id, s, games: bs.games, swings: bs.swings, kills: bs.kills });
  }

  // Biggest upset: the decided series whose result the model thought least likely (under 40%).
  const up = reads.filter((r) => r.s.home_score !== r.s.away_score).sort((a, b) => a.p - b.p)[0];
  if (up && up.p < 0.4) {
    const homeWon = up.s.home_score > up.s.away_score;
    out.push({ key: "upset", title: "Biggest upset", team: homeWon ? up.s.home : up.s.away, loser: homeWon ? up.s.away : up.s.home, s: up.s, chance: up.p });
  }

  // Overachiever: the most surprise from series won as the underdog (overachievers above).
  // Two upsets at least; a single one is the Biggest upset award's job.
  const over = overachievers(reads).filter((e) => !teams.some((t) => t.id === e.id && /\bbye week\b/i.test(t.name)))[0];
  if (over && over.upsets >= 2) out.push({ key: "overachiever", title: "Biggest overachiever", team: over.id, upsets: over.upsets, best: over.best });

  return out;
}

// A league's season is over (its Wrapped opens) once every bracket's grand final has a winner.
// split: Heroic/Aegis combined, two brackets, needs both. d: { teams, series }. Used by the page
// (pages/wrapped.js) and the deploy's link previews (scripts/deploy/wrapped-pages.js).
export function seasonOver(d, { split = false } = {}) {
  const ps = postseason(d.teams, d.series, fitRatings(d.teams, d.series), { split });
  const need = split ? [...ps.bracketTeams.values()].filter((t) => t.size).length : 1;
  const done = ps.decided.filter((m) => m.id === "gf" && m.winner != null && m.winner !== TBD).length;
  return need > 0 && done >= need;
}
