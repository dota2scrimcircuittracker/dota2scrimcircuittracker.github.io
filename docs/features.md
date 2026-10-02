# What the site does

A page-by-page guide to https://dota2scrimcircuittracker.github.io/. How to run, sync, deploy
and change it: [maintaining.md](maintaining.md).

## Leagues and getting around

- **Home page** — `/` (also `/ad2l/`) is a league picker: Scrim League and every AD2L division,
  in the menu's order and colours.
- **Scrim League** — our scrims: paste two post-game screenshots, the stats are read in your
  browser (Tesseract OCR, no AI, no API keys), you check them, and the game is saved. Scrim
  standings (`/scrims/`) rank every team by game wins (then fewest losses), with win %, average
  kill difference, last-five form and streak, above the match list. Private scrims count.
- **AD2L S48 divisions** — Explorer, Voyager, Challenger, Warrior, Conqueror, Champion and
  Heroic/Aegis (the list lives in `public/lib/divisions.js`). Each has standings, every ticketed
  game with full stats, players, heroes, teams, predictions and unticketed uploads, pulled from
  PlayOn + OpenDota. The league menu (top left) runs lowest to highest: Scrim, Explorer, Voyager,
  Challenger, Warrior, Conqueror, Champion, Heroic/Aegis. Champion lives at `/champion/` but is
  keyed `ad2l` in data files, Firestore and predictions; old `/ad2l/<page>` links forward to
  `/champion/<page>`.
- **Heroic/Aegis** — PlayOn runs Heroic and Aegis as one season, played in two divisions (A and
  B, read from PlayOn's Participants tables; the "Refund" table holds bye placeholders and is
  dropped). A switch under the header picks Division A (`/heroic/a/`), Division B (`/heroic/b/`)
  or Combined (`/heroic/`); each shows only that division's teams, series and games on every
  tab. Forfeits against PlayOn's "Heroic Bye Week" placeholder aren't uploadable games.
- **All divisions** (`/all/`, under the picker and last in the league menu) — every division's
  files merged: Teams (one table with a Division column; Matches and Crosstable boxed per
  division, Heroic/Aegis per sub-division; no Race), Weekly, Players (one tier list, everyone
  rated against the whole field) and Heroes. Read-only: no Predict or Upload, and a game opens
  in its own division.
- **League switching** keeps the tab you're on: Players in Champion → Warrior opens Warrior's
  Players. A team, game or player page opens that tab's list.
- **Search** (top bar, or press `/`) — any player or team in any league: every division's
  rosters, stand-ins seen in its games (by the team they last played for), and scrim players and
  teams. Each result shows its league (Heroic/Aegis with its division) and, for players, their
  team and captain/stand-in status; in-game names find the rostered player.
- **Shareable addresses** — the address bar shows real paths (`/warrior/players/`), so a link
  pasted into Discord previews as that page (its title, description and a card in the league's
  colours). Pages without a preview (player pages, older weeks, uploaded games) keep `/#/…`
  addresses, and any other address still opens the app. Page tabs (a team's Overview / Roster /
  Games…, a player's, hero's or game's) add `?tab=<id>` and a history step, so Back returns to
  the previous tab and a copied link opens on that tab.
- **Breadcrumbs and titles** — player, hero, team and game pages show league › list › page; the
  browser tab names the page first ("Players · AD2L S48 Warrior").
- **Guided tour** ("New here?" in the footer) — tours AD2L divisions only: its first stop waits
  for you to pick one (Scrim League is hidden). Pause it and the button reads Resume. Spec:
  `docs/superpowers/specs/2026-09-29-guided-tour-design.md`.
- **Feedback** (top bar) — anyone can mark up the site and say what they'd change: Snip (drag a
  box), Click (pick an element), Draw, and Use site (browse to another page). Every mark asks for
  a note; Submit sends them all as one ticket with the sender's name, at most 5 per browser per
  hour. Tickets can't be read back from the site. Screenshots are drawn from the page, so hero
  art (Steam's CDN won't share it) shows as grey boxes and the display font falls back. Spec:
  `docs/superpowers/specs/2026-09-30-feedback-design.md`.
- **Footer** — where the data comes from and, on an AD2L page, when that division last synced;
  the tour and the Discord invite.
- **Settings** (cog) — dark, grey or light theme, colour-blind mode, and the **time machine**
  (pick weeks: standings, the Players and Heroes tabs, and team, player and hero pages are
  recomputed over just those weeks; a short pick lowers the 3-game floor to the weeks picked).
