# Site Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Google-style results page for the site: a query ("radiant win rate", "how often does No Immortals win radiant", "pudge ban rate") returns links to the exact page, tab and section, with typo correction, a picker for topics with no name, and an empty page for nonsense.

**Architecture:** A pure reader (`lib/sitesearch.js`) turns the query into names (from the existing search index plus heroes), topics (a hand-written catalog, `lib/topics.js`) and league pages, and returns links. A results page (`pages/search.js`) draws them. Links carry `?tab=` and `?at=`; after any page renders, `core.js` scrolls to the `at` section and flashes it. The header pop-up keeps its suggestions; Enter opens the results page.

**Tech Stack:** Vanilla ES modules in the browser, `node --test` for tests, no build step. Spec: `docs/superpowers/specs/2026-10-06-site-search-design.md`.

**Git:** the working tree holds other uncommitted work. Commit steps add only the files named. Commit only if the user has said to commit this work; never push (a push to `main` deploys and posts to the public Discord).

---

## File map

| File | Responsibility |
|---|---|
| `public/lib/topics.js` (new) | Topic catalog, league pages, rate words, hero shorthand, anchors |
| `public/lib/sitesearch.js` (new) | `words`, `editDistance`, `siteSearch`, link helpers. Pure. |
| `public/parts/searchindex.js` (new) | `loadSearch()`: builds the all-league index once (moved from `app.js`) |
| `public/pages/search.js` (new) | Results page: filters, direct links, topic cards, names, pages, empty |
| `public/core.js` | `navigate()`, `scrollToSection()`, `goToSection()` |
| `public/app.js` | `/search` routes, link handler via `navigate`, pop-up Enter + "See all" row, `goToSection` after render |
| `public/pages/teams.js` | Heading ids, shared scroll helper |
| `public/style.css` | Results page, topic cards, sitelinks, flash |
| `docs/features.md` | Search section |
| `test/sitesearch.test.js` (new) | Reader and catalog tests |

---

### Task 1: Topic catalog

**Files:**
- Create: `public/lib/topics.js`
- Create: `test/sitesearch.test.js` (catalog test only; Task 2 adds the rest)

- [ ] **Step 1: Write the failing catalog test**

`test/sitesearch.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOPICS, PAGES, HERO_SHORT, ANCHORS, RATE_WORDS } from "../public/lib/topics.js";
import { INFO } from "../public/lib/glossary.js";
import { HEROES } from "../public/lib/heroes.js";
import { TEAM_TABS, PLAYER_TABS, HERO_TABS, STANDINGS_TABS } from "../public/lib/pagetabs.js";
import { fold } from "../public/lib/search.js";

const LEAGUE_TABS = { "": STANDINGS_TABS.map(([id]) => id), heroes: ["tiers", "players", "table"], players: [], week: [] };
const PAGE_TABS = { team: TEAM_TABS, player: PLAYER_TABS, hero: HERO_TABS };
const where = (at) => !at || INFO[at] || ANCHORS.includes(at);
const clean = (w) => w === fold(w).replace(/[^\p{L}\p{N} ]/gu, "") && !/\s{2}/.test(w);

test("topic catalog points at real glossary entries, tabs and heroes", () => {
  const ids = new Set();
  for (const t of [...TOPICS, ...PAGES]) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    assert.ok(t.words.length, `${t.id}: no words`);
    for (const w of t.words) assert.ok(clean(w), `${t.id}: "${w}" must be lowercase letters, digits and single spaces`);
  }
  for (const t of TOPICS) {
    assert.ok(t.key ? INFO[t.key] : t.text, `${t.id}: needs a glossary key or text`);
    for (const kind of ["team", "player", "hero"]) {
      const s = t[kind];
      if (!s) continue;
      assert.ok(PAGE_TABS[kind].some(([id]) => id === s.tab), `${t.id}: no ${kind} tab "${s.tab}"`);
      assert.ok(where(s.at), `${t.id}: "${s.at}" is neither a glossary key nor an anchor`);
    }
    if (t.league) {
      const L = t.league;
      assert.ok(L.path in LEAGUE_TABS, `${t.id}: unknown league path "${L.path}"`);
      if (L.tab) assert.ok(LEAGUE_TABS[L.path].includes(L.tab), `${t.id}: no tab "${L.tab}" on "${L.path}"`);
      assert.ok(where(L.at), `${t.id}: "${L.at}" is neither a glossary key nor an anchor`);
    }
    assert.ok(t.team || t.player || t.hero || t.league, `${t.id}: lives nowhere`);
  }
  for (const w of RATE_WORDS) assert.ok(clean(w));
  for (const [s, hero] of Object.entries(HERO_SHORT)) assert.ok(HEROES.includes(hero), `${s} → ${hero} isn't a hero`);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/sitesearch.test.js`
Expected: FAIL, `Cannot find module '.../public/lib/topics.js'`.

- [ ] **Step 3: Write the catalog**

`public/lib/topics.js`:

