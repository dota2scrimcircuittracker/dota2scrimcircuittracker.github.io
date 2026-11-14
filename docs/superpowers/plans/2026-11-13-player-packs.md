# Player Packs for Winter Fantasy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Player card packs (5 cards, one per position) with rarity from votes, main + sub bonuses, daily packs, and a gated Winter Fantasy where you can only pick players you own a card of.

**Architecture:** Pure logic in `public/lib/` (slot assignment, bonus sizing, pack rolls, scoring), tested in `test/` with `node --test`. State that must be trusted (nominations, self-ratings, card copies, daily claims, lineups) lives in the collection Worker's vault (`workers/steam-auth/src/cosmetics.js`, a Durable Object). Fantasy entries stay in Firestore; the card equipped per pick is a vault "lineup" that scoring reads from a public endpoint.

**Tech Stack:** Vanilla ES modules, Node test runner, Cloudflare Worker + Durable Object, Firestore (entries), GitHub Pages deploy with Discord announce.

Spec: `docs/superpowers/specs/2026-11-13-player-packs-design.md`.

---

## Inputs from Fav before starting

These are not code decisions. Get them first, write them into `public/lib/winter.js` (Task 1).

1. **Winter dates:** when Winter Fantasy opens (packs go live, starter grant) and the first lock.
2. **Winter divisions:** which divisions' rosters are in the pack pool.
3. **Prep-phase launch date:** when the "coming soon" notice and the pack-card nominations ship
   (Phase 0). Votes need lead time; aim for at least 2 weeks before Winter opens.

## Phases

- **Phase 0 — Tell people and let them prepare (ships first, alone).** Nominate pack cards, pick
  main bonus stats, self-rate, a live "your pack cards" preview, the coming-soon notice, docs, and the
  Discord announcement. Nothing to open yet. Players spend the lead time designing and voting.
- **Phase 1 — Packs.** Player pool, pack rolls, copies with subs, starter grant, daily pack,
  opening and collection UI.
- **Phase 2 — Gated Fantasy.** Bonuses in scoring, lineups with ownership checks, safety net,
  lineup UI, calibration, launch announcement.

Each phase ends deployable. Pushing to `main` posts the commit's `Discord:` lines to the public
Discord after deploy. Use `[skip announce]` on every commit except the one announcement commit per
phase, and **Fav approves the Discord text before that push.**

## File structure

| File | Responsibility |
|---|---|
| `public/lib/winter.js` (new) | Winter config: dates, divisions, league key |
| `public/lib/player-cards.js` (new) | Rarity slot assignment from votes + self-rating; main positions |
| `public/lib/card-bonus.js` (new) | Budgets, bonus %, stat lists, sub roll, default main, bonus points in a game |
| `public/lib/player-packs.js` (rewrite) | Pack roll: 5 positions, step-down, copies with subs |
| `public/lib/winter-notice.js` (new) | Coming-soon notice card, once per visitor |
| `public/lib/fantasy.js` (modify) | Gated scoring with lineup cards; captain doubles base only |
| `workers/steam-auth/src/cosmetics.js` (modify) | Actions: `pack-cards`, `self-rate`, `player-pack-daily`, open `player` packs, `fantasy-equip`, `safety-card`; GET `/player-cards`, `/lineups` |
| `scripts/gen/gen-player-pool.js` (new) | Builds `public/data/player-pool.json` (account, main pos) during the Pages build |
| `public/parts/pack-cards.js` (new) | Card editor panel: nominate, main stat, self-rating, live rarity preview |
| `public/parts/collection.js` (modify) | Players tab: copies |
| `public/pages/fantasy.js` (modify) | Owned-only picker, equip, warnings, safety net |
| `scripts/calibrate-card-bonus.js` (new) | Expected bonus points per rarity from season games |
| `test/player-cards.test.js`, `test/card-bonus.test.js`, `test/player-packs.test.js` (new/rewrite), `test/fantasy.test.js`, `test/card-ratings.test.js` (extend) | Tests |

---

# Phase 0 — Tell people and let them prepare

### Task 1: Winter config

**Files:**
- Create: `public/lib/winter.js`

- [ ] **Step 1: Write the config** with Fav's inputs (dates as ISO strings, UTC).

```js
// Winter tournament Fantasy with player packs (docs/superpowers/specs/2026-11-13-player-packs-design.md).
// One Fantasy across every Winter division, stored under the league key "all".
export const WINTER = {
  league: "all",
  divisions: ["champion", "heroic", "conqueror", "warrior", "challenger", "voyager", "explorer"], // Fav confirms
  prepAt: Date.parse("2026-11-17T00:00:00Z"),  // Fav confirms: notice + nominations go live
  opensAt: Date.parse("2026-12-01T00:00:00Z"), // Fav confirms: packs, starter grant, daily packs
};
export const STARTER_PACKS = 3;
export const PACK_CARDS_MAX = 4;
export const winterOpen = (now) => now >= WINTER.opensAt;
```

- [ ] **Step 2: Commit**

```bash
git add public/lib/winter.js
git commit -m "Winter Fantasy config [skip announce]"
```

### Task 2: Rarity slot assignment

**Files:**
- Create: `public/lib/player-cards.js`
- Test: `test/player-cards.test.js`