- **Accessibility** — a skip link, focus moves to the new page's heading on navigation, the
  current tab is marked for screen readers, and every table header is scoped.
- Every table sorts: click a column header (↕), or use the "Sort by" menu on player tables.

## Teams tab (AD2L) and team pages

- **Table** — standings from PlayOn's series scores, with form. **Strength of schedule** (SOS and
  Still to play): RPI-style, opponents' game win % (without their games against you) and their
  opponents' win %, plus how tough the remaining schedule is (a coming bye week doesn't count).
- **Matches** — every series, one box per week (per division in Combined Heroic), like a
  Liquipedia group stage: winner green, loser red, a tie gold; upcoming pairings with the model's
  odds on hover; G1/G2 links to each ticketed game. PlayOn posts pairings about a week ahead, so
  the last box is as far as it goes.
- **Crosstable** — every team against every other in standings order: the row team's score and
  week in each cell, "vs" for the coming week, empty where two teams haven't met (AD2L isn't a
  round robin); one table per division in Combined Heroic.
- **Team pages** — record, series and game results, roster, hero pool (W–L per hero), what they
  ban and what's banned against them, split by draft phase, and player stats for that team. On
  the Series tab, every drafted series shows each game's full pick/ban draft under its row.
  Splits: record as Radiant / Dire, with and without stand-ins, first-blood rate, teamfight win
  %, aegis steals, win % by game length, record when ahead / behind at 10', 20' and 30', every
  pair and five-player lineup, average gold lead curve, comebacks and throws (5k+ leads),
  Roshans and Tormentors taken vs given up, first-Roshan rate, and wards / dewards / stacks per
  game. Team names link to team pages everywhere on the site.

## Weekly recap

One week at a time: highlights (player of the week, biggest damage, best KDA, top GPM, most
kills, fastest core item, best laner, biggest comeback, most wards / stacks / dewards, fastest
first blood, longest streak, rampages, biggest hit, highest APM, aegis steals, most paused game)
and every game with lineups and MVP. AD2L games also show the full Captains Mode draft in pick/ban
order, grouped by series. (Scrims have no draft: it isn't on the post-game screen.)

## Players tab

- **Tier list** (top) — every player with 3+ games, ranked S–D (see "Tier list scoring" below).
- **Stat leaders** — top and bottom 3 on any stat, with "1st overall" badges across every division.
- **Laning** — laning ranked by position (safe, mid, off, supports; 3+ lanes), with best-laner
  cards for the latest week and the season.
- **Medal vs rating** — a scatter of PlayOn medal against tier rating, with who plays furthest
  above and below their medal.
- **All stats** — the full table, with a stand-in filter; per-game map averages, combat columns
  (APM, fights, first blood %, best streak, rampages, ultras, runes, couriers, pings) and
  **recent pubs** (AD2L: each rostered player's public/ranked games since the last league night,
  smurfs included, from OpenDota at sync time).

### Tier list scoring

`public/lib/tiers.js`, the same for both leagues:

    score = stat points (out of 100) × survival × consistency × opponents × winning

Every point is shown: click a player on the tier list, or open their page. The stat rows add up
to the stat points and each multiplier shows the points it adds or removes.

- **Role** from the replay's position (1–3 core, 4–5 support); games without one (screenshot
  uploads, scrims) use net worth rank in the team. Each game is scored in the role played.
- **Stats** — each game, each stat is a z-score against the same position (capped at ±2.5).
  Farm, hero damage, building damage, XP, kills and assists are shares of the team's total, so
  long games don't inflate them. GPM, net worth and support stacks (per game) are compared with
  the position's straight-line fit on game length. Lane result = gold + XP lead at 10 min over
  who they actually laned against, from the replay's lanes (cores: the enemy core(s) in their
  lane; supports: their lane vs the enemy's; jungling: none). Each stat is then on its own 0–100
  per role: a player's average, padded with 3 games at the position average; 100 = the league's
  best such average (players with 3+ games in the role), 0 = the worst. Support stacks are
  easier: 100 sits 70% of the way from the worst stacker to the best.
- **Stat points** out of 100 — cores: farm share 15, damage share 14, kill share 13, GPM 13, net
  worth 10, XP share 8, assist share 8, building share 5, laning 5, lane result 5, stun time 4.
  Supports: new vision 16 (replaced ward uptime; see Vision), dewards 13, assist share 13, stun
  time 8, kill share 8, lane result 7, healing 7, stacks 7, smokes 5, damage share 3, GPM 3, dust
  2, sentries 2, farm share 2, net worth 2, building share 2.