```js
// Site search's catalog (lib/sitesearch.js reads it): every section worth linking to, the words
// people use for it, and where it lives on each kind of page. A scope is { tab, at }: the
// page's tab id (lib/pagetabs.js) and the section to scroll to, either a glossary key (found on
// the page by its info button) or an element id from ANCHORS. A league scope adds `path`, the
// page under the league root ("" = standings), and `ad2l: true` when scrims don't have it.
// `key` is the glossary entry whose text is the snippet; `text` stands in when there is none.
// `rate: true` topics rank higher when the query says "win rate", "wr" and so on.
// Words are lowercase; a phrase ("first pick") is matched as consecutive words. Adding words
// here is how a search that came back empty gets fixed.

export const RATE_WORDS = ["win", "wins", "winning", "rate", "rates", "wr", "winrate", "percent", "pct", "ratio"];

// Section headings with an id (no info button to find them by).
export const ANCHORS = ["head-to-head", "hero-pool"];

export const TOPICS = [
  { id: "record", title: "Record", text: "Wins and losses.", rate: true,
    words: ["record", "losses", "lose", "loses", "wl"],
    team: { tab: "overview" }, player: { tab: "stats" }, hero: { tab: "stats" }, league: { path: "", tab: "table", ad2l: true } },
  { id: "sides", title: "Record by side", key: "team_sides", rate: true,
    words: ["radiant", "dire", "side", "sides", "rad"],
    team: { tab: "overview", at: "team_sides" }, league: { path: "heroes", tab: "table", at: "radiant_rate" } },
  { id: "side_pick", title: "Side and pick order", key: "team_side_pick", rate: true,
    words: ["first pick", "second pick", "pick order", "fp", "coin toss", "toss", "side pick"],
    team: { tab: "heroes", at: "team_side_pick" }, league: { path: "heroes", tab: "table", at: "first_pick" } },
  { id: "first_blood", title: "First blood", key: "team_first_blood", rate: true,
    words: ["first blood", "fb", "firstblood"],
    team: { tab: "overview", at: "team_first_blood" }, player: { tab: "combat", at: "fb_rate" }, league: { path: "heroes", tab: "table", at: "fb_win_rate" } },
  { id: "teamfights", title: "Teamfights", key: "team_fight_rate", rate: true,
    words: ["teamfight", "teamfights", "fight", "fights", "team fight", "team fights"],
    team: { tab: "overview", at: "team_fight_rate" }, player: { tab: "combat", at: "tf_part" } },
  { id: "standins", title: "With stand-ins", key: "team_standins", rate: true,
    words: ["standin", "standins", "stand in", "stand ins", "sub", "subs", "substitute", "ringer", "ringers"],
    team: { tab: "overview", at: "team_standins" } },
  { id: "aegis", title: "Aegis steals", key: "aegis_steals",
    words: ["aegis", "steal", "steals", "stolen", "aegis steal"],
    team: { tab: "overview", at: "aegis_steals" } },
  { id: "length", title: "Game length", key: "team_length", rate: true,
    words: ["length", "duration", "long", "short", "minutes", "game length", "game time", "fast", "slow"],
    team: { tab: "overview", at: "team_length" } },
  { id: "kills", title: "Average kills", key: "avg_kills",
    words: ["kills", "kill", "kills per game", "score"],
    team: { tab: "overview", at: "avg_kills" } },
  { id: "h2h", title: "Head to head", text: "Record against each opponent.", rate: true,
    words: ["head to head", "h2h", "vs", "versus", "against", "matchup", "matchups", "opponents", "counter", "counters", "record against"],
    team: { tab: "overview", at: "head-to-head" }, hero: { tab: "matchups", at: "hero_against" } },
  { id: "streak", title: "Form and streaks", key: "standings_streak",
    words: ["streak", "streaks", "form", "win streak", "losing streak", "hot"],
    team: { tab: "overview" }, league: { path: "", tab: "table", at: "standings_streak", ad2l: true } },
  { id: "draft_phase", title: "Draft by phase", key: "draft_by_phase",
    words: ["draft", "drafts", "drafting", "phase", "phases", "draft phase", "bans", "picks", "banned against"],
    team: { tab: "heroes", at: "draft_by_phase" }, hero: { tab: "draft", at: "hero_phases" } },
  { id: "ban_rate", title: "Ban rate", key: "ban_rate", rate: true,
    words: ["ban rate", "ban", "banned", "most banned"],
    hero: { tab: "stats", at: "ban_rate" }, league: { path: "heroes", tab: "table" } },
  { id: "pick_rate", title: "Pick rate", key: "pick_rate", rate: true,
    words: ["pick rate", "picked", "popular", "popularity", "most picked"],
    hero: { tab: "stats", at: "pick_rate" }, league: { path: "heroes", tab: "table" } },
  { id: "contest", title: "Contest rate", key: "contest_rate", rate: true,
    words: ["contest", "contested", "contest rate"],
    hero: { tab: "stats", at: "contest_rate" }, league: { path: "heroes", tab: "table" } },
  { id: "draft_slot", title: "Draft slot", key: "draft_slot",
    words: ["draft slot", "slot", "pick position", "last pick", "last picked"],
    hero: { tab: "stats", at: "draft_slot" }, player: { tab: "heroes", at: "by_draft_pick" }, league: { path: "heroes", tab: "table", at: "last_pick" } },
  { id: "hero_pool", title: "Hero pool", text: "Every hero played, with the record on each.",
    words: ["hero pool", "pool", "heroes played", "most played", "signature", "comfort"],
    team: { tab: "heroes", at: "hero-pool" }, player: { tab: "heroes" } },
  { id: "hero_grid", title: "Hero grid for Dota", key: "hero_grid",
    words: ["hero grid", "grid", "grids"],
    team: { tab: "heroes", at: "hero_grid" } },
  { id: "hero_players", title: "Players on the hero", text: "Who plays the hero, and how well.",
    words: ["plays", "who plays", "best players", "players on", "one trick"],
    hero: { tab: "players" } },
  { id: "hero_with", title: "Best with", key: "hero_with",
    words: ["synergy", "synergies", "combo", "combos", "best with", "goes with"],
    hero: { tab: "matchups", at: "hero_with" } },
  { id: "roster", title: "Roster", text: "The team's players, by position.",
    words: ["roster", "captain", "captains", "members", "lineup"],
    team: { tab: "roster" } },
  { id: "pairs", title: "Pairs and lineups", key: "team_pairs",
    words: ["pairs", "pair", "duo", "duos", "lineups", "five stack"],
    team: { tab: "roster", at: "team_pairs" } },
  { id: "outcomes", title: "Outcomes", text: "Every way the rest of the season can go for the team: playoff chances and seeds.",
    words: ["chances", "outcomes", "playoffs", "playoff", "seed", "seeding", "make playoffs"],
    team: { tab: "chances" } },
  { id: "kda", title: "KDA", key: "kda",
    words: ["kda", "kd", "assists"],
    player: { tab: "stats", at: "kda" }, hero: { tab: "stats", at: "kda" } },
  { id: "gpm", title: "GPM and farm", key: "avg_gpm",
    words: ["gpm", "xpm", "gold per minute", "farm", "net worth", "networth"],
    player: { tab: "stats", at: "avg_gpm" }, hero: { tab: "stats", at: "avg_gpm" } },
  { id: "kp", title: "Kill participation", key: "avg_kp", rate: true,
    words: ["kp", "kill participation", "participation"],
    player: { tab: "stats", at: "avg_kp" } },
  { id: "damage", title: "Damage", key: "dmg_per_min",
    words: ["damage", "dmg", "hero damage"],
    player: { tab: "stats", at: "dmg_per_min" } },
  { id: "stacks", title: "Stacks", key: "stacks_pg",
    words: ["stacks", "stack", "stacking", "stacked", "camps stacked"],
    player: { tab: "stats", at: "stacks_pg" } },
  { id: "dewards", title: "Dewards", key: "dewards_pg",
    words: ["dewards", "deward", "dewarding"],
    player: { tab: "stats", at: "dewards_pg" } },
  { id: "deaths", title: "Deaths by source", key: "death_sources",
    words: ["deaths", "death", "died", "dies", "killed by"],
    player: { tab: "combat", at: "death_sources" }, hero: { tab: "combat", at: "death_sources" } },
  { id: "rampages", title: "Rampages", key: "rampages",
    words: ["rampage", "rampages", "ultra", "ultras", "ultra kill"],
    player: { tab: "combat", at: "rampages" } },
  { id: "apm", title: "APM", key: "apm",
    words: ["apm", "actions"],
    player: { tab: "combat", at: "apm" } },
  { id: "gold_lead", title: "Gold lead", key: "team_gold",
    words: ["gold", "gold lead", "lead", "gold graph", "ahead", "behind", "comeback", "comebacks", "throw", "throws"],
    team: { tab: "map", at: "team_gold" } },
  { id: "wards", title: "Ward map", key: "ward_map",
    words: ["wards", "ward", "vision", "observers", "observer", "sentries", "sentry", "ward map", "obs", "sen"],
    team: { tab: "map", at: "ward_map" }, player: { tab: "map", at: "ward_map" }, hero: { tab: "map", at: "ward_map" } },
  { id: "roshan", title: "Roshan control", key: "team_roshans",
    words: ["roshan", "rosh", "roshans"],
    team: { tab: "map", at: "team_roshans" } },
  { id: "smokes", title: "Smokes", key: "team_smokes",
    words: ["smoke", "smokes", "gank", "ganks", "ganking"],
    team: { tab: "map", at: "team_smokes" } },
  { id: "laning", title: "Laning", key: "lane_record", rate: true,
    words: ["lane", "lanes", "laning", "offlane", "safelane", "mid", "midlane", "first 10 minutes"],
    team: { tab: "lanes", at: "lane_record" }, player: { tab: "lanes", at: "lane_record" }, hero: { tab: "lanes", at: "lane_record" } },
  { id: "items", title: "Items", key: "core_items",
    words: ["items", "item", "build", "builds", "core items", "item build", "itemization"],
    player: { tab: "items", at: "core_items" }, hero: { tab: "items", at: "core_items" } },
  { id: "skill_build", title: "Skill build", key: "skill_build",
    words: ["skill build", "skills", "abilities", "talents", "skill order"],
    hero: { tab: "items", at: "skill_build" } },
  { id: "neutrals", title: "Neutral items", key: "hero_neutrals",
    words: ["neutral", "neutrals", "neutral items"],
    hero: { tab: "items", at: "hero_neutrals" } },
  { id: "pubs", title: "Pub games", key: "recent_pubs",
    words: ["pub", "pubs", "pub games", "ranked", "practice", "pub record"],
    player: { tab: "heroes", at: "recent_pubs" } },
  { id: "tier", title: "Tier list", key: "tier",
    words: ["tier", "tiers", "tier list", "rating", "ratings", "rank", "ranking", "rankings", "grade"],
    player: { tab: "stats", at: "tier" }, league: { path: "players", at: "tier_list" } },
  { id: "hero_tiers", title: "Hero tier list", key: "hero_tier_list",
    words: ["hero tier", "hero tiers", "hero tier list", "meta", "strongest heroes", "best heroes"],
    league: { path: "heroes", tab: "tiers", at: "hero_tier_list" } },
  { id: "stat_leaders", title: "Stat leaders", key: "stat_leaders",
    words: ["leaders", "leader", "leaderboard", "stat leaders", "top", "most"],
    league: { path: "players", at: "stat_leaders" } },
  { id: "medal", title: "Medal vs rating", key: "medal_rating",
    words: ["medal", "medals", "mmr"],
    league: { path: "players", at: "medal_rating" } },
  { id: "sos", title: "Strength of schedule", key: "sos",
    words: ["strength of schedule", "sos", "schedule strength", "difficulty"],
    league: { path: "", tab: "table", at: "sos", ad2l: true } },
  { id: "upsets", title: "Upsets", key: "standings_upset",
    words: ["upset", "upsets", "surprise"],
    league: { path: "", tab: "table", at: "standings_upset", ad2l: true } },
  { id: "race", title: "Points race", text: "Points over the season, team by team.",
    words: ["race", "points race", "title race"],
    league: { path: "", tab: "race", ad2l: true } },
  { id: "crosstable", title: "Crosstable", text: "Every team's result against every other team.",
    words: ["crosstable", "cross table", "results grid"],
    league: { path: "", tab: "cross", ad2l: true } },
  { id: "up_next", title: "Up next", text: "The next round of matches.",
    words: ["up next", "next", "upcoming", "fixtures", "schedule", "next week"],
    league: { path: "", tab: "next", ad2l: true } },
  { id: "mvp", title: "MVP and highlights", key: "mvp",
    words: ["mvp", "mvps", "player of the week", "highlights", "potw"],
    league: { path: "week" } },
];

// League pages, matched by name. `tabs`: "standings" = lib/pagetabs.js STANDINGS_TABS.
export const PAGES = [
  { id: "page_standings", title: "Standings", words: ["standings", "table", "ladder", "teams"], path: "", tabs: "standings" },
  { id: "page_weekly", title: "Weekly", words: ["weekly", "week", "weeks", "games", "matches", "results"], path: "week" },
  { id: "page_players", title: "Players", words: ["players", "player list"], path: "players" },
  { id: "page_heroes", title: "Heroes", words: ["heroes", "hero list"], path: "heroes", tabs: [["tiers", "Hero tiers"], ["players", "Players on heroes"], ["table", "All heroes"]] },
  { id: "page_predict", title: "Predict", words: ["predict", "prediction", "predictions", "odds"], path: "predict" },
  { id: "page_drafter", title: "Drafter", words: ["drafter", "draft tool", "simulator", "practice draft"], path: "drafter", ad2l: true },
  { id: "page_upload", title: "Upload", words: ["upload", "replay", "replays", "submit"], path: "upload" },
];

// Hero shorthand players type. Values are lib/heroes.js names (the test checks).
export const HERO_SHORT = {
  am: "Anti-Mage", wk: "Wraith King", sf: "Shadow Fiend", qop: "Queen of Pain", cm: "Crystal Maiden",
  ta: "Templar Assassin", pl: "Phantom Lancer", pa: "Phantom Assassin", od: "Outworld Devourer",
  ss: "Shadow Shaman", es: "Earthshaker", ns: "Night Stalker", bh: "Bounty Hunter", ds: "Dark Seer",
  dp: "Death Prophet", lc: "Legion Commander", wd: "Witch Doctor", ck: "Chaos Knight", sk: "Sand King",
  void: "Faceless Void", bb: "Bristleback", ww: "Winter Wyvern", dk: "Dragon Knight", kotl: "Keeper of the Light",
  aa: "Ancient Apparition", mk: "Monkey King", ogre: "Ogre Magi", jugg: "Juggernaut", np: "Nature's Prophet",
  furion: "Nature's Prophet", sb: "Spirit Breaker", storm: "Storm Spirit", ember: "Ember Spirit", veno: "Venomancer",
};
```

