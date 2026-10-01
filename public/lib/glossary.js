import { METRICS } from "./tiers.js";

// Info bubbles: a small "i" next to a stat's label that explains it. One popover for the
// whole page; hover shows it with a mouse, tap/click pins it (the only way on phones),
// Escape or a click elsewhere closes it. Obvious labels (K, D, A, Games, Win %) get none.

export const INFO = {
  // Tier-list breakdown (one bubble per stat comes from METRICS in tiers.js)
  ...Object.fromEntries(Object.entries(METRICS).map(([m, d]) => [`tm_${m}`, d.def])),
  tm_avg: "What the same position averages in this league. GPM and net worth: what that position gets in a game as long as this player's games, since both climb with game length.",
  tm_stat100: "This stat on its own 0–100 scale: 100 = the best average in this league for the role (players with 3+ games), 0 = the worst. Averages are padded with 3 games at the position average, so short records don't swing to the ends. Support stacks are easier: 100 sits 70% of the way from the worst stacker to the best.",
  tm_points: "Stat rows: points out of the 100 stat points (the stat's points × its 0–100); the most it can give is after the slash. Multiplier rows: the points it adds or takes away (its × factor underneath). All rows add up to the score.",
  tm_survival: "Deaths, time spent dead and hero damage taken per life, each against the same position, as one 0–100. Scales the stat points from ×0.85 (0) to ×1.00 (100): dying less keeps more of what you earned.",
  tm_consistency: "How much the player's stat points swing from series to series (±), pulled toward the typical swing for short records. The steadiest player in the league is ×1.00, the streakiest ×0.90.",
  tm_opponents: "Each opponent's game win % against other teams (padded with 6 even games): 75% → ×1.10, 50% → ×1.00, 25% → ×0.90. The shown % is the average opponent; the multiplier weights each series by its stat points, so big series against strong teams count more.",
  tm_winning: "Two parts win rate to one part win speed, as a 0–100. Win rate is padded with 6 even games, then 25% → 0 and 75% → 100; win speed scores each win by the share of this league's wins that took longer. 50 → ×1.00, 100 → ×1.30, 0 → ×0.70.",
  tm_curve: "Everything above this row is about your own games. This row is the one step that compares you with the rest of your league. Scores bunch up (the typical player lands near 40 of 100), so the rating curve spreads them out: the league's median score becomes a 50 rating, and each step further from the middle is worth a little less, so 0 and 100 stay nearly out of reach. One curve width above the median rates 84, two widths rate 98, one below rates 16. The curve is 1.5 × the spread of the league's scores wide. The number here is just the rating minus the score, so the column adds up to your rating.",
  tm_series: "Stats: the series' stat points, padded the same way as the season (a great series can pass 100). Opp.: that opponent's strength factor. Score: stats × opp. × the season's survival, consistency and winning. Weighted by games, the series average to the season row exactly.",
  // Series standings (AD2L)
  w: "Series won 2–0.",
  tie: "Series tied 1–1. AD2L series are two games, so ties are common.",
  l: "Series lost 0–2.",
  game_rate: "Games won ÷ games played, from PlayOn's series scores.",
  tracked: "Games whose full stats were found on OpenDota. A game can be missing when nobody in it has public match history.",
  record: "Series won–tied–lost.",
  sos: "Strength of schedule: (2 × opponents' game win % + their opponents' game win %) ÷ 3, the same idea as RPI. Opponents' win % leaves out their games against this team, so beating them doesn't make the schedule look easier. Higher = tougher opponents so far.",
  owp: "Opponents' game win %, leaving out their games against this team, so beating them doesn't make your own schedule look easier.",
  oowp: "How tough the opponents' own schedules were: their opponents' game win %.",
  faced: "Every series played, oldest first: green won, red lost, gold tied. Hover a square for the score.",
  remaining_sos: "Average game win % of the opponents still to play. Higher = harder run-in.",
  series_form: "The last five series, newest on the right: green won, red lost, gold tied. Sorting ranks wins minus losses over those five.",
  model_rating: "The team's strength in the model behind Predict: fitted to every game result so far and, pulled toward the average medal of the team's top three players (so far, medals have predicted better than results). 0 = an average team; the gap between two teams sets the odds.",
  standings_leader: "Most games won; game win % breaks a tie.",
  standings_streak: "Most series won in a row, counting back from the latest.",
  standings_upset: "The 2–0 result the model thought least likely, using only the results from before that series.",

  // Scrim standings
  gp: "Games played, private scrims included.",
  kill_diff: "Average kill score difference per game: the team's kills minus the opponent's.",
  form: "The last five games, oldest first.",
  streak: "Current run of wins (W) or losses (L), e.g. W3 = three wins in a row.",

  // Player stats (across games)
  kda: "(Kills + assists) ÷ deaths, over all games. Zero deaths counts as one.",
  avg_gpm: "Gold per minute over all games: total gold ÷ total minutes, so long games count for more than short ones.",
  avg_xpm: "Experience per minute over all games: total XP ÷ total minutes.",
  dmg_per_min: "Damage to enemy heroes ÷ minutes played.",
  dmg_per_1k_nw: "Hero damage per 1,000 net worth: how much damage a player gets out of their gold. Supports often score high.",
  avg_kp: "Kill participation: (kills + assists) ÷ team kills, averaged over games.",
  dmg_taken_pg: "Damage taken from enemy heroes per game (parsed replays). Who soaks the most in fights; creeps, towers and neutrals don't count.",
  buybacks_pg: "Buybacks per game (parsed replays).",
  stacks_pg: "Neutral camps stacked per game (parsed replays).",
  obs_pg: "Observer wards placed per game (parsed replays).",
  sen_pg: "Sentry wards placed per game (parsed replays).",
  dewards_pg: "Enemy observer and sentry wards killed per game (parsed replays).",
  lane_pg: "Lane creeps killed per game (parsed replays).",
  neutral_pg: "Neutral creeps killed per game (parsed replays).",
  neutral_share: "Neutral creeps as a share of all creeps killed (lane + neutral). High = farms the jungle.",
  roshans: "Roshan last hits, total.",
  tormentors: "Tormentor last hits, total.",
  pub_games: "Public and ranked games since the last league night, smurf accounts included. From OpenDota at the last sync.",
  pub_win_rate: "Win % in those recent pubs.",
  pub_kda: "(Kills + assists) ÷ deaths in those recent pubs.",
  pub_heroes: "Heroes played in those recent pubs, most played first.",

  // One game
  net_worth: "Gold held plus the value of items at the end of the game.",
  last_hits: "Last hits: creeps killed for gold.",
  gpm: "Gold per minute in this game.",
  xpm: "Experience per minute in this game.",
  hero_damage: "Damage dealt to enemy heroes.",
  dmg_share: "Share of the team's total hero damage.",
  kill_participation: "Kill participation: (kills + assists) ÷ the team's kills.",
  hero_healing: "Healing done to allied heroes.",
  lane_kills: "Lane creeps killed.",
  neutral_kills: "Neutral creeps killed.",
  ancient_kills: "Ancient creeps killed.",
  camps_stacked: "Neutral camps stacked.",
  obs_placed: "Observer wards placed.",
  sen_placed: "Sentry wards placed.",
  obs: "Observer wards placed.",
  sen: "Sentry wards placed.",
  stacks: "Neutral camps stacked.",
  dewards: "Enemy observer and sentry wards killed.",
  roshan_kills: "Roshan last hits. The chips above show which team took each one.",
  tormentor_kills: "Tormentor last hits.",

  // Heroes and drafts
  pick_rate: "Share of games (with stats) it was picked in.",
  ban_rate: "Bans ÷ drafted games.",
  contest_rate: "Share of drafted games it was picked or banned in. The best single measure of how much teams care about a hero.",
  b1: "Bans in draft phase 1: the opening 7 bans.",
  b2: "Bans in draft phase 2: the 3 bans between the first 2 picks and the next 6.",
  b3: "Bans in draft phase 3: the last 4 bans.",
  p1_ban_share: "Share of its bans that came in phase 1. High = teams remove it on sight.",
  p1: "Picks in phase 1: the first 2 picks of the draft.",
  w1: "Win % when picked in phase 1.",
  p2: "Picks in phase 2: the middle 6 picks.",
  w2: "Win % when picked in phase 2.",
  p3: "Picks in phase 3: the last 2 picks, one per team.",
  w3: "Win % when picked in phase 3 (last pick).",
  avg_damage: "Average hero damage per game on this hero.",
  avg_kda: "Average of each game's KDA on this hero.",
  team_hero_wr: "That team's record when they picked this hero.",
  team_bans: "Times this team banned it.",
  banned_against: "Times opponents banned it against this team.",
  first_pick: "Games won by the team with the first pick of the draft.",
  top_p1_ban: "Banned most in phase 1 (the opening 7 bans). Below: how many of its bans came in phase 1.",
  top_p1_pick: "Picked most in phase 1 (the first 2 picks), with its record when picked there.",
  last_pick: "A team's fifth and final pick. It comes last, so it can counter everything already on the board.",
  best_last_pick: "Best record as a team's last pick, among heroes last-picked 3+ times.",
  draft_slot: "Average position of its pick in the draft, counting all 24 steps (bans and picks). Lower = taken earlier.",
  by_draft_pick: "Record by which of the team's five picks this hero came in (1st pick … last pick). A big last-pick gap means it works best as a counter-pick. Under each record: the average game rating (0–100, same curve as the tier list), KDA, GPM, damage per minute and kill participation from that slot, green or red when clearly above or below its average across all slots.",
  draft_by_phase: "What this team bans, what gets banned against them and what they pick, split by draft phase. Phase 1 = opening 7 bans and first 2 picks; phase 2 = 3 bans and 6 picks; phase 3 = last 4 bans and last 2 picks. Count = times; % of drafts = how often it comes up; Win % = the team's record in those games (for picks, with the hero).",
  hero_phases: "When this hero gets banned or picked in Captains Mode drafts, split by phase.",

  // Player / team cards
  tier: "Tier list rank (S–D) among players with 3+ games. Rating 0–100: S 85+, A 65+, B 40+, C 20+. The Tier rating section below shows every point of the score. The full method is under “How it's scored” on the Players page.",
  vision: "Observer / sentry wards placed per game.",
  creeps: "Lane / neutral creeps killed per game, and the neutral share of all creeps.",
  objectives: "Roshan / Tormentor last hits, total.",
  avg_kills: "Average kills per game by this team; the line below is kills against them.",
  team_roshans: "Share of the Roshans killed in their games that they took. The bar: taken (green) vs given up (red).",
  first_roshan: "Of the games where Roshan died, how many this team took the first one.",
  team_tormentors: "Share of the Tormentors killed in their games that they took. The bar: taken (green) vs given up (red).",
  lead10: "Average gold lead at 10 minutes, their games with replay data. Above zero = usually ahead out of the laning stage.",
  lead20: "Average gold lead at 20 minutes, their games that lasted that long.",
  team_wards: "Observers / sentries placed per game by the whole team.",
  team_dewards: "Enemy wards killed per game by the whole team.",
  team_stacks: "Camps stacked per game by the whole team.",
  ahead20: "Record in games where they had more gold at 20 minutes.",
  behind20: "Record in games where they had less gold at 20 minutes.",
  comebacks: "Wins after trailing by 5k+ gold at some point.",
  throws: "Losses after leading by 5k+ gold at some point.",

  // Weekly / match
  core_items: "Core items: anything built from parts for 1,000+ gold, plus Blink Dagger and Aghanim's Shard. A part later built into something bigger (Yasha into Manta) counts as the bigger item. Times are when the item was finished (bought), from the parsed replay (OpenDota).",
  lead_swing: "How the team's gold lead turned around the moment the item was finished: the lead change over the 3 minutes after, minus the change over the 3 minutes before, averaged over games (from the buyer's side). Positive = the lead turned their way after it. It's timing, not cause: an item finished during a won fight or right before Roshan gets the credit, and teams already ahead finish items sooner. Taking away the 3 minutes before removes some of that head start, not all of it.",
  items_fights: "The gold lead over the game with every teamfight and core item on the same clock. Bands and circles are teamfights: circle size = deaths, colour = the side that lost fewer (grey = even). Icons above are the top team's core items, below the bottom team's, at the second each was finished. Hover a circle for deaths per side and how the lead moved; hover an item for the lead change in the 3 minutes before and after.",
  fastest_core: "The item finish this week furthest ahead of the league average for the same item on the same hero. Only that hero's usual builds count: items costing 2,000+ finished in at least half of the hero's games (3 or more), so an early situational item doesn't win it.",
  mvp: "A game's MVP is the winning-side player with the best average of damage share, kill participation and net-worth share. Player of the week has the most MVPs.",
  biggest_comeback: "The biggest gold lead a team lost the game from this week.",
  team_damage: "Total hero damage by each team.",
  gold_lead: "Gold difference between the teams at each minute, from the parsed replay. Each side's biggest lead is marked; Roshans and Tormentors are marked too.",
  gold_players: "Each player's gold at each minute, from the parsed replay. Net worth is gold held plus the value of their items, and matches the scoreboard at the end. Gold earned is everything they picked up, before spending: it only rises, so it ends above net worth by what went on consumables, buybacks and gold lost to deaths.",
  gold_curve: "Average gold at each minute against the division's average core and support. Core = a team's top 3 by net worth, support = the other 2.",
  team_gold: "Gold lead at each minute, their side positive. Thin lines are each game (green won, red lost; click to open); the bold line is the average, drawn while at least half the games are still going. Cards rank the team against the league.",
  ward_map: "Where wards were placed, from parsed replays. Both sides: Radiant and Dire games together, with Dire games mirrored so own base is bottom left. As Radiant / As Dire: only games on that side, at their real spots.",
  match_wards: "Every ward both teams placed, from the parsed replay.",
  tower_map: "Which towers and barracks were still standing at the end of each game phase, and when each one fell. From the parsed replay.",
  lane_players: "Each player's first 10 minutes from the parsed replay. Lane is OpenDota's lane detection (roaming = it saw them move between lanes). Lead is the whole lane's gold + XP at 10:00 against the other side of that lane.",
  lane_record: "Lanes won, even and lost. A lane is judged at 10:00 on its gold + XP lead, with cut-offs fitted to this division: a third of lanes are won, a third lost.",
  lane_rate: "Lanes won ÷ lanes judged, with an even lane counting as half a win.",
  lane_margin: "Average gold + XP lead at 10:00 of the whole lane (you and your lane partners against the other side of it).",
  lane_lh: "Last hits and denies at 10:00, averaged over games.",
  lane_deaths: "Deaths and kills before 10:00, from the replay's death log.",
  lane_convert: "Of the lanes won, how many ended in a won game.",
  lane_rank: "Players ranked on laning within the position they played: safe lane cores, mids, off lane cores and supports. Only players with 3+ lanes in that position.",
  lane_best_week: "The highest lane score in this week's games (2+ lanes, or 1 if nobody has 2): average gold + XP lead at 10:00 ÷ the won cut-off, so mid and side lanes compare fairly.",
  lane_best_season: "The highest season lane score with 3+ lanes: average gold + XP lead at 10:00 ÷ the won cut-off, padded with 2 even lanes so a short record doesn't top the list.",
  fight_deaths: "Left: where each hero died in a teamfight. OpenDota records a death's spot only inside a teamfight, so lane deaths and pickoffs have no place on the map. Right: every death on a time axis, one row per hero; deaths outside a teamfight count as lane deaths before 10:00 and pickoffs after. From the parsed replay.",
  player_deaths: "Where and when this player dies, over every parsed game. Map: their teamfight deaths in Radiant games or Dire games, picked with the As Radiant / As Dire switch (OpenDota records a spot only for teamfight deaths). Chart: their deaths in each 2-minute stretch, split into lane deaths (before 10:00, outside a teamfight), pickoffs (after 10:00, outside a teamfight) and teamfight deaths. Filter to wins or losses to compare.",
  team_fights: "Where this team takes teamfights, from the spot of every teamfight death in their parsed games (theirs and the enemy's). Both sides: Dire games mirrored so own base is bottom left; As Radiant / As Dire: only games on that side, at their real spots. Heat shows where fights happen; Net shows where they come out ahead (green) or behind (red); Fights shows each teamfight, coloured by who lost more heroes. OpenDota records a spot only for deaths inside its teamfights.",
  map_objectives: "Creeps, stacks, wards and objectives per player, from the parsed replay.",
  stat_leaders: "The top and bottom 3 in this league on the stat you pick, among players with 3+ games. Per-game stats are totals over games played. A badge means the player is also top or bottom 3 across all seven AD2L leagues together (Heroic/Aegis counted once, as Combined). Raw numbers, no adjustment for how strong each league is.",
  stat_ranks: "This player's place on each stat among players with 3+ games: in this league, and across all seven AD2L leagues together. Colour by league place: gold, silver, bronze for the top 3, green for the top 10, soft green for the top 25, red for the bottom 3. The same colours mark the all-leagues place.",
  hero_ranks: "This hero's place on each stat among heroes picked 3+ times: in this league, and across all seven AD2L leagues together. Stats add up every game anyone played on it, the same way a player's do. Pick, contest and ban rates are per game with stats or per Captains Mode draft. Highlighted tiles are top or bottom 3.",
  hero_deaths: "Where and when this hero dies, over every parsed game anyone played it. Map: its teamfight deaths in Radiant games or Dire games, picked with the As Radiant / As Dire switch (OpenDota records a spot only for teamfight deaths). Chart: deaths in each 2-minute stretch, split into lane deaths (before 10:00, outside a teamfight), pickoffs (after 10:00, outside a teamfight) and teamfight deaths. Filter to wins or losses to compare.",
  hero_pubs: "This division's rostered players on this hero in public and ranked games in the 14 days before the last sync, from OpenDota. Players with a private match history are missing.",
  hero_towers: "Every tower, barracks and Ancient over the parsed games this hero was in, with its team's base always bottom left (Dire games flipped). Each building shows how often it fell and its average fall time; a gold ring means this hero last-hit it at least once. Filter to wins or losses to compare. Denies don't count as taken or lost.",
  building_dmg: "Damage to towers, barracks and the Ancient, averaged over their games with stats, and their share of their team's building damage in those games.",
  player_towers: "Every tower, barracks and Ancient over this player's parsed games, with their team's base always bottom left (Dire games flipped). Each building shows how often it fell and its average fall time; a gold ring means this player last-hit it at least once. Filter to wins or losses to compare. Denies don't count as taken or lost.",
  game_analysis: "One game at a time: pick any game above or hit Analyze in the table below. Stat places are among the ten players in that game. Wards come from the parsed replay; kills and deaths are on the gold chart (only where the replay has a death log).",
  game_gold: "Total gold earned by minute from the replay (gold lost on death isn't subtracted), against the enemy player at the same position. Kills and deaths sit on their gold line; Roshan, Tormentors, towers and barracks are on the map lane (their team's above the line, the enemy's below); shaded bands are teamfights. Lead = their team's total gold lead.",
  game_rating: "The tier rating worked out from this one game: the same stats and multipliers as the tier list, against this league's players at the same position. The curve is fitted to every game in the league the way the tier list's is fitted to seasons, so games spread across S–D in about the same shares as players do.",
  hero_rating: "The tier rating worked out from just a player's games on this hero: the same stats, multipliers and curve as the tier list, against this league's players at the same position. Opponent strength still uses all the league's games. With few games the stats are padded toward the average, which softens a single great or awful game but doesn't remove it: one game can still rate very high or very low. Across leagues, players are compared on these ratings, each measured against their own league.",
    tier_list: "Players with 3+ games ranked S–D. Score = stat points out of 100 (each stat compared with the same position) × survival × consistency × opponent strength × winning; the rating puts that on a curve. Click a player for every point.",
  time_machine: "Count only the weeks picked: standings, team pages, player stats, tiers and heroes are worked out from those weeks' games and series alone. Pick one week, several, or weeks 1 to N to see the league as it stood then. Cross-league \"overall\" ranks and lane cut-offs use the same weeks. With one or two weeks picked, players need only that many games to be ranked (3 otherwise).",
  strength_of_schedule: "How tough each team's opponents have been, and how tough the rest of the schedule is.",
  recent_pubs: "Public and ranked games in the 14 days before the last sync, from OpenDota, smurf accounts included.",
  pub_record: "Wins–losses in recent pubs.",

  // Predictions
  points: "Correct calls / series called.",
  correct: "Share of calls that were right.",
  model_col: "What the model would have picked, using only results from before it. Where shown, the % is the chance it gave the actual result.",
  crowd_col: "The most-picked call, and how many people picked.",
  you_col: "Your call, matched by the name you pick with.",
  model_draft: "The model's guess at all 24 draft steps. Hover any step for why it was chosen.",
  player_pools: "Each player's likeliest heroes: league games (recent weeks count most) plus pubs since the last league night, discounted by the chance the other team bans it. % = rough chance they play it.",

  // Combat (parsed replays)
  apm: "Actions per minute: every order given to a unit (move, attack, cast, buy…), from the replay. A measure of how busy the hands are, not how good the play is.",
  tf_part: "Share of their team's teamfights they took part in, as OpenDota's replay parse counts it.",
  best_streak: "Most hero kills without dying in one game. 3 is a Killing Spree, 5 a Mega Kill, 7 Wicked Sick, 9 Godlike, 10+ Beyond Godlike, as the game announces them.",
  rampages: "Five hero kills in quick succession, as the game announces it. Ultra kill = four, triple = three, double = two.",
  ultras: "Four hero kills in quick succession, as the game announces it.",
  fb_rate: "Share of games where they got the first hero kill of the game.",
  runes_pg: "Runes picked up a game: bounty, power runes (haste, double damage, illusion, invisibility, regeneration, arcane, shield), water and wisdom.",
  max_hit: "The biggest single instance of damage they dealt to an enemy hero, and what dealt it (an ability, an item or a right-click).",
  courier_kills: "Enemy couriers killed (last hit).",
  pings: "Map pings over the game: the minimap alerts players send their team.",
  pings_pg: "Map pings a game: the minimap alerts players send their team.",
  death_sources: "What got the last hit on each death: an enemy hero, a tower (or the fountain), lane creeps, neutral creeps, or Roshan and other units. Only games whose replay logged every death; some parses only logged deaths to heroes, and those are left out.",
  benchmarks: "OpenDota compares every number in a game with public games on the same hero: the 70th percentile means better than 70% of them. Averaged over their games. It's against the whole public player base on that hero, not this league.",
  streak_chart: "Every run of kills without dying, as a line that climbs one step per kill and drops at the death that ended it. Hover a line, a portrait, a dot or an × for who, when and who ended it.",
  first_blood: "The first hero kill of the game: who got it, when (negative = before the horn) and on whom.",
  pub_prep: "Their league games split by whether they'd played that hero in a public or ranked game in the 7 days before. Only games late enough that the full week before is in the pub log.",
  skill_build: "Which ability got each skill point, level by level, over every game on this hero in this league (from the replays).",
  hero_with: "The hero's record in games where the other hero was on its team.",
  hero_against: "The hero's record in games against the other hero.",
  hero_neutrals: "The neutral item in its slot at the end of each game, and its record in those games.",
  team_sides: "Record by side of the map. Radiant starts bottom left and picks from its own side of the draft.",
  team_standins: "Record in games where at least one player wasn't on their roster, against games with the roster only.",
  team_first_blood: "How often they got the first hero kill of the game, and how often they won those games.",
  team_fight_rate: "Teamfights (OpenDota's: a run of 3+ deaths close together) where they lost fewer heroes than the other team, of the ones that weren't even.",
  aegis_steals: "Roshan's Aegis picked up by the team that didn't kill him.",
  team_length: "Record by how long the game ran.",
  team_pairs: "Every two players who played together for this team, and their record together.",
  lead_conversion: "Record in games where they were ahead (or behind) on gold at that minute. Games that ended before it don't count.",
  medal_rating: "Each player's PlayOn medal against their tier-list rating. The dashed line is what players of each medal usually rate here; the names are the farthest above and below it.",
  fb_win_rate: "How often the team that got the first hero kill went on to win, over every game with kill logs.",
  fb_death_rate: "Share of games where they were first blood's victim.",
  radiant_rate: "How often Radiant (bottom left) won, over every game with a draft.",
  pauses: "The game with the most paused time this week.",
};