- [ ] **Step 1: Write the failing tests** (every row of the spec's table, plus no-vote and equal-rating cases)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { assignSlots, mainPositions } from "../public/lib/player-cards.js";

const v = (...ratings) => Object.fromEntries(ratings.map((r, i) => [`voter${i}`, r]));
const d = (slot, votes, self = null, savedAt = slot) => ({ slot, votes, self, savedAt });

test("no designs: default common only", () => {
  assert.deepEqual(assignSlots([]), { common: "default", rare: null, epic: null, legendary: null });
});
test("one design voted epic: epic + default common", () => {
  assert.deepEqual(assignSlots([d(0, v("epic"))]), { common: "default", rare: null, epic: 0, legendary: null });
});
test("one design voted common: their common, no default", () => {
  assert.deepEqual(assignSlots([d(2, v("common", "common"))]), { common: 2, rare: null, epic: null, legendary: null });
});
test("two voted rare: owner's higher pick stays rare, the other drops to common", () => {
  assert.deepEqual(assignSlots([d(0, v("rare"), "rare"), d(1, v("rare"), "epic")]), { common: 0, rare: 1, epic: null, legendary: null });
});
test("two voted epic with rare and common taken: the owner's favourite goes up", () => {
  // The spec's example: A and B voted epic, owner rated A legendary -> A legendary, B epic.
  const r = assignSlots([d(0, v("epic"), "legendary"), d(1, v("epic"), "epic"), d(2, v("rare")), d(3, v("common"))]);
  assert.deepEqual(r, { common: 3, rare: 2, epic: 1, legendary: 0 });
});
test("loser moves up when nothing below is open", () => {
  const r = assignSlots([d(0, v("common"), "rare"), d(1, v("common"), "common")]);
  assert.deepEqual(r, { common: 1, rare: 0, epic: null, legendary: null });
});
test("owner's rating never lifts a design over one with a higher voted rarity", () => {
  const r = assignSlots([d(0, v("common"), "legendary"), d(1, v("epic"), "common")]);
  assert.equal(r.epic, 1); assert.equal(r.common, 0);
});
test("no votes: the owner's rating stands in; neither: common", () => {
  assert.deepEqual(assignSlots([d(0, {}, "legendary"), d(1, {}, null)]), { common: 1, rare: null, epic: null, legendary: 0 });
});
test("equal owner ratings: higher community score, then the older design", () => {
  const r = assignSlots([d(0, v("rare", "rare"), "rare", 5), d(1, v("rare", "legendary", "rare"), "rare", 9)]);
  assert.equal(r.rare, 1);
  const s = assignSlots([d(0, v("rare"), "rare", 5), d(1, v("rare"), "rare", 2)]);
  assert.equal(s.rare, 1);
});
test("four designs fill one of each", () => {
  const r = assignSlots([d(0, v("legendary")), d(1, v("legendary")), d(2, v("legendary")), d(3, v("legendary"))]);
  assert.deepEqual(Object.values(r).sort(), [0, 1, 2, 3]);
});

test("main position: the position played most, stand-in rows skipped", () => {
  const games = [1, 1, 3].map((pos, i) => ({ id: i, players: [{ account_id: 7, position: pos, standin: false }, { account_id: 8, position: 5, standin: true }] }));
  assert.deepEqual(Object.fromEntries(mainPositions(games)), { 7: 1 });
});
```

Rule the tests pin down: inside a tie, the design the owner rated higher always ends in the higher
slot, whether the extra slot the tie spills into is below or above.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/player-cards.test.js`
Expected: FAIL, `Cannot find module '../public/lib/player-cards.js'`

- [ ] **Step 3: Implement**

```js
// Player cards: which of a player's nominated designs is their common, rare, epic and legendary
// card (docs/superpowers/specs/2026-11-13-player-packs-design.md section 1.1).
// Community votes set each design's wanted rarity. Designs whose wanted rarity is uncontested take
// it. Each contest's extra designs then take the nearest open slot below, else above. Finally, inside
// each contest the slots it ended up with are handed out in the owner's order (their own rating,
// then community score, then the older design), so the owner's favourite always sits highest.
// Common left empty -> the player's default card.
import { tally, RATINGS } from "./card-ratings.js";
import { mainAccount } from "./stats.js";

const idx = (r) => RATINGS.indexOf(r);
const score = (votes) => {
  const { counts, total } = tally(votes);
  return total ? RATINGS.reduce((s, r, i) => s + counts[r] * (i + 1), 0) / total : 0;
};

// designs: [{ slot, votes, self, savedAt }] -> { common, rare, epic, legendary }: a slot number,
// "default" (common only) or null.
export function assignSlots(designs) {
  const rows = designs.map((x) => ({ ...x, want: idx(tally(x.votes).pick ?? x.self ?? "common"), selfIdx: x.self ? idx(x.self) : -1, score: score(x.votes) }));
  rows.sort((a, b) => b.want - a.want || b.selfIdx - a.selfIdx || b.score - a.score || a.savedAt - b.savedAt);
  const seat = Array(RATINGS.length).fill(null), won = new Map(), losers = [];
  for (const r of rows) {
    if (seat[r.want] == null) { seat[r.want] = r.slot; won.set(r.want, [r]); } else losers.push(r);
  }
  for (const r of losers) {
    let at = -1;
    for (let i = r.want - 1; i >= 0 && at < 0; i--) if (seat[i] == null) at = i;
    for (let i = r.want + 1; i < seat.length && at < 0; i++) if (seat[i] == null) at = i;
    if (at >= 0) { seat[at] = r.slot; won.get(r.want).push(r); }
  }
  // Inside each contest: the owner's order gets the contest's slots highest first. `won` lists
  // rows in the owner's order already (the sort above).
  for (const group of won.values()) {
    if (group.length < 2) continue;
    const slots = group.map((r) => seat.indexOf(r.slot)).sort((a, b) => b - a);
    group.forEach((r, i) => { seat[slots[i]] = r.slot; });
  }
  if (seat[0] == null) seat[0] = "default";
  return Object.fromEntries(RATINGS.map((r, i) => [r, seat[i]]));
}

// Map of account -> the position (1-5) they played most in these games, stand-ins skipped.
export function mainPositions(games) {
  const counts = new Map();
  for (const g of games) for (const p of g.players ?? []) {
    if (p.standin || p.account_id == null || !p.position) continue;
    const a = mainAccount(p), c = counts.get(a) ?? counts.set(a, {}).get(a);
    c[p.position] = (c[p.position] ?? 0) + 1;
  }
  return new Map([...counts].map(([a, c]) => [a, +Object.entries(c).sort((x, y) => y[1] - x[1] || x[0] - y[0])[0][0]]));
}
```

Check `mainAccount` returns a number for `{ account_id: 7 }` (it's used the same way in
`fantasy.js` `rosterOf`). If it returns a string, compare as strings in the test.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/player-cards.test.js`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add public/lib/player-cards.js test/player-cards.test.js
git commit -m "Player cards: rarity slots from votes and the owner's rating [skip announce]"
```

### Task 3: Bonus sizing

**Files:**
- Create: `public/lib/card-bonus.js`
- Test: `test/card-bonus.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS, bonusPct, statsFor, rollSub, defaultMain, bonusPoints } from "../public/lib/card-bonus.js";
import { WEIGHTS } from "../public/lib/tiers.js";

test("equal ceiling: pct x weight is the budget for every stat", () => {
  for (const pos of [1, 2, 3, 4, 5]) for (const stat of statsFor(pos)) {
    const ceiling = (bonusPct(pos, stat, "legendary", "main") / 100) * WEIGHTS[pos][stat];
    assert.ok(Math.abs(ceiling - BUDGETS.legendary.main) <= WEIGHTS[pos][stat] * 0.005 + 1e-9, `${pos} ${stat}`);
  }
});
test("pos 1 kill share at common is +7%, stuns +33%", () => {
  assert.equal(bonusPct(1, "kills", "common", "main"), 7);
  assert.equal(bonusPct(1, "stuns", "common", "main"), 33);
});
test("sub is 40% of main and never the main stat", () => {
  assert.equal(BUDGETS.epic.sub, BUDGETS.epic.main * 0.4);
  for (let i = 0; i < 50; i++) assert.notEqual(rollSub(1, "kills", "rare", () => i / 50).stat, "kills");
});
test("default main: random among the 3 best stats", () => {
  const scores = { gpm: 90, dmg: 80, kills: 70, xpm: 10, lane: 5 };
  const picks = new Set([0, 0.4, 0.99].map((r) => defaultMain(1, scores, "common", () => r).stat));
  assert.deepEqual([...picks].sort(), ["dmg", "gpm", "kills"]);
});
test("bonus points: stat points x pct x the game's multipliers; a stat missing at the slot adds 0", () => {
  const g = { stats: [{ metric: "kills", points: 10 }], mult: { survival: 1, consistency: 1, opponents: 1.1, winning: 1 } };
  const card = { main: { stat: "kills", pct: 20 }, sub: { stat: "vispct", pct: 50 } };
  assert.equal(bonusPoints(g, card), 2.2);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/card-bonus.test.js`
Expected: FAIL, module not found

- [ ] **Step 3: Implement**

```js
// Card bonuses (spec section 2). A bonus is "+X% points from stat S", sized so every stat has the
// same ceiling at a rarity: X% = budget / WEIGHTS[pos][stat]. Budgets are stat points; placeholders
// until scripts/calibrate-card-bonus.js is reviewed.
import { WEIGHTS } from "./tiers.js";

export const BUDGETS = {
  common: { main: 1, sub: 0.4 }, rare: { main: 1.5, sub: 0.6 }, epic: { main: 2, sub: 0.8 },
  legendary: { main: 3, sub: 1.2 }, arcana: { main: 4.5, sub: 1.8 },
};
export const statsFor = (pos) => Object.keys(WEIGHTS[pos]);
export const bonusPct = (pos, stat, rarity, kind) => Math.round((BUDGETS[rarity][kind] / WEIGHTS[pos][stat]) * 100);
const bonus = (pos, stat, rarity, kind) => ({ stat, pct: bonusPct(pos, stat, rarity, kind) });

export function rollSub(pos, mainStat, rarity, random = Math.random) {
  const pool = statsFor(pos).filter((s) => s !== mainStat);
  return bonus(pos, pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))], rarity, "sub");
}
// scores: { stat: season 0-100 at their main position }.
export function defaultMain(pos, scores, rarity, random = Math.random) {
  const best = statsFor(pos).filter((s) => scores[s] != null).sort((a, b) => scores[b] - scores[a]).slice(0, 3);
  const pool = best.length ? best : statsFor(pos).slice(0, 3);
  return bonus(pos, pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))], rarity, "main");
}
export function mainFor(pos, stat, rarity) {
  if (!statsFor(pos).includes(stat)) throw new Error("Choose a stat from that position's list.");
  return bonus(pos, stat, rarity, "main");
}
// Extra points in one game: each bonus stat's points at the slot's position x its pct, then the
// game's multipliers, the same as base stat points. `g` is gamePointsAt's result.
export function bonusPoints(g, card) {
  const m = g.mult ?? {}, k = (m.survival ?? 1) * (m.consistency ?? 1) * (m.opponents ?? 1) * (m.winning ?? 1);
  const raw = [card.main, card.sub].filter(Boolean).reduce((t, b) => t + (g.stats.find((s) => s.metric === b.stat)?.points ?? 0) * (b.pct / 100), 0);
  return Math.round(raw * k * 10) / 10;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/card-bonus.test.js`
Expected: all PASS. If the equal-ceiling test fails on rounding for a weight of 1 (pos 4 sentries),
the tolerance `weight × 0.005` covers ±0.5% rounding; don't widen it further.

- [ ] **Step 5: Commit**

```bash
git add public/lib/card-bonus.js test/card-bonus.test.js
git commit -m "Card bonuses: equal-ceiling sizing, subs, default main [skip announce]"
```

### Task 4: Worker — nominate pack cards, self-rate, fix rate slot limit

**Files:**
- Modify: `workers/steam-auth/src/cosmetics.js` (the `rate` action ~line 716; add actions beside it; add GET `/player-cards`)
- Test: `test/card-ratings.test.js`

- [ ] **Step 1: Write the failing tests** (append; reuse the vault harness in the existing
  `vault gallery` test at the top of the file)

```js
test('pack cards: nominate up to 4 with a main stat, self-rate apart from votes, rate any slot',async()=>{
  const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]))};storage.transaction=fn=>fn(storage);
  const vault=new CosmeticsVault({storage});let n=0;
  const as=async(account,body)=>(await vault.fetch(new Request(`https://vault/action?account=${account}`,{method:'POST',body:JSON.stringify({requestId:`pc-request-${String(++n).padStart(6,'0')}`,...body})}))).json();
  for(const a of [401,402])await as(a,{action:'session'});
  for(const slot of [0,1,3])await as(401,{action:'equip',equipment:{...DEFAULT_EQUIPMENT,hue:10+slot},cardSlot:slot});
  const bad=await as(401,{action:'pack-cards',cards:[{slot:0,main:'kills'},{slot:1,main:'kills'},{slot:3,main:'kills'},{slot:4,main:'kills'},{slot:2,main:'kills'}]});
  assert.match(bad.error,/up to 4/);
  const ok=await as(401,{action:'pack-cards',cards:[{slot:0,main:'kills'},{slot:3,main:'stuns'}]});
  assert.deepEqual(ok.state.packCards.map(c=>[c.slot,c.main]),[[0,'kills'],[3,'stuns']]);
  assert.match((await as(401,{action:'pack-cards',cards:[{slot:2,main:'kills'}]})).error,/no saved design/);
  await as(401,{action:'self-rate',cardSlot:3,rating:'legendary'});
  await as(402,{action:'rate',target:401,cardSlot:3,rating:'rare'}); // slot 3: past the old 0-2 limit
  const cards=await (await vault.fetch(new Request('https://vault/player-cards?account=401'))).json();
  const three=cards.designs.find(d=>d.slot===3);
  assert.equal(three.self,'legendary');assert.deepEqual(Object.values(three.votes),['rare']); // self-rating isn't a vote
  assert.equal(three.main,'stuns');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/card-ratings.test.js`
Expected: FAIL (unknown action `pack-cards`)

- [ ] **Step 3: Implement.** In the `rate` action replace the slot check:

```js
          const owner=await txn.get(`user:${target}`);
          if(!owner||!Number.isInteger(body.cardSlot)||body.cardSlot<0||body.cardSlot>=slotCount(owner))throw new Error('Choose one of their cards.');
          const design=cardDesignState(owner).cardDesigns[body.cardSlot];
```

(and remove the now-duplicate `const owner=...,design=...` line below it). Add beside `rate`:

```js
        else if(body.action==='pack-cards') {
          // Up to 4 saved designs offered as this player's pack cards, each with its main bonus stat
          // (spec 1.1, 2.3). The stat is checked against every position: a card's position comes from
          // games, so it's re-checked when the pool is built.
          const list=Array.isArray(body.cards)?body.cards:[];
          if(list.length>PACK_CARDS_MAX)throw new Error('Choose up to 4 pack cards.');
          const designs=cardDesignState(saved).cardDesigns,seen=new Set(),all=new Set([1,2,3,4,5].flatMap(statsFor));
          const packCards=list.map((c)=>{
            if(!Number.isInteger(c?.slot)||c.slot<0||c.slot>=slotCount(saved)||seen.has(c.slot))throw new Error('Choose one of your cards.');
            if(!designs[c.slot])throw new Error('That card has no saved design.');
            if(!all.has(c.main))throw new Error('Choose a bonus stat.');
            seen.add(c.slot);return {slot:c.slot,main:c.main,savedAt:(saved.packCards??[]).find(p=>p.slot===c.slot)?.savedAt??Date.now()};
          });
          result={state:{...saved,packCards}};
        }
        else if(body.action==='self-rate') {
          // The owner's own rating of one of their designs: only breaks ties in the rarity slots.
          if(!Number.isInteger(body.cardSlot)||body.cardSlot<0||body.cardSlot>=slotCount(saved))throw new Error('Choose one of your cards.');
          const design=cardDesignState(saved).cardDesigns[body.cardSlot];
          if(!design)throw new Error('That card has no saved design.');
          const rating=body.rating??null;
          if(rating!=null&&!RATINGS.includes(rating))throw new Error('Choose common, rare, epic or legendary.');
          const k=`selfrating:${account}:${designKey(design)}`;
          if(rating==null)await txn.delete(k);else await txn.put(k,rating);
          result={state:saved,selfRating:{slot:body.cardSlot,rating}};
        }
```

Add a GET route beside `/ratings` (~line 349):

```js
    // One player's nominated pack designs with votes, self-rating and main stat: what assignSlots needs.
    if(req.method==='GET' && url.pathname==='/player-cards') {
      const account=url.searchParams.get('account'),state=await this.ctx.storage.get(`user:${account}`);
      if(!state)return json({designs:[]});
      const designs=cardDesignState(state).cardDesigns;
      const out=[];
      for(const p of state.packCards??[]){const d=designs[p.slot];if(!d)continue;const key=designKey(d);
        out.push({slot:p.slot,main:p.main,savedAt:p.savedAt,votes:await this.ctx.storage.get(`votes:${account}:${key}`)??{},self:await this.ctx.storage.get(`selfrating:${account}:${key}`)??null});}
      return json({designs:out});
    }
```

Imports at the top: add `RATINGS` to the `card-ratings.js` import, `statsFor` from
`'../../../public/lib/card-bonus.js'`, `PACK_CARDS_MAX` from `'../../../public/lib/winter.js'`.
Check `txn.delete` exists on the storage transaction (grep `txn.delete(` in the file); if not, `put`
`null` and treat null as no rating. Expose the route outside the vault next to the
`/cosmetics/ratings/<account>` proxy (~line 924):

```js
  const pcAccount=/^\/cosmetics\/player-cards\/(\d{1,10})$/.exec(url.pathname)?.[1];
  if(req.method==='GET' && pcAccount) return respond(await vault.fetch(`https://vault/player-cards?account=${pcAccount}`));
```

The test harness stubs `storage.delete`? It doesn't. Add `delete:async k=>rows.delete(k)` to the
harness in the new test.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: all PASS (whole suite, since the Worker file is shared)

- [ ] **Step 5: Commit**

```bash
git add workers/steam-auth/src/cosmetics.js test/card-ratings.test.js
git commit -m "Collection: pack card nominations, self-ratings, rate any design slot [skip announce]"
```

### Task 5: Card editor panel — nominate, main stat, self-rate, live rarity preview

**Files:**
- Create: `public/parts/pack-cards.js`
- Modify: the card editor page that lists design slots (find it: `grep -rn "cardSlot" public/parts public/pages --include=*.js -l`; the slot list lives with `card-editor-workspace.js`)

- [ ] **Step 1: Build the panel.** It shows under the slot list once `Date.now() >= WINTER.prepAt`.

```js
// "Pack cards" panel in the card editor: choose up to 4 designs for Winter player packs, each with
// its bonus stat, rate your own, and see which rarity each would be right now.
import { WINTER, PACK_CARDS_MAX } from "../lib/winter.js";
import { assignSlots } from "../lib/player-cards.js";
import { statsFor, bonusPct } from "../lib/card-bonus.js";
import { METRICS } from "../lib/tiers.js";
import { RATINGS } from "../lib/card-ratings.js";

const label = (r) => r[0].toUpperCase() + r.slice(1);

// el: container. ctx: { account, pos (main position or null), designs (slot -> design|null),
//   slotName(slot), packCards, fetchCards(account) -> { designs }, act(body) -> { state, error } }
export async function renderPackCards(el, ctx) {
  if (Date.now() < WINTER.prepAt) { el.hidden = true; return; }
  const { designs } = await ctx.fetchCards(ctx.account);
  const seats = assignSlots(designs);
  const rarityOf = (slot) => RATINGS.find((r) => seats[r] === slot) ?? null;
  const chosen = new Map((ctx.packCards ?? []).map((c) => [c.slot, c.main]));
  const pos = ctx.pos;
  el.innerHTML = `<h3>Winter pack cards</h3>
    <p class="muted">Pick up to ${PACK_CARDS_MAX} of your designs for Winter player packs. Votes decide each one's rarity; your own rating breaks ties.${pos ? "" : " You'll get a position once you've played league games."}</p>
    <ul class="pack-cards">${ctx.designs.map((d, slot) => !d ? "" : `<li data-slot="${slot}">
      <label><input type="checkbox" ${chosen.has(slot) ? "checked" : ""}> ${ctx.slotName(slot)}</label>
      <select class="pc-main">${(pos ? statsFor(pos) : Object.keys(METRICS)).map((s) => `<option value="${s}" ${chosen.get(slot) === s ? "selected" : ""}>${METRICS[s]?.label ?? s}</option>`).join("")}</select>
      <select class="pc-self"><option value="">Your rating</option>${RATINGS.map((r) => `<option value="${r}" ${designs.find((x) => x.slot === slot)?.self === r ? "selected" : ""}>${label(r)}</option>`).join("")}</select>
      <span class="pc-now">${chosen.has(slot) ? `Now: ${label(rarityOf(slot) ?? "common")}${pos ? ` · +${bonusPct(pos, chosen.get(slot), rarityOf(slot) ?? "common", "main")}% ${METRICS[chosen.get(slot)]?.label}` : ""}` : ""}</span>
    </li>`).join("")}</ul>
    <p class="pc-default muted">${seats.common === "default" ? "Your common is the default card." : ""}</p>
    <p class="pc-error" role="alert"></p>`;
  const save = async () => {
    const cards = [...el.querySelectorAll("li")].filter((li) => li.querySelector("input").checked)
      .map((li) => ({ slot: +li.dataset.slot, main: li.querySelector(".pc-main").value }));
    const r = await ctx.act({ action: "pack-cards", cards });
    el.querySelector(".pc-error").textContent = r.error ?? "";
    if (!r.error) { ctx.packCards = r.state.packCards; renderPackCards(el, ctx); }
  };
  el.querySelectorAll("input, .pc-main").forEach((x) => x.addEventListener("change", save));
  el.querySelectorAll(".pc-self").forEach((x) => x.addEventListener("change", async () => {
    await ctx.act({ action: "self-rate", cardSlot: +x.closest("li").dataset.slot, rating: x.value || null });
    renderPackCards(el, ctx);
  }));
}
```

- [ ] **Step 2: Mount it** in the editor page: add `<section id="pack-cards"></section>` under the
  slot list and call `renderPackCards` with the page's existing collection state and action helper
  (the same helper the page uses for `equip`). `pos` comes from `public/data/player-pool.json`
  (Task 7) once it exists; until then pass `null` (all stats listed).

- [ ] **Step 3: Style** with existing classes; add only `.pack-cards li { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap }` to `public/style.css` (append; don't open the file).

- [ ] **Step 4: Verify in the browser.** Dev server on localhost:3000 (start it if down; never stop
  it). Temporarily set `prepAt` to the past locally. Sign in, open the card editor, nominate 2
  designs, change a stat, self-rate. Expected: the "Now:" line updates; a 5th nomination is
  impossible (4 max error); reload keeps choices.

- [ ] **Step 5: Commit**

```bash
git add public/parts/pack-cards.js public/style.css <editor page file>
git commit -m "Card editor: Winter pack cards panel [skip announce]"
```

### Task 6: Coming-soon notice

**Files:**
- Create: `public/lib/winter-notice.js` (copy the structure of `public/lib/cup-notice.js`)
- Modify: `public/app.js` (beside the `cup-notice.js` import at ~line 762)
- Test: `test/winter-notice.test.js`

- [ ] **Step 1: Failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowWinterNotice } from "../public/lib/winter-notice.js";
const W = { prepAt: 100, opensAt: 200 };
test("shows from prep until a week after opening, once", () => {
  assert.equal(shouldShowWinterNotice(99, false, W), false);
  assert.equal(shouldShowWinterNotice(150, false, W), true);
  assert.equal(shouldShowWinterNotice(150, true, W), false);
  assert.equal(shouldShowWinterNotice(200 + 7 * 864e5, false, W), false);
});
```

- [ ] **Step 2: Run** `node --test test/winter-notice.test.js` → FAIL (module missing)

- [ ] **Step 3: Implement**

```js
// Winter player packs notice: once per visitor, from the prep launch until a week after packs open.
import { WINTER } from "./winter.js";
const SEEN_KEY = "winter-packs-notice-1";
export const shouldShowWinterNotice = (now, seen, w = WINTER) => !seen && now >= w.prepAt && now < w.opensAt + 7 * 864e5;
function seen() { try { return !!localStorage.getItem(SEEN_KEY); } catch { return false; } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* not remembered */ } }

export function initWinterNotice({ go }) {
  if (!shouldShowWinterNotice(Date.now(), seen())) return;
  const open = Date.now() >= WINTER.opensAt;
  const card = document.createElement("div");
  card.className = "cup-notice"; // reuse the Arcana Cup notice styling
  card.innerHTML = `<strong>${open ? "Player packs are here" : "Coming for Winter: player packs"}</strong>
    <p>${open ? "Open your free packs and build your Winter Fantasy team." :
      "Winter Fantasy uses player cards. Pick up to 4 of your card designs as your pack cards and choose each one's bonus. Votes set their rarity."}</p>
    <div><button class="primary">${open ? "Open packs" : "Choose my pack cards"}</button> <button class="ghost">Later</button></div>`;
  const close = () => { markSeen(); card.remove(); };
  card.querySelector(".primary").onclick = () => { close(); go(open ? "#/all/cards?tab=packs" : "#/all/cards?tab=editor"); };
  card.querySelector(".ghost").onclick = close;
  document.body.append(card);
}
```

Check the two target routes against the router before committing (`grep -n "tab=" public/pages/gallery.js | head`) and use the real tab names.

- [ ] **Step 4: Mount** in `public/app.js` next to the cup notice, same `go` helper:
  `import("./lib/winter-notice.js").then((m) => m.initWinterNotice({ go: <same as cup notice> }));`

- [ ] **Step 5: Run** `npm test` → PASS. Check in the browser with `prepAt` in the past locally,
  then clear `localStorage` key `winter-packs-notice-1` to see it again.

- [ ] **Step 6: Commit**

```bash
git add public/lib/winter-notice.js public/app.js test/winter-notice.test.js
git commit -m "Winter player packs notice [skip announce]"
```

### Task 7: Player pool file

**Files:**
- Create: `scripts/gen/gen-player-pool.js`
- Modify: the Pages build so it runs (find the build entry: `grep -n "gen-" scripts/deploy/*.cjs scripts/deploy/*.js .github/workflows/pages.yml`)

- [ ] **Step 1: Write the generator**

```js
// public/data/player-pool.json: every rostered player in the Winter divisions with their main
// position, for player packs and the pack-cards panel. { updated, players: [{ account, pos, team, division }] }
import fs from "node:fs";
import { WINTER } from "../../public/lib/winter.js";
import { mainPositions } from "../../public/lib/player-cards.js";

const players = [];
for (const div of WINTER.divisions) {
  const file = new URL(`../../public/data/${div}.json`, import.meta.url);
  if (!fs.existsSync(file)) continue;
  const d = JSON.parse(fs.readFileSync(file));
  const pos = mainPositions(d.games ?? []);
  for (const t of d.teams ?? []) for (const p of t.players ?? []) {
    if (p.account_id == null || !pos.has(p.account_id)) continue;
    players.push({ account: p.account_id, pos: pos.get(p.account_id), team: t.id, division: div });
  }
}
fs.writeFileSync(new URL("../../public/data/player-pool.json", import.meta.url), JSON.stringify({ updated: new Date().toISOString(), players }));
console.log(`player-pool: ${players.length} players`);
```

- [ ] **Step 2: Run it** `node scripts/gen/gen-player-pool.js`
  Expected: `player-pool: <N> players` with N in the hundreds. Spot-check 3 known players' positions
  on their player pages.

- [ ] **Step 3: Wire into the build** where the other `gen-` scripts run, and add the file to the
  list the Pages build copies (same place as `heroic.json`).

- [ ] **Step 4: Commit**

```bash
git add scripts/gen/gen-player-pool.js public/data/player-pool.json <build file>
git commit -m "Player pool: rostered Winter players with main positions [skip announce]"
```

### Task 8: Docs and the Phase 0 announcement

**Files:**
- Modify: `docs/features.md` (add a "Player packs (Winter)" section; find placement with `grep -n "^## " docs/features.md`)

- [ ] **Step 1: Write the features.md section** describing pack cards, rarity from votes + own
  rating, bonuses, and that packs open on Winter's opening date.

- [ ] **Step 2: Deploy the Worker** (Tasks 4): `cd workers/steam-auth && npx wrangler deploy`.
  Allowed without asking per standing instruction for requested features. Paste the deploy output.

- [ ] **Step 3: Draft the announcement commit** and show Fav the exact `Discord:` lines. Draft:

```
Winter player packs: choose your pack cards now

Discord: Winter Fantasy is getting player packs. Each pack has 5 player cards, one per position, and you can only pick players you own a card of. [Fantasy](/champion/predict/?tab=fantasy)
Discord: Choose up to 4 of your card designs as your pack cards and pick each one's bonus stat. [Card editor](/all/cards?tab=editor)
Discord: Votes decide each card's rarity: common, rare, epic or legendary. Rarer cards give bigger bonuses. Your own rating breaks ties. Go rate cards. [Gallery](/all/gallery)
Discord: No designs? Your default card is your common. Packs open <date>, with 3 free packs to start and a free pack every day.
```

Check every link path exists (`node scripts/deploy/discord-updates.cjs --dry-run origin/main HEAD`).
Replace `<date>` with Fav's opening date.

- [ ] **Step 4: Fav approves the text.** Only then commit without `[skip announce]` and push to main.

```bash
git add docs/features.md
git commit -F <message file with the approved Discord lines>
```

- [ ] **Step 5: After the deploy job, verify** the notice shows on the live site in a private
  window and the Discord post went up with working links.

---

# Phase 1 — Packs

### Task 9: Pack roll

**Files:**
- Rewrite: `public/lib/player-packs.js`
- Rewrite: `test/player-packs.test.js`

- [ ] **Step 1: Failing tests**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { rollPlayerPack, addCopies } from "../public/lib/player-packs.js";

// pool: [{ account, pos, cards: { common: { main }, rare?: { main }, ... } }]
const pool = [1, 2, 3, 4, 5].flatMap((pos) => [
  { account: pos * 10, pos, cards: { common: { main: { stat: "assists", pct: 6 } } } },
  { account: pos * 10 + 1, pos, cards: { common: { main: { stat: "assists", pct: 6 } }, legendary: { main: { stat: "assists", pct: 17 } } } },
]);
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test("one card per position, in order", () => {
  const pulls = rollPlayerPack(pool, seq(0.1, 0.5, 0.5));
  assert.deepEqual(pulls.map((p) => p.pos), [1, 2, 3, 4, 5]);
});
test("a rarity no one at the position has steps down", () => {
  const pulls = rollPlayerPack(pool, seq(0.999999, 0.83, 0, 0.5), { arcana: 0 }); // 0.83 -> epic, nobody has epic
  assert.ok(pulls.every((p) => ["common", "legendary"].includes(p.rarity)));
});
test("every copy has a sub that isn't its main", () => {
  for (const p of rollPlayerPack(pool, Math.random)) { assert.ok(p.sub?.stat); assert.notEqual(p.sub.stat, p.main.stat); }
});
test("key and copies: duplicates kept apart with their own subs", () => {
  const pulls = rollPlayerPack(pool, Math.random);
  assert.match(pulls[0].key, /^player:\d+:(common|rare|epic|legendary|arcana)$/);
  let n = 0; const s1 = addCopies({}, pulls, 1000, () => `c${++n}`), s2 = addCopies(s1, pulls, 2000, () => `c${++n}`);
  assert.equal(s2.playerCards.length, 10);
  assert.equal(new Set(s2.playerCards.map((c) => c.id)).size, 10);
});
```

- [ ] **Step 2: Run** `node --test test/player-packs.test.js` → FAIL (exports missing)

- [ ] **Step 3: Implement** (replaces the whole file)

```js
// Player packs (spec section 3): five cards, one per position 1-5. Each card rolls a rarity with the
// cosmetics packs' odds (and the arcana chance), then a player at that position who has a card at
// that rarity; none -> the next rarity down. Every copy rolls its own sub bonus.
import { TIERS, PACK_ODDS } from "./cosmetics-catalog.js";
import { rollSub } from "./card-bonus.js";

const ORDER = [...TIERS, "arcana"];
const pickOne = (xs, random) => xs[Math.min(xs.length - 1, Math.floor(random() * xs.length))];

function rollRarity(random, arcana) {
  if (random() < arcana) return "arcana";
  const total = TIERS.reduce((s, t) => s + PACK_ODDS[t], 0);
  let r = random() * total;
  for (const t of TIERS) { r -= PACK_ODDS[t]; if (r < 0) return t; }
  return TIERS[0];
}

// pool: [{ account, pos, cards: { <rarity>: { main: { stat, pct } } } }]
export function rollPlayerPack(pool, random = Math.random, { arcana = 0.0025 } = {}) {
  return [1, 2, 3, 4, 5].map((pos) => {
    const here = pool.filter((p) => p.pos === pos);
    if (!here.length) throw new Error(`No players at position ${pos} yet.`);
    let i = ORDER.indexOf(rollRarity(random, arcana)), who = [];
    for (; i >= 0; i--) { who = here.filter((p) => p.cards[ORDER[i]]); if (who.length) break; }
    const rarity = ORDER[Math.max(i, 0)], p = pickOne(who.length ? who : here, random), main = p.cards[rarity]?.main ?? p.cards.common.main;
    return { key: `player:${p.account}:${rarity}`, account: p.account, pos, rarity, main, sub: rollSub(pos, main.stat, rarity, random) };
  });
}

// Copies, not counts: each pull is its own card with its own sub.
export function addCopies(state, pulls, now, newId) {
  return { ...state, playerCards: [...(state.playerCards ?? []), ...pulls.map((p) => ({ id: newId(), ...p, at: now }))] };
}
```

Check the arcana chance against `arcanaOdds` in `public/lib/pack-types.js` (grep it) and import
that instead of the 0.0025 default if it exposes a per-card normal-pack value.

- [ ] **Step 4: Run** `node --test test/player-packs.test.js` → PASS; `npm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add public/lib/player-packs.js test/player-packs.test.js
git commit -m "Player packs: five positions, step-down rarity, copies with subs [skip announce]"
```

### Task 10: Worker — build the pool, open player packs, starter grant, daily pack

**Files:**
- Modify: `workers/steam-auth/src/cosmetics.js`
- Test: `test/player-packs.test.js` (vault tests appended)

- [ ] **Step 1: Failing vault tests**

```js
import { CosmeticsVault } from "../workers/steam-auth/src/cosmetics.js";
const harness = () => {
  const rows = new Map(), storage = { get: async (k) => structuredClone(rows.get(k)), put: async (k, v) => rows.set(k, structuredClone(v)), delete: async (k) => rows.delete(k), list: async ({ prefix }) => new Map([...rows].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])) };
  storage.transaction = (fn) => fn(storage);
  return storage;
};
test("vault: starter packs once after opening, daily pack once per Eastern day, open a player pack", async () => {
  const storage = harness(); let now = Date.parse("2026-12-01T12:00:00Z"); let n = 0;
  const poolPlayers = [1, 2, 3, 4, 5].map((pos) => ({ account: 900 + pos, pos }));
  const vault = new CosmeticsVault({ storage }, { now: () => now, playerPool: async () => poolPlayers, winter: { opensAt: Date.parse("2026-12-01T00:00:00Z") } });
  const as = async (account, body) => (await vault.fetch(new Request(`https://vault/action?account=${account}`, { method: "POST", body: JSON.stringify({ requestId: `pp-request-${String(++n).padStart(6, "0")}`, ...body }) }))).json();
  let s = (await as(501, { action: "session" })).state;
  assert.equal(s.packs.filter((p) => p === "player").length, 3);
  s = (await as(501, { action: "session" })).state;
  assert.equal(s.packs.filter((p) => p === "player").length, 3); // not granted twice
  assert.equal((await as(501, { action: "player-pack-daily" })).state.packs.filter((p) => p === "player").length, 4);
  assert.match((await as(501, { action: "player-pack-daily" })).error, /already/);
  now = Date.parse("2026-12-02T04:59:00Z"); // still Dec 1 in New York
  assert.match((await as(501, { action: "player-pack-daily" })).error, /already/);
  now = Date.parse("2026-12-02T05:01:00Z");
  assert.ok(!(await as(501, { action: "player-pack-daily" })).error);
  const packIndex = s.packs.indexOf("player");
  const opened = await as(501, { action: "open", packIndex });
  assert.equal(opened.state.playerCards.length, 5);
  assert.deepEqual(opened.result?.pulls?.map((p) => p.pos) ?? opened.pulls.map((p) => p.pos), [1, 2, 3, 4, 5]);
});
```

Adjust the constructor's injection to however the vault already takes a clock (grep `this.now=` in
`cosmetics.js`; the cup code uses `this.now()`), and match the `open` response shape the existing
cosmetics `open` returns.

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

  a. **Pool loader** (vault method): fetch `https://<site>/data/player-pool.json` (cache 10 min
  in memory), then for each player read their `/player-cards` data (the same code as the GET route
  in Task 4, factored into `async packDesigns(account)`), run `assignSlots`, and build
  `cards[rarity] = { main: mainFor(pos, design.main, rarity) }` for each filled slot. For
  `"default"` or a nominated main stat not on the player's position list, use
  `defaultMain(pos, scores, rarity)` where `scores` is stored once per player under
  `defaultmain:<account>` (rolled on first use from the season stat scores in the pool file; if the
  pool has none, roll from `statsFor(pos)`). Arcana players: `arcana:<account>` vault key set by
  Fav's existing gift action with `{ main }`; add `cards.arcana`. Inject `playerPool` for tests.

  b. **Starter grant** in `session`: if `now >= winter.opensAt && !saved.winterStarter`, append
  `STARTER_PACKS` × `'player'` to `packs` and set `winterStarter: now`.

  c. **Daily pack** action:

```js
        else if(body.action==='player-pack-daily') {
          if(this.now()<this.winter.opensAt)throw new Error('Player packs open soon.');
          const day=new Date(this.now()).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
          if(saved.dailyPlayerPack===day)throw new Error("You've already claimed today's pack.");
          result={state:{...saved,packs:[...(saved.packs??[]),'player'],dailyPlayerPack:day}};
        }
```

  d. **Open** branch: in the existing `open` action, before the cosmetics roll, if
  `saved.packs[body.packIndex]==='player'`: `pulls=rollPlayerPack(await this.poolCards(),random)`,
  remove the pack, `state=addCopies(state,pulls,now,()=>crypto.randomUUID())`, return
  `{state,pulls}`. Keep the receipt write that already follows every action.

- [ ] **Step 4: Run** `npm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add workers/steam-auth/src/cosmetics.js test/player-packs.test.js
git commit -m "Collection: player packs, starter grant, daily pack [skip announce]"
```

### Task 11: Pack opening and the Players tab

**Files:**
- Modify: `public/parts/collection.js` (Players tab), the pack-opening code it calls (find: `grep -n "action:'open'\|action: \"open\"" public/parts/*.js`)

- [ ] **Step 1: Opening.** When the opened pack is `'player'`, render the 5 pulls with the existing
  pack reveal, each card face showing: player name (from the pool file + roster names), position,
  rarity, `+X% <stat>` main, `+Y% <stat>` sub. Use the player's design for that rarity
  (`/cosmetics/player-cards/<account>` + `cardAppearance`), or the default card.