- [ ] **Step 4: Run the test**

Run: `node --test test/sitesearch.test.js`
Expected: PASS (1 test). If an assertion names a topic, fix that entry, not the test.

- [ ] **Step 5: Commit**

```bash
git add public/lib/topics.js test/sitesearch.test.js
git commit -m "Site search: topic catalog"
```

---

### Task 2: Query reader — words, typo distance, link helpers

**Files:**
- Create: `public/lib/sitesearch.js`
- Modify: `test/sitesearch.test.js` (append)

- [ ] **Step 1: Write the failing tests** (append to `test/sitesearch.test.js`)

```js
import { words, editDistance, typoLimit, withAt, leagueHref } from "../public/lib/sitesearch.js";

test("words: folded, possessives and punctuation gone, % spelled out", () => {
  assert.deepEqual(words("How often does No Immortals' win%?"), ["how", "often", "does", "no", "immortals", "win", "percent"]);
  assert.deepEqual(words("Who's best K/D"), ["who", "best", "k", "d"]);
  assert.deepEqual(words("  "), []);
});

test("editDistance counts a swap of neighbours as one edit", () => {
  assert.equal(editDistance("radaint", "radiant"), 1);
  assert.equal(editDistance("pikc", "pick"), 1);
  assert.equal(editDistance("imortals", "immortals"), 1);
  assert.equal(editDistance("abc", "xyz", 2), 3);
  assert.deepEqual(["kp", "kda", "pikc", "radiant", "imortals"].map(typoLimit), [0, 0, 1, 2, 2]);
});

test("link helpers", () => {
  assert.equal(withAt("#/champion/teams/5", { tab: "overview", at: "team_sides" }), "#/champion/teams/5?tab=overview&at=team_sides");
  assert.equal(withAt("#/champion/teams/5", {}), "#/champion/teams/5");
  assert.equal(leagueHref("#", { path: "" }), "#/scrims");
  assert.equal(leagueHref("#", { path: "heroes", tab: "table" }), "#/heroes?tab=table");
  assert.equal(leagueHref("#/champion", { path: "heroes", tab: "table", at: "radiant_rate" }), "#/champion/heroes?tab=table&at=radiant_rate");
  assert.equal(leagueHref("#/champion", { path: "" }), "#/champion/");
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/sitesearch.test.js`
Expected: FAIL, `Cannot find module '.../public/lib/sitesearch.js'`.

- [ ] **Step 3: Write the helpers**

`public/lib/sitesearch.js`:

```js
// Site search: reads a query into names (teams, players, heroes), topics (lib/topics.js) and
// league pages, corrects near-miss spellings, and returns links. Pure, so the results page
// (pages/search.js) and the tests share it. Spec: docs/superpowers/specs/2026-10-06-site-search-design.md.
import { fold, searchIndex } from "./search.js";
import { TOPICS, PAGES, HERO_SHORT, RATE_WORDS } from "./topics.js";
import { TEAM_TABS, PLAYER_TABS, HERO_TABS, tabList } from "./pagetabs.js";

// Words that carry no meaning in a question. "with", "vs" and "against" do, so they stay.
export const STOP = new Set(["how", "often", "does", "do", "did", "is", "are", "was", "were", "the", "a", "an", "what", "whats",
  "who", "which", "in", "on", "at", "of", "for", "to", "my", "their", "his", "her", "its", "me", "show", "find", "tell", "much",
  "many", "times", "there", "they", "them", "has", "have", "get", "gets", "when", "as", "and", "or", "by"]);
const RATE = new Set(RATE_WORDS);

// Lowercase words: accents folded, "No Immortals'" and "team's" lose the possessive, "%" reads as "percent".
export function words(q) {
  return fold(q).replace(/['’]s\b/g, "").replace(/['’]/g, "").replace(/%/g, " percent ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
}

// Edits between two words, a swap of neighbouring letters counting as one. Stops early (returns
// max + 1) when the lengths alone rule it out.
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
// How many typos a word may carry: none up to 3 letters (too easy to confuse), 1 up to 6, 2 beyond.
export const typoLimit = (w) => (w.length <= 3 ? 0 : w.length <= 6 ? 1 : 2);

// "#/x?tab=…&at=…" from a scope { tab, at }.
export function withAt(href, { tab, at } = {}) {
  const p = new URLSearchParams();
  if (tab) p.set("tab", tab);
  if (at) p.set("at", at);
  const s = p.toString();
  return s ? `${href}?${s}` : href;
}
// A league page from its root ("#" for scrims, whose standings live at #/scrims).
export const leagueHref = (root, { path = "", tab, at } = {}) => withAt(root === "#" ? `#/${path || "scrims"}` : `${root}/${path}`, { tab, at });
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/sitesearch.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add public/lib/sitesearch.js test/sitesearch.test.js
git commit -m "Site search: words, typo distance, link helpers"
```

---

### Task 3: Query reader — names, topics, correction, results

**Files:**
- Modify: `public/lib/sitesearch.js` (append)
- Modify: `test/sitesearch.test.js` (append)

- [ ] **Step 1: Write the failing tests** (append)

```js
import { siteSearch, sitelinks } from "../public/lib/sitesearch.js";
import { buildSearchIndex } from "../public/lib/search.js";

const champ = { teams: [
  { id: 15026, name: "No Immortals", players: [{ name: "Hex", account_id: 11 }] },
  { id: 15022, name: "Radiant Ravens", players: [{ name: "Rune", account_id: 21 }] },
], games: [] };
const warrior = { teams: [{ id: 9, name: "No Immortals", players: [] }], games: [] };
const index = buildSearchIndex([
  { key: "ad2l", label: "Champion", root: "#/champion", data: champ },
  { key: "warrior", label: "Warrior", root: "#/warrior", data: warrior },
]);
const run = (query, o = {}) => siteSearch({ index, heroes: ["Anti-Mage", "Pudge", "Mirana"], query, league: "ad2l",
  heroHref: (h) => `#/champion/hero/${h}`, ...o });