- **Survival** ×0.85–1.00: deaths 40%, time dead 35%, hero damage taken per life 25%, each on its
  own 0–100.
- **Consistency** ×0.90–1.00: the spread of the player's series stat points, pulled toward the
  league's typical spread by 2 series; steadiest player 1.00, streakiest 0.90.
- **Opponents** ×0.90–1.10: each opponent's game win % outside games against this team, padded
  with 6 even games (25% → 0.90, 75% → 1.10); each series takes its opponent's factor and the
  season multiplier weights series by their stat points.
- **Series**: each series shows its stat points (same padding as the season, uncapped) and score
  (× its opponent factor and the season's other multipliers); weighted by games they average to
  the season's stat points and score exactly.
- **Winning** ×0.70–1.30: two parts win rate (padded with 6 even games; 25% → 0, 75% → 100) to
  one part win speed (share of the league's wins that took longer, padded with 3 average wins).
- **Rating** = the score on a normal curve fitted to the league: the median player rates 50,
  width 1.5 × the spread of scores. The breakdown shows it as a "Rating curve" row (rating −
  score), the one step that compares a player with the rest of their league.
- **Each league is scored on its own**: every AD2L division and the scrim ledger has its own
  position averages, 100s and 0s, and curve, so a rating ranks a player within their league.
  The Heroic A/B views use the whole Heroic/Aegis division's reference.
- **Tiers** by fixed rating: S 85+, A 65+, B 45+, C 30+, D below (roughly 10/15/35/25/15% per
  division). Needs 3+ games. PlayOn medal badges are shown, not scored.

## Player pages

Click any player name: record, KDA, GPM, damage, kill participation, tier (with the full
breakdown), best games, stat ranks in the league and overall, hero pool (W–L per hero) and every
game they played (sortable). Tabs: Stats, Heroes, Combat, Laning, Items, Map, Games. Also: the
average gold curve against the division's core and support averages, record by the team's pick
number (1st … last pick) with a flag for a big last-pick gap, a game analysis (one game against
their usual), pub practice (league record on heroes played in pubs the week before, against the
rest) and recent pubs.

## Heroes tab and hero pages

- **Heroes** — every hero picked: picks, bans, contest rate (picked or banned per drafted
  game), win rate, Radiant's win rate, the division's "team that drew first blood won X%".
  Bans and picks split by Captains Mode phase (phase 1 = opening 7 bans + first 2 picks, phase 2
  = 3 bans + 6 picks, phase 3 = last 4 bans + last 2 picks; read from each draft, not
  hard-coded), win % per pick phase and first-pick win rate. Heroes under a minimum number of
  games (default 3, changeable) are hidden so one-off 100% heroes don't top the list.
- **Hero pages** — record, pick and ban rates, average draft slot (AD2L), the same by phase,
  record by pick number, best team and player on it, biggest games, a teams table (picks, W–L,
  win % on the hero, who played it, bans for and against), a players table, Matchups (record
  with and against every hero), neutral items held at the end, Skill build, Items, Combat,
  Laning, Map, and every game it was in.

## Game pages

- **Scoreboard** with standouts (damage per net worth, kill participation, damage share), MVP,
  FB / "died first" tags, and links to OpenDota and Dotabuff (ticketed games).
- **Casts** — a strip under the score on every game page: anyone pastes a link (YouTube, Twitch,
  any https page) and the caster's name, and it's there for everyone. Whoever added a cast can
  remove it from that browser; anyone else needs the league password. Up to 20 per game.
- **Gold graphs** (AD2L) — gold lead minute by minute with each side's biggest lead marked, XP
  lead, and every player's gold (OpenDota's parsed-replay gold: total gold earned, like
  OpenDota's own graph). "Items & fights": the gold lead with every teamfight (sized by deaths,
  coloured by who lost fewer) and each team's core items on one clock. Roshan, Tormentor and
  first blood are marked on the chart.
- **Draft**, **Ratings**, **Laning**, **Farm & vision**, **Combat**, **Items**, **Map** tabs, below.
- **Draft** (AD2L games with a Captains Mode draft) — the draft model's read of the draft (see
  "Draft model" below), with each player read only from games before this one: each team's
  chance to win before the draft and after every step (a chart), and a row per step with where
  the model ranked the actual pick or ban among the heroes left, its value (the team's chance with
  that pick; for a ban, the points that hero would have added to the other team), the model's top
  3 at that step, and the chance after it. Then who the model thought would play each hero
  against who did, and how each player was read (games found, rank).