- [ ] **Step 2: Daily button.** In the packs area: "Claim today's pack" calling
  `player-pack-daily`; hidden before `WINTER.opensAt`; shows "Come back tomorrow" after claiming.

- [ ] **Step 3: Players tab.** List `state.playerCards` grouped by position, filter chips for
  rarity and "live teams only" (team still in Winter: from the division data's bracket), each row
  showing main and sub.

- [ ] **Step 4: Verify** on localhost:3000 with `opensAt` set in the past locally: starter packs
  appear, open one (5 cards, one per position), claim daily, Players tab lists 5 copies.

- [ ] **Step 5: Commit**

```bash
git add public/parts/collection.js <pack opening file>
git commit -m "Collection: open player packs, daily pack, Players tab [skip announce]"
```

---

# Phase 2 — Gated Fantasy

### Task 12: Scoring with cards

**Files:**
- Modify: `public/lib/fantasy.js` (`pickPoints`, `scoreEntry`, `weekBoard`, `leaderboard`)
- Test: `test/fantasy.test.js`

- [ ] **Step 1: Failing tests** (append; reuse the file's `teams`/`series` fixtures and a real week
  from `ad2l.json` the way the existing scoring tests do)

```js
import { bonusPoints } from "../public/lib/card-bonus.js";
test("gated week: a pick scores only with a lineup card of that player, saved before the lock", () => {
  const week = { key: "w", lock: 1000, gated: true, eligible: null, series: [], teams: new Set() };
  const entry = { picks: [1, 2, 3, 4, 5], updatedAt: 500_000, captain: null };
  const lineup = { at: 900, cards: [1, 2, 3, 4, 5].map((a) => ({ account: a, main: { stat: "kills", pct: 10 }, sub: { stat: "gpm", pct: 5 } })) };
  const none = scoreEntry(entry, week, [], null);
  assert.ok(none.picks.every((p) => p.points === 0 && p.card === null));
  const late = scoreEntry(entry, week, [], { ...lineup, at: 1000 });
  assert.ok(late.picks.every((p) => p.card === null));
  const ok = scoreEntry(entry, week, [], lineup);
  assert.ok(ok.picks.every((p) => p.card));
});
test("ungated weeks score exactly as before", () => {
  const week = { key: "w", lock: 1000, series: [], teams: new Set() };
  const e = { picks: [1, 2, 3, 4, 5], updatedAt: 500_000 };
  assert.deepEqual(scoreEntry(e, week, []), scoreEntry(e, week, [], null));
});
```

Add a captain test with real games once Step 3 is in: take a player with a counted game in
`ad2l.json` (as the existing `pickPoints` tests do), give them a lineup card, make them captain, and
assert `pick.points === Math.round((pick.basePoints * 2 + pick.bonus) * 10) / 10` with `pick.bonus > 0`.

- [ ] **Step 2: Run** `node --test test/fantasy.test.js` → FAIL

- [ ] **Step 3: Implement.** In `pickPoints`, accept `card = null` and add per game
  `bonus: card ? bonusPoints(g, card) : 0` to each scored row (choose counted games by `score`, as
  now — the bonus doesn't change which games count). Return `{ points, bonus, games }` where
  `bonus` sums counted games' bonuses. In `scoreEntry(entry, week, matches, lineup = null)`:

```js
  const validLineup = lineup && Number.isFinite(lineup.at) && lineup.at < week.lock ? lineup : null;
  const picks = entry.picks.map((account, i) => {
    const card = week.gated ? (validLineup?.cards?.[i]?.account === account ? validLineup.cards[i] : null) : null;
    const result = pickPoints(account, SLOTS[i], games, matches, card), captain = account === entry.captain;
    const allowed = !week.gated || card;
    const points = allowed ? round1(result.points * (captain ? 2 : 1) + (result.bonus ?? 0)) : 0;
    return { account, pos: SLOTS[i], ...result, captain, card, basePoints: result.points, points };
  });
```

  Thread `lineups` (Map of account → lineup) through `weekBoard(entries, week, matches, lineups)`
  and `leaderboard(..., lineupsByWeek)`; default to no lineups so existing callers are unchanged.
  Set `gated: true` on Winter weeks where `playoffWeeks`/the Winter week builder makes them
  (`week.key >= weekKey(WINTER.opensAt / 1000)` and `league === WINTER.league`).

- [ ] **Step 4: Run** `npm test` → PASS (all existing fantasy tests unchanged)

- [ ] **Step 5: Commit**

```bash
git add public/lib/fantasy.js test/fantasy.test.js
git commit -m "Fantasy: card bonuses and the Winter gate in scoring [skip announce]"
```

### Task 13: Worker — lineups and the safety net

**Files:**
- Modify: `workers/steam-auth/src/cosmetics.js`
- Test: `test/fantasy.test.js` (vault test appended)

- [ ] **Step 1: Failing vault test**

```js
test("vault: equip a lineup only with owned copies, one copy per slot; lineups are public", async () => {
  const storage = harness(); let n = 0; const now = Date.parse("2026-12-03T12:00:00Z");
  const poolPlayers = [1, 2, 3, 4, 5].map((pos) => ({ account: 900 + pos, pos }));
  const vault = new CosmeticsVault({ storage }, { now: () => now, playerPool: async () => poolPlayers, winter: { opensAt: Date.parse("2026-12-01T00:00:00Z") } });
  const as = async (account, body) => (await vault.fetch(new Request(`https://vault/action?account=${account}`, { method: "POST", body: JSON.stringify({ requestId: `fe-request-${String(++n).padStart(6, "0")}`, ...body }) }))).json();
  let s = (await as(601, { action: "session" })).state;
  s = (await as(601, { action: "open", packIndex: s.packs.indexOf("player") })).state;
  const ids = s.playerCards.map((c) => c.id);
  assert.match((await as(601, { action: "fantasy-equip", week: "2026-12-01", cards: [...ids.slice(0, 4), "not-mine"] })).error, /own/);
  assert.match((await as(601, { action: "fantasy-equip", week: "2026-12-01", cards: [...ids.slice(0, 4), ids[0]] })).error, /once/);
  assert.ok(!(await as(601, { action: "fantasy-equip", week: "2026-12-01", cards: ids })).error);
  const pub = await (await vault.fetch(new Request("https://vault/lineups?league=all&week=2026-12-01"))).json();
  assert.equal(pub.lineups["601"].cards.length, 5); assert.equal(pub.lineups["601"].at, now);
  // safety card: account 602 owns nothing; pos 3 live player 903
  await as(602, { action: "session" });
  const safe = await as(602, { action: "safety-card", week: "2026-12-01", pos: 3, liveAccounts: [903] });
  assert.equal(safe.pulls[0].account, 903); assert.equal(safe.pulls[0].rarity, "common");
  assert.match((await as(602, { action: "safety-card", week: "2026-12-01", pos: 3, liveAccounts: [903] })).error, /already/);
});
```

The pool stub has no designs, so every player has only a default common; the loader in Task 10a must
handle that (roll `defaultMain` from `statsFor(pos)`).


- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
        else if(body.action==='fantasy-equip') {
          // The card behind each Fantasy pick this week (spec 4). Copies must be yours, each used once;
          // `at` is the vault's clock, and scoring ignores a lineup saved at or after the week's lock.
          const week=String(body.week??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(week))throw new Error('Choose a week.');
          const ids=Array.isArray(body.cards)?body.cards:[];if(ids.length!==5)throw new Error('Choose a card for every position.');
          if(new Set(ids).size!==5)throw new Error('Each card can be used once a week.');
          const mine=new Map((saved.playerCards??[]).map(c=>[c.id,c]));
          const cards=ids.map(id=>{const c=mine.get(id);if(!c)throw new Error("You don't own that card.");return {id:c.id,account:c.account,rarity:c.rarity,main:c.main,sub:c.sub};});
          await txn.put(`lineup:${WINTER.league}:${week}:${account}`,{at:this.now(),cards});
          result={state:saved,lineup:{week,cards}};
        }
        else if(body.action==='safety-card') {
          // A free default common of a random live player at a position you can't fill, once per
          // position per week.
          const week=String(body.week??''),pos=body.pos;
          if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||![1,2,3,4,5].includes(pos))throw new Error('Choose a position.');
          const live=new Set((body.liveAccounts??[]).map(Number)); // checked against the pool below
          const pool=(await this.poolCards()).filter(p=>p.pos===pos&&live.has(p.account));
          if(!pool.length)throw new Error('No live players at that position.');
          if((saved.playerCards??[]).some(c=>c.pos===pos&&live.has(c.account)))throw new Error('You already have a card for that position.');
          const k=`${week}:${pos}`;if((saved.safetyCards??[]).includes(k))throw new Error("You've already had this week's free card for that position.");
          const p=pool[Math.floor(Math.random()*pool.length)],main=p.cards.common.main;
          const pull={key:`player:${p.account}:common`,account:p.account,pos,rarity:'common',main,sub:rollSub(pos,main.stat,'common')};
          result={state:{...addCopies(saved,[pull],this.now(),()=>crypto.randomUUID()),safetyCards:[...(saved.safetyCards??[]),k]},pulls:[pull]};
        }
```