test("a name plus a topic is a direct link, this league first", () => {
  const r = run("how often does No Immortals win radiant");
  assert.equal(r.empty, false);
  assert.equal(r.direct[0].entity.name, "No Immortals");
  assert.equal(r.direct[0].entity.league, "ad2l");
  assert.equal(r.direct[0].topic.id, "sides");
  assert.equal(r.direct[0].href, "#/champion/teams/15026?tab=overview&at=team_sides");
  assert.equal(r.direct[0].tab, "Overview");
  assert.equal(r.direct.length, 2); // Warrior's No Immortals too
});

test("a topic with no name is a card with its scopes", () => {
  const r = run("radiant win rate");
  assert.equal(r.direct.length, 0);
  assert.equal(r.cards[0].topic.id, "sides");
  assert.deepEqual(r.cards[0].scopes, ["league", "team"]);
  assert.equal(r.corrected, null);
});

test("typos are corrected and reported", () => {
  const r = run("radaint win rate");
  assert.equal(r.corrected, "radiant win rate");
  assert.equal(r.cards[0].topic.id, "sides");
  const n = run("No Imortals");
  assert.equal(n.corrected, "no immortals");
  assert.equal(n.names[0].name, "No Immortals");
  assert.equal(n.names[0].league, "ad2l");
  assert.equal(run("frist pikc").cards[0].topic.id, "side_pick");
});

test("exact=1 turns correction off", () => {
  assert.equal(run("radaint").corrected, "radiant");
  const r = run("radaint", { exact: true });
  assert.equal(r.corrected, null);
  assert.equal(r.empty, true);
});

test("heroes by name and shorthand, with their tabs as sitelinks", () => {
  const p = run("pudge");
  assert.equal(p.names[0].kind, "hero");
  assert.equal(p.names[0].href, "#/champion/hero/Pudge");
  assert.ok(sitelinks(p.names[0]).some(([label, href]) => label === "Draft" && href === "#/champion/hero/Pudge?tab=draft"));
  const am = run("am ban rate");
  assert.equal(am.direct[0].entity.name, "Anti-Mage");
  assert.equal(am.direct[0].topic.id, "ban_rate");
  assert.equal(am.direct[0].href, "#/champion/hero/Anti-Mage?tab=stats&at=ban_rate");
});

test("short words are never corrected", () => {
  const kp = run("kp");
  assert.equal(kp.cards[0].topic.id, "kp");
  assert.equal(kp.corrected, null);
  assert.equal(run("kq").empty, true);
});

test("part of a name still finds it", () => {
  const r = run("immortals");
  assert.equal(r.empty, false);
  assert.ok(r.names.some((e) => e.name === "No Immortals"));
});

test("nonsense and mostly-unmatched questions are empty", () => {
  assert.equal(run("asdfgh").empty, true);
  assert.equal(run("who's best at the side of the river").empty, true);
  assert.equal(run("").empty, true);
});