- **Laning** (AD2L, parsed replays) — each lane (top, middle, bottom) called won, even or lost at
  10:00 on the whole lane's gold + XP lead, with each side's heroes, then every player's last
  hits, denies, lane efficiency, kills and deaths before 10:00. Lanes are the replay's own, so
  swaps and tri-lanes count as played. Won/lost cut-offs are fitted per division, a third of
  lanes each way, side lanes and mid separately (S48 Champion: ~1,000 side, ~850 mid). Player and
  hero pages get a Laning tab (record, averages, by lane, every lane with who they laned with and
  against). Lane score = average lead ÷ the won cut-off, padded with 2 even lanes.
- **Map & objectives** (AD2L, parsed replays) — lane / neutral / ancient creep kills, camps
  stacked, observers and sentries placed, dewards, Roshan and Tormentor last hits, and a timeline
  of who took each Roshan and Tormentor.
- **Combat** (AD2L, parsed replays) — a kill-streak chart (each run of kills without dying climbs
  a step per kill and drops at the death that ended it, with the hero and the announcer's name at
  each 3+ streak and who ended it; toggles for the streak lines and each kind of multi-kill), then
  each player's APM, teamfight share, longest streak, multi-kills, first blood, runes, courier
  kills, biggest single hit and pings, their public benchmarks (OpenDota's percentile against
  public games on the same hero) and pauses. On players and heroes: totals and averages, streak
  levels and multi-kills, deaths by source (hero, tower, creeps, neutrals, Roshan; only games
  whose log has every death) against the league, and benchmarks against the league's same-role
  average. Streaks: OpenDota's counts are the headline; the chart rebuilds runs from kill and
  death times, which matches those counts for 97% of players in games with full death logs.
- **First blood** — a game fact, a gold-chart layer, tags on the scoreboard, Combat table and
  weekly lineups, a line on the Laning tab, a column on player and hero game lists, first blood %
  and died first % on the Players table and stat ranks, team cards (rate, record with and without
  it, usual time, league rank), and the week's fastest.
- **Items** (AD2L only; OCR can't read item icons) — final items and when each core item was
  finished, and the Build order (purchases and skill build). Hero pages: most-built items, average
  and fastest time, win % built. Player pages: their timings against the league's on the same
  hero. Item tables show a "Lead swing": the team's lead change in the 3 minutes after finishing
  the item minus the 3 minutes before (timing, not cause: teams already ahead finish items
  sooner); greyed under 3 games. Core = built from parts for 1,000+ gold, or Blink / Aghanim's
  Shard; a part later upgraded (Yasha → Manta) counts as the upgrade.
- **Ward maps** (AD2L) — every observer and sentry from the replay, as the ward's icon in a
  team-coloured ring, greyed when dewarded (hover for time placed, how long it lasted, dewarded or
  not). Player, hero and team pages show all their wards with a side switch: Both sides (Dire
  games mirrored so it's always "own base bottom left"), or As Radiant / As Dire. Filter by ward
  type and game phase (0–10', 10–20', 20–35', 35'+).
- **Map tab** (game, player, hero, team) — one map at a time with buttons to switch between
  wards, towers, deaths, team fights and vision; the last pick is remembered from page to page.
  A game's maps share overlay checkboxes (off at first, remembered): Kills (the dead hero's
  portrait; teamfight kills only, since OpenDota records no spot for the rest), Teamfights,
  Objectives (buildings; Roshan and Tormentor at the pit / spot for that time of day) and Wards
  (placed, crossed when dewarded). Each map draws them over its own window and counts what's in
  it, including kills with no recorded spot (about 46% of deaths across S48: lane kills and
  pickoffs).
- **Tower maps** (AD2L) — every tower, barracks and Ancient by game phase: what's standing at the
  end of the phase, what fell in it (with the time) and what fell earlier (faded). Hover for who
  took it, creeps, or a deny. Building spots are hand-placed along the lanes, so they can be a
  map unit or two off.
- **Vision** (AD2L) — what each observer ward could really see on the patch's map (elevation,
  trees, walkable ground and blockers; line of sight follows devilesk's vision simulator: higher
  ground blocks sight from below, a tree blocks a viewer below its top). Each team's observer
  coverage at each minute as % of the walkable map outside its own base (a Vision view on the
  hero chart); per player, `new_vision` = the share of their wards' ground they were first on
  the team to light (a column in Farm & vision, and the support "New vision" tier metric). The
  Vision map has two modes. Moment: a time slider and play button showing each team's lit ground
  and the observers up, with overlays for Towers (standing then, with their sight), Sentries
  (1050 true-sight rings) and Night (night is 5:00–10:00, 15:00–20:00…; towers drop from 1900 to
  800 at tier 1 or 1100 above; observers see 1600 day and night). Range: everywhere lit at some
  point between two times, stronger the longer it stayed lit. Trees cut during the game aren't
  in OpenDota's data, so all trees count as standing.