`liveAccounts` from the browser is only a filter hint: the Worker intersects it with the pool and
the gain is one common card, so a forged list can't do more than pick which common you get. Note
this in the code comment.

Public route (vault + outer proxy, like `/player-cards`):

```js
    if(req.method==='GET' && url.pathname==='/lineups') {
      const league=url.searchParams.get('league'),week=url.searchParams.get('week'),out={};
      for(const [k,v] of await this.ctx.storage.list({prefix:`lineup:${league}:${week}:`}))out[k.split(':').pop()]=v;
      return json({lineups:out});
    }
```

- [ ] **Step 4: Run** `npm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add workers/steam-auth/src/cosmetics.js test/fantasy.test.js
git commit -m "Collection: Fantasy lineups with owned cards, weekly safety card [skip announce]"
```

### Task 14: Fantasy page — owned-only picker

**Files:**
- Modify: `public/pages/fantasy.js`

- [ ] **Step 1:** On Winter weeks (`week.gated`), load the signed-in player's collection
  (`state.playerCards`) and filter each slot's choices to players they own a copy of. Each slot gets
  a copy dropdown (rarity, main, sub; best rarity first). Show the warning when the main or sub stat
  isn't in `statsFor(slot)`: "This bonus adds nothing at position N."

- [ ] **Step 2:** Saving writes the Firestore entry as now **and** calls `fantasy-equip` with the
  5 copy ids. Show an error if either fails; the entry without a lineup scores 0 on gated weeks, so
  say so plainly.

