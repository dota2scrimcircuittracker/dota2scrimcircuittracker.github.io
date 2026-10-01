# Feature ideas — 2026-09-28

Status: decisions in progress, nothing built. Mockups: https://claude.ai/artifact/U1dugVJzpyJppH1vP2f8sz
(private artifact, sample data only).

## 1. Damage and killshots — YES

Show on hero pages, player pages and match pages. Whatever data we can get; damage-source
breakdowns are the priority.

Checked 2026-09-28: `.cache/opendota` holds 839 parsed matches and they already carry
`damage_inflictor` (damage dealt by ability/item, `null` = right-click), `damage_inflictor_received`,
`damage_targets` (per ability per target hero), `killed_by`, `kills_log` (time + victim),
`ability_uses`, `item_uses`. So a backfill like `scripts/backfill/items-backfill.js` costs **zero API calls**.

Not in OpenDota: which ability landed each killing blow, and damage mitigated/blocked (Dota Plus only).
`killed_by` gives who killed whom, not with what. Unchecked whether Stratz has killshot ability.

## 2. Hero benchmarks — YES, cheap

Wants aggregate public data, including items, without much API cost.

- `GET /benchmarks?hero_id=` → public percentiles (GPM, XPM, kills/min, LH/min, hero dmg/min,
  healing/min, tower dmg). One call per hero (~127).
- `GET /scenarios/itemTimings?hero_id=` → games/wins per item per timing bucket. One call per hero.
- `GET /heroes/{id}/itemPopularity` → start/early/mid/late item counts (no win rates).
- Refresh weekly or per patch, not every sync: ~250–400 calls per refresh.

## 2b. All-time hero record per player — YES, less detailed

Win rate and games per hero, public and "esports" shown separately.
`GET /players/{id}/heroes` takes `lobby_type` (and `date`, `significant`, etc.).
Public = lobby_type 0 + 7. Practice lobbies = 1 — which also holds inhouses and scrims, not only
league games; the endpoint can't filter by league id.
378 rostered accounts across all divisions → ~750+ calls per full refresh. Measured limit
from response headers: ~3,000/day, 60/min. Must be staggered / weekly.

Decisions (2026-09-28):
- Esports = **league-tagged games only**. Checked: `/players/{id}/matches?lobby_type=1` does NOT
  return `leagueid` (field is absent even when projected). Knowing the league means fetching each
  match (`/matches/{id}`), as the AD2L sync already does. Sample player: 83 lobby games all-time.
  Rough cost ~378 × ~100 = ~38k match fetches minus the cache → a one-time backfill of ~2 weeks at
  ~3k/day, then only new games each week. Cheap proxy if that's too slow: Captains Mode lobby games
  (`game_mode=2`), one call per player. Needs a decision.
- Accounts: **all divisions, main accounts only**, no smurfs. Weekly refresh, staggered.
- Killshots: **try Stratz** (free API token) for the ability that landed each kill. Unchecked.
- Benchmark items: **public item timings + win %** next to league timings.

Decisions, round 2 (2026-09-28):
- Esports source: **Captains Mode proxy** (`/players/{id}/heroes?lobby_type=1&game_mode=2`), one
  call per main account. Label it honestly (Captains Mode lobby games, not strictly league).
- Damage data: **separate per-division file loaded on demand** (e.g. `ad2l-damage.json`).
- Laning rank: **by role** (safe, mid, off, supports), like the tier list.
- Build order: 1 map card with tabs → 2 lane report → 3 team scouting tab → 4 damage →
  5 benchmarks + item timings → 6 all-time hero records → 7 Stratz killshots (user supplies token).

## 3. Lane report — BUILT 2026-09-28 (uncommitted)

Decisions: actual replay lanes (`lane_role`), cut-offs fitted per division (1/3 quantile).
Tier list's lane result now uses the replay's lanes too (Heroic: 2 players B→C; Champion unchanged).
Item 1 (map card with tabs) also BUILT.

Original notes:

- Its own Laning tab on match pages.
- A lane report on each hero page and player page.
- Players tab: laning stats sortable/rankable against other players.
- Weekly: "Best laner this week" card, plus a best average laner (season).
Data already synced: `gold_t`, `xp10`, `position`, `lane_eff`, `last_hits`; cache also has
`lane`, `lane_role`, `lane_pos`. The tier list's lane result is a starting point.

## 4. Map scrubber — DROPPED

Instead: combine the existing maps (ward, death, tower, fight) into one card with tabs to switch
between them.

## 5. Scouting report — YES, on each team page

Their bans by phase, bans against them, draft patterns, comfort heroes per player, recent pubs.
All from existing data (`draft`, `pubs`, positions, `lib/predict.js` ban model).

## 6. More stats from data we already had — BUILT 2026-09-30 (uncommitted)

Asked 2026-09-30: "any new stats we can surface". All approved; APM, rampages and kill streaks
specifically wanted, with a kill-streak chart and toggles for double / triple / ultra / rampage.
Built: Combat tabs (games, players, heroes) with the streak chart, deaths by source, public
benchmarks; build order and skill builds from new per-division detail files; team splits (sides,
stand-ins, length, lead at 10/20/30', first blood, fights, aegis steals, pairs, lineups); hero
matchups and neutral items; medal vs rating scatter; pub practice; Radiant win rate; weekly combat
highlights; Players table columns. See README "Combat", "Detail files", "More splits".
Skipped: chat text (real things players typed). Overlaps #5 (scouting report): sides, stand-ins,
length and pairs are now on the team page already.

## A–C (written recaps, scrim-vs-league practice tracker, Discord cards)

Written recaps and practice tracker: not chosen. Discord cards: liked, PARKED. Full plan in CLAUDE.md. Recommended path: stage 1 = webhook posts
from the GitHub Actions sync (no bot); stage 2, optional = slash commands on a serverless
interactions endpoint (e.g. Cloudflare Worker) reading the published JSON.