## Uploading games (scrims and unticketed AD2L)

1. After the game, on the post-game screen, snip the **overview** (hero cards with K/D/A and net
   worth) with Win+Shift+S and press Ctrl+V on the Upload page.
2. Open the **Scoreboard** tab, snip it, Ctrl+V again. Don't hover over anything: tooltips cover
   numbers.
3. Click **Read screenshots**, fix anything red or flagged, **Save to league**.

Player names are checked against every name the site knows: the division's rosters (Champion's
for scrims, since scrim teams are the Champion teams), stand-ins from its games and names from
earlier scrims. Close misreads are fixed automatically ("Icarus<" → Icarus, "MERCURY" → Merc-Ury)
and listed so you can see what changed; looser resemblances ("Daddy Kaleb" ~ Kaleb) are offered
as a one-click suggestion, since an in-game name can differ from a roster name on purpose. A name
that isn't on the team's roster asks: same player or a stand-in? The same game uploaded by both
teams is detected and saved once.

- **Private scrims** — tick "Private" to post the result only (teams, winner, kill score,
  duration). Heroes, players and stats never leave the browser. Private games count toward team
  records but not the tier list, player or hero tables. The game ID is built from teams + kill
  score + duration only, so it can't be used to guess a private game's heroes.
- **Unticketed AD2L games** (AD2L → Upload) — division games played without a league ticket (so
  OpenDota's league list never has them), uploaded like a scrim. Team names must be division
  teams (picked from a list, or filled in from whose roster most players are on), and you pick
  which missing game it is. They show as "Unticketed" and count on team, player, hero, weekly
  and tier pages; standings stay PlayOn's series scores. No draft, gold or ward data (those come
  from replays).
- **Editing and deleting** — open the game. Whoever uploaded it (from the same browser) sees
  **Edit** and **Delete** straight away; anyone else opens **Edit or delete this scrim** and types
  the league password. Edit loads the game into the review form: fix names, heroes, stats, teams,
  score or winner and press **Save changes**. The game keeps its ID, upload date (so its week),
  uploader, private flag and AD2L series, and the rules check the same shape as a new upload. The ID is still the one from the original teams and
  score, so a later upload of the same game with the corrected values won't be caught as a
  duplicate. Delete removes it for everyone. The password is a speed bump, not security.

### What's read, and how well

Hero, level, K/D/A, net worth, LH/DN, GPM, XPM, heal, hero damage, team names, score, duration,
winner. Clan tags aren't read (the tag font defeats OCR); type them if you want them.

Measured on one real game: 99% of fields exact on the original, 96–99% for 4K-size,
tighter/looser crops and JPEG, ~83% when the screenshot has been shrunk to 1440p-size (real 1440p
captures are sharper than that test). One game is a small sample: the review step is there for
the misses.

Wider screenshots (the whole monitor, the Dota menu bar, a browser or Discord window beside the
game): when the first reading fails or finds fewer than 8 players, a second pass
(`public/lib/ocr/locate.js`) cuts away bright windows, finds the hero cards or the scoreboard
headers anywhere in the image, crops to the framing the first pass was tuned on and reads the
crop. It's used only if it reads more (and at least 5 players), so a good first reading is never
replaced. It also rescues a screenshot taken of the wrong screen because the words GPM/XPM were
visible in another window. On the test screenshots pasted into wider frames, every frame reads
as well as the original; the one miss left is a full-monitor capture at 1920 wide, which is the
shrunk-resolution problem above, not a finding problem.

## Draft model and Drafter