- [ ] **Step 3:** Empty position: show "Get a free card" calling `safety-card` with the live
  accounts at that position.

- [ ] **Step 4:** Boards: fetch `/cosmetics/lineups?league=all&week=<key>` and pass to `weekBoard`
  / `leaderboard`. Pick rows show the card's rarity and `+bonus`.

- [ ] **Step 5: Verify** on localhost:3000 with a gated test week: own 5 copies, save a lineup,
  board shows card bonuses; remove a copy from the picker → can't save; captain shows ×2 on base
  only.

- [ ] **Step 6: Commit**

```bash
git add public/pages/fantasy.js
git commit -m "Fantasy: Winter picks from your player cards [skip announce]"
```

### Task 15: Calibration

**Files:**
- Create: `scripts/calibrate-card-bonus.js`

- [ ] **Step 1: Write it**: for each Winter division's games, for each position and stat, average
  the `points` that stat earned per game (`gamePointsAt` stats) over players at their main
  position; then print per rarity the expected main bonus points `= BUDGETS[r].main × avgScore/100`
  per stat, min/median/max across stats.

```js
import fs from "node:fs";
import { tierModels, gamePointsAt } from "../public/lib/tiers.js";
import { WINTER } from "../public/lib/winter.js";
import { BUDGETS, statsFor } from "../public/lib/card-bonus.js";
import { mainPositions } from "../public/lib/player-cards.js";

for (const div of WINTER.divisions) {
  const d = JSON.parse(fs.readFileSync(new URL(`../public/data/${div}.json`, import.meta.url)));
  const games = d.games ?? [], models = tierModels(games), main = mainPositions(games), sums = {};
  for (const g of games) for (const p of g.players ?? []) {
    const pos = main.get(p.account_id); if (!pos) continue;
    const r = gamePointsAt(g, games, p.player_key ?? p.account_id, pos, models); if (!r) continue;
    for (const s of r.stats) { const k = `${pos}:${s.metric}`; (sums[k] ??= []).push(s.score ?? 0); }
  }
  console.log(`\n${div}`);
  for (const pos of [1, 2, 3, 4, 5]) {
    const avg = Object.fromEntries(statsFor(pos).map((s) => { const xs = sums[`${pos}:${s}`] ?? []; return [s, xs.length ? xs.reduce((a, b) => a + b) / xs.length : 0]; }));
    for (const r of Object.keys(BUDGETS)) {
      const gains = statsFor(pos).map((s) => BUDGETS[r].main * avg[s] / 100).sort((a, b) => a - b);
      console.log(`pos ${pos} ${r.padEnd(9)} expected main bonus: min ${gains[0].toFixed(2)} median ${gains[gains.length >> 1].toFixed(2)} max ${gains.at(-1).toFixed(2)} pts/game`);
    }
  }
}
```

Check `tierModels`'s signature (`grep -n "export function tierModels" public/lib/tiers.js`) and pass
what it needs.

- [ ] **Step 2: Run** `node scripts/calibrate-card-bonus.js` and paste the output for Fav. Compare a
  legendary's median gain to a typical game score (the fantasy board's per-game numbers). Fav picks
  final budgets; update `BUDGETS` and the spec.

- [ ] **Step 3: Commit**

```bash
git add scripts/calibrate-card-bonus.js public/lib/card-bonus.js
git commit -m "Card bonus calibration script and final budgets [skip announce]"
```

### Task 16: Launch

- [ ] **Step 1:** Deploy the Worker (`cd workers/steam-auth && npx wrangler deploy`), paste output.
- [ ] **Step 2:** `npm test` → PASS, paste the summary line.
- [ ] **Step 3:** Draft the launch commit's `Discord:` lines (packs are open, 3 free packs, a free
  pack a day, how the gate works, links to collection and Fantasy). Fav approves, then push.
- [ ] **Step 4:** After deploy: in a private window, sign in, see 3 starter packs, open one, claim the
  daily, save a Winter lineup, confirm it on the board.
- [ ] **Step 5:** Update `docs/features.md` and memory (token-shop-style note that player packs are live).