export function info(id) {
  if (!INFO[id]) return "";
  return `<button type="button" class="info" data-info="${id}" aria-label="What is this?" aria-expanded="false">i</button>`;
}

let pop = null, owner = null, pinned = false;

function place() {
  const r = owner.getBoundingClientRect(), gap = 8, edge = 12;
  pop.style.left = "0px"; pop.style.top = "0px";
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.min(Math.max(edge, r.left + r.width / 2 - w / 2), window.innerWidth - w - edge);
  const below = r.bottom + gap + h <= window.innerHeight - edge || r.top - gap - h < edge;
  pop.style.left = `${left}px`;
  pop.style.top = `${below ? r.bottom + gap : r.top - gap - h}px`;
}

function show(btn, pin) {
  if (owner && owner !== btn) hide();
  owner = btn;
  pinned = pin;
  pop.textContent = INFO[btn.dataset.info] ?? "";
  pop.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  btn.setAttribute("aria-describedby", "info-pop");
  place();
}

function hide() {
  if (!owner) return;
  owner.setAttribute("aria-expanded", "false");
  owner.removeAttribute("aria-describedby");
  owner = null;
  pinned = false;
  pop.hidden = true;
}

export function wireInfo() {
  pop = document.createElement("div");
  pop.id = "info-pop";
  pop.className = "info-pop";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  document.body.append(pop);

  // Capture phase, so a bubble inside a sortable header, a <summary> or a link card opens
  // itself instead of sorting, toggling or navigating.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".info");
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      if (owner === btn && pinned) hide(); else show(btn, true);
      return;
    }
    if (owner && !pop.contains(e.target)) hide();
  }, true);

  const canHover = window.matchMedia?.("(hover: hover)").matches;
  if (canHover) {
    document.addEventListener("mouseover", (e) => {
      const btn = e.target.closest?.(".info");
      if (btn && !pinned) show(btn, false);
    });
    document.addEventListener("mouseout", (e) => {
      const btn = e.target.closest?.(".info");
      if (btn && btn === owner && !pinned && !btn.contains(e.relatedTarget)) hide();
    });
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && owner) { const b = owner; hide(); b.focus(); } });
  window.addEventListener("scroll", () => owner && (pinned ? place() : hide()), { passive: true, capture: true });
  window.addEventListener("resize", () => owner && place());
  window.addEventListener("hashchange", hide);
}