- **The model** (`public/lib/cmdraft.js`) is Project Sybil's Captains Mode draft model (by
  ybabts and Fav; [muelltyl.dev](https://muelltyl.dev/)), ported to the site, with Sybil's fitted
  weights (`public/lib/sybil-fitted.js`): fitted on 10,461 AD2L games, S31–S48; held out on patch
  7.41 its favourite won 64% (AUC 0.70). It reads each picked hero as the player most likely to
  play it (worked out from every player's recent heroes and positions, over every way to give the
  side's heroes to different players), and that player's record on it, shrunk toward the hero's
  win rate at the game's rank. A pick moves the chance only by how much better or worse the hero
  is for that player than their usual heroes; a hero nobody on the team plays costs. The rank gap
  counts too. Not in yet: counters and synergy (Sybil's tables per patch), and how the teams have
  done this season (the rating is 0, as in Sybil's own sandbox). So bans never move the chance:
  a ban only denies.
- **Team Drafts tab** (AD2L teams) — every drafted series, newest first, with each game's draft
  chart drawn from the team's side (their chance to win before the draft and after every step),
  how far the draft moved it, and a link to the game's step-by-step Draft tab. A line on top says
  in how many drafts the model moved the team's chance up, and by how much on average.
- **Drafter** (AD2L, its own tab) — draft for any two teams. Start from an upcoming series in the
  division, any two teams from any division, or a past game (its draft loads in full; click any
  step to rewind and branch, and "In the game" shows what was actually picked there). Pick who
  has first pick and who is Radiant, and which five play (default: the five with the most league
  games for the team). On a pick, **Picking for** says which player the pick is for (default: the player with no hero yet) and at which open position (default: the open one they play most); the list then shows heroes for that player at that position, scored with the hero as theirs, and the pick is recorded as theirs. A past game's picks are pinned to who actually played them. Every step lists the model's best 10 (picks: the team's chance to win with
  the hero and who would play it; bans: points the hero would add to the other team and who on
  it would play it), and every hero in the grid shows its value. Undo, reset, or click a filled
  slot to rewind. **Positions:** the model has no rule against a third carry (Sybil measured a
  doubled-position penalty as worth nothing), so, as on Sybil's own drafter, the list only offers
  a pick for a position the team hasn't filled, and a ban for one the other team hasn't. A hero
  fits a position when ranked pubs play it there 8%+ of the time (Sybil's lane-parsed table) or a
  player on the team has played it there in 2+ lane-parsed games. Each suggestion and pick slot
  shows its position; "Only open positions" turns the filter off. A player with no history (a stand-in, a private profile, or a division not yet
  synced) reads as an average player at the game's rank.

## Predictions

- **AD2L** (Predict) — type your name and call each series this week: a 2–0 either way or 1–1.
  One point per correct call; picks lock at the series start (the database stamps each pick with
  server time, and scoring ignores anything stamped after the start). Standings group by the
  typed name, and "The model" competes using what it would have predicted each week from earlier
  weeks only. The model: team ratings fitted to every game result (PlayOn scores), pulled toward a
  roster-medal starting point, with the pull and medal weight tuned by replaying the season;
  games treated as independent (2–0 = p²). Its call never hedges: it takes the favourite 2–0 (the
  odds bar stays honest). Each series has the model's full draft: all 24 steps in S48's Captains
  Mode order (first-pick team bans 3/2/2, the other 4/1/2), with a toggle for who has first pick.
  Bans weigh the team's recency-weighted ban habit in that phase, what the opponents still to pick
  have been playing (league games with a two-week half-life, pubs since the last league night),
  and the division's usual bans; picks give each player the best hero left in their pool.
  Each card also carries the **draft model** (separate from the ratings, which it doesn't
  change): its chance for one game before the draft, from the ten likely players alone (each
  team's five with the most league games, averaged over who takes Radiant), and, under "Draft
  model: its best draft, and the odds after it", a full draft it builds for both teams with the
  Drafter's rules (first-pick team on Radiant, toggle who picks first), with the chance before
  and after it, the step chart, and each team's heroes, players and bans. Measured on this
  season's games read before they were played (`scripts/measure/draft-model.js`): before
  the draft it was no better than the ratings, which is why the ratings stay as they are.
- **Scrims** (Scrims → Predict) — anyone adds an upcoming scrim (two teams, start time,
  Bo1/Bo2/Bo3); everyone calls it until it starts, same name-based leaderboard. Each card has
  **Upload game N** and **Private result** buttons that open the upload page with the scrim's
  team names filled in (and a one-click fix if the in-game names differ). A game counts toward a
  scrim when it's between the same two teams and was uploaded from 2 hours before the start to 3
  days after. Odds come from a rating per team fitted to every scrim result, pulled toward even.