test("league pages by name", () => {
  const r = run("standings");
  assert.equal(r.pages[0].id, "page_standings");
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/sitesearch.test.js`
Expected: FAIL, `siteSearch is not a function` (or not exported).

- [ ] **Step 3: Write the reader** (append to `public/lib/sitesearch.js`)

```js
const phraseWords = (p) => p.split(" ").filter((x) => !STOP.has(x));
const TOPIC_WORDS = new Set([...TOPICS, ...PAGES].flatMap((t) => t.words.flatMap(phraseWords)));
const SCOPES = ["league", "team", "player", "hero"];
const LISTS = { team: TEAM_TABS, player: PLAYER_TABS, hero: HERO_TABS };
const RECORD = TOPICS.find((t) => t.id === "record");

// A page type's tab label, and every tab of an entity's page as [label, href] (sitelinks).
export const tabLabel = (kind, id, league) => tabList(LISTS[kind], { ad2l: league !== "scrim" }).find(([x]) => x === id)?.[1] ?? null;
export const sitelinks = (e) => tabList(LISTS[e.kind], { ad2l: e.league !== "scrim" }).map(([id, label]) => [label, withAt(e.href, { tab: id })]);

// Per index (it's built once per visit): name runs and the spelling vocabulary.
const prepared = new WeakMap();
function prepare(index, heroes) {
  const hit = prepared.get(index);
  if (hit && hit.heroes === heroes) return hit;
  const short = Object.entries(HERO_SHORT);
  const heroEnts = heroes.map((h) => ({ kind: "hero", name: h, league: null, terms: [h, ...short.filter(([, n]) => n === h).map(([s]) => s)] }));
  const byRun = new Map(), vocab = new Map();
  const addRun = (k, e) => (byRun.get(k) ?? byRun.set(k, []).get(k)).push(e);
  const addWord = (w, from) => (vocab.get(w) ?? vocab.set(w, new Set()).get(w)).add(from);
  for (const e of [...index, ...heroEnts]) for (const t of e.terms) {
    const w = words(t);
    for (const x of w) addWord(x, e.league ?? "*");
    if (!w.length || w.length > 4) continue;
    addRun(w.join(" "), e);
    if (w.length > 1) addRun(w.join(""), e);
  }
  for (const x of [...TOPIC_WORDS, ...RATE]) addWord(x, "*");
  const out = { heroes, byRun, vocab, vocabList: [...vocab.keys()] };
  prepared.set(index, out);
  return out;
}

// The closest known word within the typo limit: exact always wins; then fewest edits, then this
// league's names, then topics and heroes, then other leagues. A word that starts a known word
// ("immo") is someone mid-name, not a typo.
function correct(w, { vocab, vocabList }, league) {
  const max = typoLimit(w);
  if (!max || STOP.has(w) || vocab.has(w) || vocabList.some((v) => v.startsWith(w))) return w;
  let best = null;
  for (const v of vocabList) {
    if (STOP.has(v)) continue;
    const d = editDistance(w, v, max);
    if (d > max) continue;
    const from = vocab.get(v), pri = from.has(league) ? 0 : from.has("*") ? 1 : 2;
    if (!best || d < best.d || (d === best.d && (pri < best.pri || (pri === best.pri && v < best.v)))) best = { v, d, pri };
  }
  return best?.v ?? w;
}

// Score a topic or page against the words left after names: a phrase is worth 2, a word 1.
// `used` collects the positions it matched.
function score(item, rest, used) {
  let s = 0;
  for (const p of item.words) {
    const ps = phraseWords(p);
    if (!ps.length) continue;
    for (let i = 0; i + ps.length <= rest.length; i++) {
      if (!ps.every((x, k) => rest[i + k] === x)) continue;
      s += ps.length > 1 ? 2 : 1;
      ps.forEach((_, k) => used.add(i + k));
      break;
    }
  }
  return s;
}

const entKey = (e) => `${e.kind}|${e.href}`;
const dedupe = (es) => { const seen = new Set(); return es.filter((e) => !seen.has(entKey(e)) && seen.add(entKey(e))); };

// index: lib/search.js buildSearchIndex output (every league). heroes: hero names. league: the
// league searched from (index `league` key, "scrim", or null for All). heroHref: hero name → its
// page in that league. exact: no spelling correction.
// Returns { corrected, direct, cards, names, pages, empty }:
//   direct: [{ entity, topic, href, tab }]  a name's page at a topic's section
//   cards:  [{ topic, scopes }]             topics with no matching name, and where they live
//   names:  entities (teams, players, heroes), full-name matches first
//   pages:  PAGES entries whose words matched
export function siteSearch({ index, heroes = [], query, league = null, heroHref = () => null, exact = false }) {
  const none = { corrected: null, direct: [], cards: [], names: [], pages: [], empty: true };
  const raw = words(query ?? "");
  if (!raw.length) return none;
  const prep = prepare(index, heroes);
  const w = exact ? raw : raw.map((x) => correct(x, prep, league));
  const corrected = w.some((x, i) => x !== raw[i]) ? w.join(" ") : null;
  const ent = (e) => (e.kind === "hero" ? { ...e, league, href: heroHref(e.name) } : e);

  // Names: the longest run of up to 4 words that is someone's whole name. One word that is also
  // a topic word ("radiant") is read as the topic; the team still shows under names.
  const claimed = new Set(), found = [];
  for (let i = 0; i < w.length;) {
    let hit = null;
    for (let len = Math.min(4, w.length - i); len >= 1 && !hit; len--) {
      const run = w.slice(i, i + len);
      if (run.every((x) => STOP.has(x))) continue;
      if (len === 1 && (TOPIC_WORDS.has(run[0]) || RATE.has(run[0]))) continue;
      const es = prep.byRun.get(run.join(" ")) ?? (len > 1 ? prep.byRun.get(run.join("")) : null);
      if (es) hit = { len, es };
    }
    if (!hit) { i++; continue; }
    for (let k = i; k < i + hit.len; k++) claimed.add(k);
    found.push(...hit.es.map(ent));
    i += hit.len;
  }
  const full = dedupe(found).sort((a, b) => (b.league === league) - (a.league === league));

  // Topics and pages from what's left.
  const rest = [], rate = [];
  w.forEach((x, i) => { if (!claimed.has(i) && !STOP.has(x)) (RATE.has(x) ? rate : rest).push(x); });
  const used = new Set();
  const rank = (list, keep) => {
    const scored = list.map((t) => ({ t, s: score(t, rest, used) + (t.rate && rate.length ? 0.5 : 0) }))
      .filter((x) => x.s >= 1).sort((a, b) => b.s - a.s);
    return scored.filter((x) => x.s >= scored[0]?.s / 2).slice(0, keep).map((x) => x.t);
  };
  let topics = rank(TOPICS, 5);
  if (!topics.length && rate.length) topics = [RECORD];
  const pages = rank(PAGES, 3);

  // Part of a name: the existing header search over the whole query, then over each leftover
  // word of 4+ letters; heroes whose name contains a leftover word of 3+.
  const partial = [];
  const meaningful = w.filter((x) => !STOP.has(x));
  partial.push(...searchIndex(index, meaningful.join(" "), 10));
  rest.forEach((x, i) => {
    if (used.has(i)) return;
    const hs = x.length >= 4 ? searchIndex(index, x, 5) : [];
    const hh = x.length >= 3 ? prep.heroes.filter((h) => fold(h).includes(x)).slice(0, 5) : [];
    if (!hs.length && !hh.length) return;
    used.add(i);
    partial.push(...hs, ...hh.map((h) => ent({ kind: "hero", name: h, terms: [h] })));
  });
  const names = dedupe([...full, ...partial]);

  // Direct links: each whole-name match at each topic its kind of page has.
  const direct = [], covered = new Set();
  for (const e of full) for (const t of topics) {
    const s = t[e.kind];
    if (!s) continue;
    covered.add(t.id);
    direct.push({ entity: e, topic: t, href: withAt(e.href, s), tab: tabLabel(e.kind, s.tab, e.league) });
  }
  const cards = topics.filter((t) => !covered.has(t.id)).map((t) => ({ topic: t, scopes: SCOPES.filter((s) => t[s]) }));

  // Empty when nothing came up, or when more than half the meaningful words matched nothing.
  const unmatched = rest.filter((_, i) => !used.has(i)).length;
  const total = meaningful.length;
  const empty = (!direct.length && !cards.length && !names.length && !pages.length) || unmatched * 2 > total;
  return empty ? { ...none, corrected } : { corrected, direct, cards, names, pages, empty: false };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/sitesearch.test.js`
Expected: PASS (13 tests). If one fails, debug the reader against the spec's rule for that case; don't loosen the test.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: every test passes (the existing 240 plus these).

- [ ] **Step 6: Commit**

```bash
git add public/lib/sitesearch.js test/sitesearch.test.js
git commit -m "Site search: read names, topics and typos into links"
```

---

### Task 4: Shared index loader and in-app navigation

**Files:**
- Create: `public/parts/searchindex.js`
- Modify: `public/core.js` (add `navigate`)
- Modify: `public/app.js:188-202` (loader) and `:258-270` (link handler)

- [ ] **Step 1: Create the loader** (moved from `app.js`)

`public/parts/searchindex.js`:

```js
// The search index over every league: each division's trimmed file and the saved scrims,
// loaded once (the pages reuse the files). A division that can't load is left out rather than
// failing the search. The header pop-up and the results page share it.
import { DIVISIONS, SOURCES, divLite, allMatches } from "../core.js";
import { buildSearchIndex } from "../lib/search.js";

let ready = null;
export function loadSearch() {
  ready ??= Promise.all([
    Promise.all(Object.entries(DIVISIONS).map(async ([key, dv]) => {
      try { return { key, label: dv.short, root: SOURCES[key].root, views: dv.views, data: await divLite(key) }; }
      catch (e) { console.warn(`search: ${key} unavailable`, e); return null; }
    })),
    allMatches().catch((e) => { console.warn("search: scrims unavailable", e); return null; }),
  ]).then(([leagues, scrims]) => buildSearchIndex(leagues.filter(Boolean), scrims && { label: "Scrims", matches: scrims }))
    .catch((e) => { ready = null; throw e; });
  return ready;
}
```

- [ ] **Step 2: Add `navigate` to `core.js`**, directly under `export const addressOf = …` (line ~850):

```js
// In-app navigation to "#/x?tab=…&at=…": move the address without a page load (every query
// parameter rides along), then route as a hash change would.
export function navigate(href) {
  const [h, q = ""] = href.split("?");
  const params = new URLSearchParams(q), tab = params.get("tab");
  const u = new URL(addressOf(h), location.href);
  for (const [k, v] of params) u.searchParams.set(k, v);
  history.pushState(tab ? { tab } : null, "", u.pathname + u.search + u.hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
```

- [ ] **Step 3: Use both in `app.js`**

Imports: add `navigate` to the `./core.js` import list; add `import { loadSearch } from "./parts/searchindex.js";`; change `import { buildSearchIndex, searchIndex } from "./lib/search.js";` to keep both (the player menu still calls `buildSearchIndex`).

Replace the `loadSearch` function and its `searchReady` state (lines 188-202) with:

```js
// Header search: every player and team in every league (parts/searchindex.js loads it on
// first focus). Enter opens the full results page; arrowing to a suggestion first opens that.
const searchEl = document.getElementById("search"), searchIn = document.getElementById("search-in"), searchPop = document.getElementById("search-pop");
let searchIdx = null, searchHits = [], searchAt = -1;
```

In `showSearch`, replace `try { await loadSearch(); } catch {` with `try { searchIdx = await loadSearch(); } catch {`.

Change the focus listener to: `searchIn.addEventListener("focus", () => { loadSearch().then((i) => (searchIdx = i)).catch(() => {}); if (searchIn.value.trim()) showSearch(); });`

Replace the in-app link handler body (the `document.addEventListener("click", …a[href^="#/"]…)` block) with:

```js
document.addEventListener("click", (e) => {
  const a = e.target.closest?.('a[href^="#/"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
  e.preventDefault();
  navigate(a.getAttribute("href"));
});
```

- [ ] **Step 4: Check the app still loads and the pop-up still works**

Start the preview (`preview_start` name `scrim-league`), open `/#/champion/`, focus the search, type `hex`.
Expected: suggestions appear; clicking a team opens it; a nav dropdown tab link (`?tab=roster`) opens that tab; no console errors (`read_console_messages` with `onlyErrors`).

- [ ] **Step 5: Run tests and commit**

Run: `npm test` — expected: all pass.

```bash
git add public/parts/searchindex.js public/core.js public/app.js
git commit -m "Search index loader shared; in-app links keep every query parameter"
```

---

### Task 5: Deep links scroll and flash

**Files:**
- Modify: `public/core.js` (add `scrollToSection`, `goToSection`)
- Modify: `public/app.js` (`route()` return line)
- Modify: `public/pages/teams.js` (heading ids; shared scroll)
- Modify: `public/style.css` (flash)

- [ ] **Step 1: Add the helpers to `core.js`**, under `navigate`:

```js
// Scroll an element to just under the sticky header.
export function scrollToSection(el) {
  scrollTo({ top: scrollY + el.getBoundingClientRect().top - (document.querySelector(".top")?.offsetHeight ?? 0) - 12 });
}
// Site search links end in &at=<glossary key or element id>. After a page draws, scroll to that
// section in the open tab and flash it once; then drop `at` from the address so a copied link
// doesn't flash again. Sections some pages fill a moment later get one more look.
export function goToSection() {
  const u = new URL(location.href), at = u.searchParams.get("at");
  if (!at) return;
  u.searchParams.delete("at");
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  setRoutedAt(location.href);
  const find = () => {
    const panel = app.querySelector(".pp-panel:not([hidden])") ?? app;
    const btn = panel.querySelector(`[data-info="${CSS.escape(at)}"]`);
    if (btn) return btn.closest(".card, .td-tile") ?? btn.closest("h2, h3") ?? btn.parentElement;
    return panel.querySelector(`#${CSS.escape(at)}`);
  };
  const flash = (el) => {
    scrollToSection(el);
    el.classList.remove("search-flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("search-flash");
    el.addEventListener("animationend", () => el.classList.remove("search-flash"), { once: true });
  };
  const el = find();
  if (el) return flash(el);
  setTimeout(() => { const later = find(); if (later) flash(later); }, 600);
}
```

- [ ] **Step 2: Call it after every route** — in `app.js` `route()`, change the last line to:

```js
  return Promise.resolve(page()).then(goToSection).finally(() => footSync(src));
```

and add `goToSection` to the `./core.js` import.

- [ ] **Step 3: Heading ids and the shared scroll in `teams.js`**

Change `const opponents = h.opponents.length ? \`<h2>Head to head</h2>` to `const opponents = h.opponents.length ? \`<h2 id="head-to-head">Head to head</h2>`.

Change `<h2>Hero pool</h2>${chips(h.heroes,` to `<h2 id="hero-pool">Hero pool</h2>${chips(h.heroes,`.

Add `scrollToSection` to the `../core.js` import, and in the `[data-goto-tab]` handler replace

```js
    if (to) scrollTo({ top: scrollY + to.getBoundingClientRect().top - (document.querySelector(".top")?.offsetHeight ?? 0) - 12 });
```

with

```js
    if (to) scrollToSection(to);
```

- [ ] **Step 4: Flash style** — append to `public/style.css`:

```css
/* Site search deep links: the section a result pointed at flashes once (core.js goToSection). */
.search-flash { animation: search-flash 1.2s ease-out; border-radius: 6px; }
@keyframes search-flash {
  0%, 30% { box-shadow: 0 0 0 2px var(--accent), 0 0 24px color-mix(in srgb, var(--accent) 45%, transparent); }
  100% { box-shadow: 0 0 0 2px transparent, 0 0 0 transparent; }
}
@media (prefers-reduced-motion: reduce) { .search-flash { animation: none; outline: 2px solid var(--accent); outline-offset: 2px; } }
```

- [ ] **Step 5: Verify in the browser**

Navigate the preview to `/#/champion/teams/15026?tab=overview&at=team_sides` (load the address directly).
Expected: Overview tab open, the Sides card scrolled under the header and flashing; afterwards the address bar has `?tab=overview` and no `at`. Then `?tab=heroes&at=hero-pool` scrolls to Hero pool. Take a screenshot mid-flash.

- [ ] **Step 6: Commit**

```bash
git add public/core.js public/app.js public/pages/teams.js public/style.css
git commit -m "Deep links: scroll to and flash the section in ?at="
```

---

### Task 6: Results page

**Files:**
- Create: `public/pages/search.js`
- Modify: `public/app.js` (routes)
- Modify: `public/style.css`

- [ ] **Step 1: Write the page**

`public/pages/search.js`:

```js
// Site search results (<league>/search?q=…&type=…&in=…&exact=1): direct links, topic cards with
// a League / Team / Player / Hero picker, matching names with their tabs, and league pages.
// lib/sitesearch.js does the reading; this draws it.
import { app, esc, setTitle, setRoutedAt, SOURCES, DIVISIONS, heroHref, navigate } from "../core.js";
import { HEROES } from "../lib/heroes.js";
import { INFO } from "../lib/glossary.js";
import { fold, searchIndex } from "../lib/search.js";
import { siteSearch, sitelinks, leagueHref, withAt } from "../lib/sitesearch.js";
import { STANDINGS_TABS, tabList } from "../lib/pagetabs.js";
import { loadSearch } from "../parts/searchindex.js";

const EXAMPLES = ["radiant win rate", "first pick", "pudge ban rate", "ward map", "hero tier list"];
const TYPES = [["all", "All"], ["team", "Teams"], ["player", "Players"], ["hero", "Heroes"], ["pages", "Pages"]];
const SCOPE = { league: "League", team: "Team", player: "Player", hero: "Hero" };
const KIND = { team: "Team", player: "Player", hero: "Hero" };
const LEAGUES = [...Object.keys(DIVISIONS), "scrim"];
const rootOf = (k) => (k === "scrim" ? "#" : SOURCES[k].root);
const leagueName = (k) => (k === "scrim" ? "Scrims" : DIVISIONS[k]?.short ?? k);
const snippet = (t) => INFO[t.key] ?? t.text ?? "";
const lgChip = (e) => (e.league && e.leagueLabel ? `<span class="lg-chip" data-lg="${e.league}">${esc(e.leagueLabel)}</span>` : "");

export async function renderSearch(src) {
  const p = new URLSearchParams(location.search);
  const q = (p.get("q") ?? "").trim(), exact = p.get("exact") === "1";
  const here = src.all ? null : src.ad2l ? src.key.replace(/_[a-z]$/, "") : "scrim";
  const st = { type: p.get("type") ?? "all", league: p.get("in") ?? "all" };
  const root = src.ad2l ? src.root : "#";
  const link = (o) => `${root}/search?${new URLSearchParams(o)}`;
  setTitle(q ? `“${q}”` : "Search", "Search");
  app.innerHTML = `<header class="page-head reveal"><div class="kicker">Search</div><h1>${q ? esc(q) : "Search"}</h1></header>
    <form class="sr-form" role="search"><input id="sr-q" type="search" value="${esc(q)}" aria-label="Search the site"
      placeholder="Players, teams, heroes, stats…" autocomplete="off"><button type="submit" class="seg on">Search</button></form>
    <div id="sr-body"><div class="panel empty">Loading every league…</div></div>`;
  const form = app.querySelector(".sr-form");
  form.onsubmit = (e) => {
    e.preventDefault();
    const v = form.querySelector("#sr-q").value.trim();
    if (v) navigate(link({ q: v, ...(st.type !== "all" && { type: st.type }), ...(st.league !== "all" && { in: st.league }) }));
  };
  let index;
  try { index = await loadSearch(); }
  catch { document.getElementById("sr-body").innerHTML = `<div class="panel empty">Search couldn't load. Try again.</div>`; return; }
  const body = document.getElementById("sr-body");
  if (!body) return; // moved on while loading
  const res = siteSearch({ index, heroes: HEROES, query: q, league: here, exact, heroHref: (h) => heroHref(src, h) });
  const inLg = (e) => st.league === "all" || e.league == null || e.league === st.league;
  const keepUrl = () => {
    const u = new URL(location.href);
    for (const [k, v] of [["type", st.type], ["in", st.league]]) v === "all" ? u.searchParams.delete(k) : u.searchParams.set(k, v);
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    setRoutedAt(location.href);
  };

  // A topic card's picker for one scope.
  const pickLeague = st.league !== "all" ? st.league : here ?? LEAGUES[0];
  const picker = (t, scope) => {
    if (scope === "league") {
      const opts = LEAGUES.filter((k) => !(t.league.ad2l && k === "scrim"));
      const on = opts.includes(pickLeague) ? pickLeague : opts[0];
      return `<label class="sr-lgpick">League <select class="sr-lg">${opts.map((k) => `<option value="${k}"${k === on ? " selected" : ""}>${esc(leagueName(k))}</option>`).join("")}</select></label>
        <a class="sr-go" href="${leagueHref(rootOf(on), t.league)}">Open ${esc(t.title)} →</a>`;
    }
    return `<input type="search" class="sr-find" data-kind="${scope}" placeholder="Type a ${scope} name" aria-label="Pick a ${scope}" autocomplete="off">
      <div class="sr-opts">${options(t, scope, "")}</div>`;
  };
  const options = (t, kind, v) => {
    let list;
    if (kind === "hero") {
      const f = fold(v);
      list = (f ? HEROES.filter((h) => fold(h).includes(f)) : []).slice(0, 8).map((h) => ({ name: h, href: heroHref(src, h) }));
    } else {
      const pool = index.filter((e) => e.kind === kind && inLg(e));
      list = v.trim() ? searchIndex(pool, v, 8) : kind === "team" ? pool.filter((e) => e.league === (st.league !== "all" ? st.league : here)).slice(0, 12) : [];
    }
    if (!list.length) return `<span class="muted">${v.trim() ? "No match." : `Type a ${kind} name.`}</span>`;
    return list.map((e) => `<a class="sr-opt" href="${withAt(e.href, t[kind])}">${esc(e.name)}${e.leagueLabel ? ` <small>${esc(e.leagueLabel)}</small>` : ""}</a>`).join("");
  };
  const defaultScope = (scopes) => (scopes.includes(st.type) ? st.type : scopes.includes("team") ? "team" : scopes[0]);

  const draw = () => {
    if (!q || res.empty) {
      body.innerHTML = `<div class="panel empty sr-empty"><strong>${q ? `Nothing on the site matches “${esc(q)}”` : "Search players, teams, heroes and stats"}</strong>
        Try ${EXAMPLES.map((x) => `<a href="${link({ q: x })}">${esc(x)}</a>`).join(" · ")}</div>`;
      return;
    }
    const kindOk = (k) => st.type === "all" || st.type === k;
    const direct = res.direct.filter((d) => inLg(d.entity) && kindOk(d.entity.kind));
    const cards = st.type === "pages" ? [] : res.cards;
    const names = res.names.filter((e) => inLg(e) && kindOk(e.kind));
    const pages = st.type === "all" || st.type === "pages" ? res.pages.filter((pg) => !pg.ad2l || src.ad2l) : [];
    const did = res.corrected ? `<p class="sr-did">Showing results for <b>${esc(res.corrected)}</b>. <a href="${link({ q, exact: 1 })}">Search instead for “${esc(q)}”</a></p>` : "";
    const filters = `<div class="sr-filters">
        <div class="row segs" role="group" aria-label="Show">${TYPES.map(([id, label]) => `<button type="button" class="seg${id === st.type ? " on" : ""}" data-sr-type="${id}" aria-pressed="${id === st.type}">${label}</button>`).join("")}</div>
        <label class="sr-lgpick">In <select id="sr-in"><option value="all">All leagues</option>${LEAGUES.map((k) => `<option value="${k}"${k === st.league ? " selected" : ""}>${esc(leagueName(k))}</option>`).join("")}</select></label></div>`;
    const directHtml = direct.map((d) => `<a class="sr-hit sr-direct" href="${d.href}">
        <span class="sr-crumb">${esc(d.entity.name)} › ${esc(d.tab ?? "")} › <b>${esc(d.topic.title)}</b></span>${lgChip(d.entity)}
        <span class="sr-snip">${esc(snippet(d.topic))}</span></a>`).join("");
    const cardHtml = cards.map(({ topic: t, scopes }) => {
      const on = defaultScope(scopes);
      return `<section class="sr-card" data-topic="${t.id}">
        <h2 class="sr-title">${esc(t.title)}</h2><p class="sr-snip">${esc(snippet(t))}</p>
        <div class="row segs sr-scopes" role="group" aria-label="Where to look">${scopes.map((s) => `<button type="button" class="seg${s === on ? " on" : ""}" data-scope="${s}" aria-pressed="${s === on}">${SCOPE[s]}</button>`).join("")}</div>
        <div class="sr-pick">${picker(t, on)}</div></section>`;
    }).join("");
    const nameHtml = (e, i) => `<div class="sr-name${i >= 20 ? " sr-more" : ""}"${i >= 20 ? " hidden" : ""}>
        <a class="sr-hit" href="${e.href}"><span class="sh-kind sh-${e.kind}">${KIND[e.kind]}</span><b>${esc(e.name)}</b>
          ${e.kind === "player" && e.team ? `<span class="sr-sub">${e.standin ? "Stand-in for " : ""}${esc(e.team)}</span>` : ""}${lgChip(e)}</a>
        <div class="sr-links">${sitelinks(e).map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</div></div>`;
    const pageHtml = (pg) => {
      const tabs = pg.tabs === "standings" ? (src.ad2l ? tabList(STANDINGS_TABS, src) : []) : pg.tabs ?? [];
      return `<div class="sr-name"><a class="sr-hit" href="${leagueHref(root, { path: pg.path })}"><span class="sh-kind">Page</span><b>${esc(pg.title)}</b></a>
        ${tabs.length ? `<div class="sr-links">${tabs.map(([id, l]) => `<a href="${leagueHref(root, { path: pg.path, tab: id })}">${esc(l)}</a>`).join("")}</div>` : ""}</div>`;
    };
    const nothing = !direct.length && !cards.length && !names.length && !pages.length;
    body.innerHTML = `${did}${filters}
      ${nothing ? `<div class="panel empty">Nothing here with these filters.</div>` : ""}
      ${directHtml ? `<div class="sr-list">${directHtml}</div>` : ""}
      ${cardHtml}
      ${names.length ? `<h2>Names</h2><div class="sr-list">${names.map(nameHtml).join("")}</div>
        ${names.length > 20 ? `<button type="button" class="link-btn sr-show">Show ${names.length - 20} more</button>` : ""}` : ""}
      ${pages.length ? `<h2>Pages</h2><div class="sr-list">${pages.map(pageHtml).join("")}</div>` : ""}`;
  };
  draw();

  body.addEventListener("click", (e) => {
    const ty = e.target.closest("[data-sr-type]");
    if (ty) { st.type = ty.dataset.srType; keepUrl(); return draw(); }
    const sc = e.target.closest("[data-scope]");
    if (sc) {
      const card = sc.closest(".sr-card"), t = res.cards.find((c) => c.topic.id === card.dataset.topic).topic;
      for (const b of card.querySelectorAll("[data-scope]")) { b.classList.toggle("on", b === sc); b.setAttribute("aria-pressed", String(b === sc)); }
      card.querySelector(".sr-pick").innerHTML = picker(t, sc.dataset.scope);
      return card.querySelector(".sr-find")?.focus();
    }
    if (e.target.closest(".sr-show")) { body.querySelectorAll(".sr-more").forEach((x) => (x.hidden = false)); e.target.remove(); }
  });
  body.addEventListener("change", (e) => {
    if (e.target.id === "sr-in") { st.league = e.target.value; keepUrl(); return draw(); }
    if (e.target.classList.contains("sr-lg")) {
      const t = res.cards.find((c) => c.topic.id === e.target.closest(".sr-card").dataset.topic).topic;
      e.target.closest(".sr-pick").querySelector(".sr-go").href = leagueHref(rootOf(e.target.value), t.league);
    }
  });
  body.addEventListener("input", (e) => {
    if (!e.target.classList.contains("sr-find")) return;
    const t = res.cards.find((c) => c.topic.id === e.target.closest(".sr-card").dataset.topic).topic;
    e.target.nextElementSibling.innerHTML = options(t, e.target.dataset.kind, e.target.value);
  });
}
```

Note: `.sr-go` is a plain `<a href="#/…">`, so the existing link handler navigates it in-app.

- [ ] **Step 2: Routes in `app.js`**

Add near the other lazy pages: `const searchPage = () => import("./pages/search.js");`

In the AD2L branch of `route()`, before the final `else { section = "standings"; …`, add:

```js
    else if (h.startsWith(`${r}/search`)) { section = "search"; page = async () => (await searchPage()).renderSearch(src); }
```

In the scrim branch, before its final `else`, add:

```js
    else if (h.startsWith("#/search")) { section = "search"; page = async () => (await searchPage()).renderSearch(src); }
```

- [ ] **Step 3: Styles** — append to `public/style.css`:

```css
/* Site search results (pages/search.js). */
.sr-form { display: flex; gap: 8px; max-width: 640px; margin: 0 0 18px; }
.sr-form input { flex: 1; min-width: 0; padding: 10px 12px; background: var(--stone); color: var(--bone); border: 1px solid var(--seam-2); border-radius: 4px; font: inherit; }
.sr-did { color: var(--dust); margin: 0 0 14px; }
.sr-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin: 0 0 18px; }
.sr-lgpick { display: inline-flex; align-items: center; gap: 8px; font: 600 11px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--dust); }
.sr-list { display: grid; gap: 6px; margin: 0 0 22px; max-width: 820px; }
.sr-hit { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 10px 12px; border-left: 2px solid transparent; background: var(--stone); border-radius: 4px; color: var(--bone); }
.sr-hit:hover { text-decoration: none; border-left-color: var(--accent); background: var(--stone-2); }
.sr-crumb { font: 400 13px/1.3 var(--mono); color: var(--dust); }
.sr-crumb b { color: var(--bone); }
.sr-snip { flex-basis: 100%; color: var(--dust); font-size: 13px; line-height: 1.45; margin: 0; }
.sr-sub { color: var(--dust); font-size: 13px; }
.sr-links { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 4px 12px 2px 14px; font: 400 12px/1.4 var(--mono); }
.sr-card { max-width: 820px; padding: 14px 16px; margin: 0 0 18px; background: var(--stone); border: 1px solid var(--seam); border-radius: 6px; }
.sr-card .sr-title { margin: 0 0 6px; }
.sr-card .sr-snip { margin: 0 0 12px; }
.sr-pick { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 10px; }
.sr-find { flex: 1 1 220px; padding: 8px 10px; background: var(--ink); color: var(--bone); border: 1px solid var(--seam-2); border-radius: 4px; font: inherit; }
.sr-opts { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 6px; }
.sr-opt { padding: 5px 10px; border: 1px solid var(--seam-2); border-radius: 999px; font-size: 13px; }
.sr-opt small { color: var(--dust); }
.sr-go { font-weight: 600; }
.sr-empty a { white-space: nowrap; }
@media (max-width: 640px) { .sr-form { flex-direction: column; } .sr-hit { padding: 9px 10px; } }
```

- [ ] **Step 4: Verify in the browser**

Open each and check with `get_page_text` / `read_page`, then screenshot:
- `/#/champion/search?q=how%20often%20does%20No%20Immortals%20win%20radiant` → first result *No Immortals › Overview › Record by side*; clicking it opens the team on Overview and flashes Sides.
- `/#/champion/search?q=radiant%20win%20rate` → a *Record by side* card; Team scope lists Champion teams; picking one opens its Overview at Sides; League scope's link opens `/#/champion/heroes?tab=table` and flashes the Radiant card.
- `?q=radaint%20win%20rate` → "Showing results for radiant win rate", and the "Search instead" link gives the empty page.
- `?q=asdfgh` → empty page with the five example links.
- Type filter "Players" and league select "Warrior": the list narrows and the address gains `&type=player&in=warrior`.
- `resize_window` preset `mobile`: no sideways scroll; then preset `desktop`.
- `read_console_messages` with `onlyErrors`: none.

- [ ] **Step 5: Commit**

```bash
git add public/pages/search.js public/app.js public/style.css
git commit -m "Site search results page"
```

---

### Task 7: Header pop-up — Enter opens results

**Files:**
- Modify: `public/app.js` (`showSearch`, keydown, pop-up click)
- Modify: `public/style.css`

- [ ] **Step 1: Change `showSearch`, the keys and the close-on-pick**

Add above `showSearch`:

```js
// The results page for a query, in the league being viewed (scrims and the hub use #/search).
const resultsHref = (q) => `${navSrc?.ad2l ? navSrc.root : "#"}/search?${new URLSearchParams({ q: q.trim() })}`;
```

In `showSearch`, change `searchAt = searchHits.length ? 0 : -1;` to `searchAt = -1;`, and change the `searchPop.innerHTML = …` assignment so the "See all" row ends both branches:

```js
  const all = `<a class="search-all" href="${resultsHref(q)}">See all results for “${esc(q.trim())}” →</a>`;
  searchPop.innerHTML = (searchHits.length ? searchHits.map((r, i) => {
    const sub = r.kind === "team"
      ? (r.players.length ? esc(r.players.join(", ")) : "Team")
      : `${r.standin ? "Stand-in for " : ""}${r.team ? `<b>${esc(r.team)}</b>` : "No team"}${r.captain ? " · Captain" : ""}${r.alias ? ` · plays as ${mark(r.alias, q)}` : ""}`;
    return `<a class="search-hit" href="${r.href}" role="option" id="sh-${i}" aria-selected="false">
      <span class="sh-kind sh-${r.kind}">${r.kind === "team" ? "Team" : "Player"}</span>
      <span class="sh-main"><span class="sh-name">${mark(r.name, q)}</span><span class="sh-sub">${sub}</span></span>${lg(r)}</a>`;
  }).join("") : `<div class="search-note">No player or team matches “${esc(q.trim())}”.</div>`) + all;
```

Replace the Enter line in the keydown handler with:

```js
  else if (e.key === "Enter") {
    e.preventDefault();
    if (searchAt >= 0) searchPop.querySelectorAll(".search-hit")[searchAt]?.click();
    else if (searchIn.value.trim()) { const href = resultsHref(searchIn.value); setSearch(false); searchIn.value = ""; searchIn.blur(); navigate(href); }
  }
```

Change the pop-up close-on-pick listener to cover the new row:

```js
searchPop.addEventListener("click", (e) => { if (e.target.closest(".search-hit, .search-all")) { setSearch(false); searchIn.value = ""; searchIn.blur(); } });
```

- [ ] **Step 2: Style the row** — append to `public/style.css`:

```css
.search-all { display: block; padding: 10px 12px; border-top: 1px solid var(--seam); font: 600 12px/1.3 var(--mono); color: var(--accent); }
.search-all:hover { text-decoration: none; background: rgba(255, 255, 255, .04); }
```

- [ ] **Step 3: Verify**

In the preview on `/#/champion/`: type `radiant` → suggestions show (Radiant Ravens if present) with nothing highlighted and the "See all results" row last. Press Enter → `/#/champion/search?q=radiant`. Back, type `hex`, Arrow Down, Enter → that suggestion's page opens. Escape closes the pop-up. Screenshot the pop-up.

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/style.css
git commit -m "Header search: Enter opens the results page"
```

---

### Task 8: Catalog audit against real pages

Every catalog entry says where a section lives. Check each against the real site and fix what's wrong.

**Files:**
- Modify: `public/lib/topics.js` (only entries the audit flags)

- [ ] **Step 1: Run the audit in the preview** (`javascript_tool`, one kind per call so each stays under the tool's time limit):

```js
const { TOPICS } = await import("/lib/topics.js");
const { navigate, heroHref, SOURCES } = await import("/core.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
navigate("#/champion/players"); await wait(2500);
const player = document.querySelector('a[href*="/player/"]').getAttribute("href").split("?")[0];
const sample = { team: "#/champion/teams/15026", player, hero: heroHref(SOURCES.ad2l, "Pudge") };
const kind = "team"; // then "player", then "hero"
const miss = [];
for (const t of TOPICS) {
  const s = t[kind];
  if (!s) continue;
  navigate(`${sample[kind]}?tab=${s.tab}`); await wait(2500);
  const panel = document.querySelector(".pp-panel:not([hidden])");
  if (panel?.id !== `pp-panel-${s.tab}`) { miss.push(`${t.id}: tab ${s.tab} not open`); continue; }
  if (s.at && !panel.querySelector(`[data-info="${s.at}"], #${CSS.escape(s.at)}`)) miss.push(`${t.id}: ${s.at} not on ${s.tab}`);
}
miss
```

Then the league scopes:

```js
const { TOPICS } = await import("/lib/topics.js");
const { navigate } = await import("/core.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const miss = [];
for (const t of TOPICS.filter((x) => x.league)) {
  const L = t.league;
  navigate(`#/champion/${L.path}${L.tab ? `?tab=${L.tab}` : ""}`); await wait(2500);
  const scope = document.querySelector(".pp-panel:not([hidden])") ?? document.getElementById("app");
  if (L.at && !scope.querySelector(`[data-info="${L.at}"], #${CSS.escape(L.at)}`)) miss.push(`${t.id}: ${L.at} not on ${L.path}/${L.tab ?? ""}`);
}
miss
```

Expected: `[]` for each run. No. 15026 (No Immortals, Champion) has drafts, so draft sections should be present.

- [ ] **Step 2: Fix each miss in `topics.js`**

For each miss, find where the section really is (`grep -rn '"<key>"' public/pages public/parts public/core.js`) and move the entry's `tab`. If the section has no info button anywhere, set `at` to an id: add the id to that section's `<h2>` and to `ANCHORS`. If the page doesn't have it at all, delete that scope. Rerun the audit until it returns `[]`.

- [ ] **Step 3: Run tests and commit**

Run: `npm test` — expected: all pass.

```bash
git add public/lib/topics.js public/pages public/parts
git commit -m "Site search: catalog entries checked against the pages"
```

---

### Task 9: Docs

**Files:**
- Modify: `docs/features.md` (the `**Search**` bullet, line ~33)
- Modify: `docs/maintaining.md` (the "Where features live" line naming `search.js`)

- [ ] **Step 1: Replace the Search bullet in `features.md`** with:

```markdown
- **Search** (top bar, or press `/`) — as you type, any player or team in any league: every
  division's rosters, stand-ins seen in its games (by the team they last played for), and scrim
  players and teams, each with its league and, for players, their team and captain/stand-in
  status; in-game names find the rostered player. Arrow to a suggestion and Enter opens it;
  Enter on its own (or "See all results") opens the **results page** (`<league>/search?q=…`):
  a name plus a stat ("No Immortals radiant") links straight to that section, which flashes; a
  stat with no name ("radiant win rate") gets a card to pick a league, team, player or hero;
  names list their pages' tabs; league pages match by name. Filters: Teams / Players / Heroes /
  Pages and one league. Keyword-based with synonyms and hero shorthand ("am", "wk"); typos are
  corrected (none up to 3 letters, 1 up to 6, 2 beyond) with a "Showing results for…" line and a
  link to search the exact words. Questions it can't place get an empty page with examples.
  The words each section answers to are in `lib/topics.js`; a search that comes back empty is
  fixed by adding words there. Spec: `docs/superpowers/specs/2026-10-06-site-search-design.md`.
```

- [ ] **Step 2: In `maintaining.md`**, change `search \`search.js\`` to `search \`search.js\` (pop-up), \`sitesearch.js\` + \`topics.js\` (results page)`.

- [ ] **Step 3: Commit**

```bash
git add docs/features.md docs/maintaining.md
git commit -m "Docs: site search"
```

---

### Task 10: Final check

- [ ] **Step 1:** `npm test` — paste the summary lines; all pass.
- [ ] **Step 2:** In the preview, run the spec's browser checks once more end to end (pop-up suggests; Enter → results; arrow + Enter → suggestion; direct link flashes the section; topic-card pick lands on the right tab; empty page; phone width; no console errors). Screenshot the results page for "radiant win rate" and a flashing section.
- [ ] **Step 3:** Report to the user what passed, with the output, and anything skipped. Don't push.
