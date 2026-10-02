// Measure the draft model (lib/cmdraft.js, Sybil's) against the Predict page's team ratings
// (lib/predict.js) on every played, drafted AD2L game this season, before deciding whether the
// predictions should use it. Each game is read only from what was known before it: the ratings
// from series results before its league night, the draft model from each player's games before
// the game started.
//   node scripts/measure/draft-model.js
import { readFileSync, existsSync } from "node:fs";
import { DIVISIONS } from "../../public/lib/divisions.js";
import { fitRatings, MODEL_PARAMS, ODDS_SPREAD, isPlayed } from "../../public/lib/predict.js";
import { gameContext, readDraft } from "../../public/lib/cmdraft.js";

const sig = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));
const rows = [];
for (const { key } of DIVISIONS) {
  const base = `public/data/${key}.json`, draftFile = base.replace(/\.json$/, "-draft.json");
  if (!existsSync(base) || !existsSync(draftFile)) { console.log(`skip ${key}: no data`); continue; }
  const d = JSON.parse(readFileSync(base, "utf8")), data = JSON.parse(readFileSync(draftFile, "utf8"));
  const byName = new Map(Object.entries(data.heroes).map(([id, n]) => [n, Number(id)]));
  const ids = [...byName.values()];
  const seriesById = new Map(d.series.map((s) => [s.id, s]));
  const ratingsAt = new Map();
  for (const g of d.games) {
    if (!g.draft?.some((x) => x.pick) || g.players?.length !== 10 || !g.winner) continue;
    const s = seriesById.get(g.series_id);
    if (!s?.time) continue;
    // Ratings as the Predict page had them that night.
    if (!ratingsAt.has(s.time)) ratingsAt.set(s.time, fitRatings(d.teams, d.series.filter(isPlayed), { ...MODEL_PARAMS, before: s.time }));
    const r = ratingsAt.get(s.time);
    const diff = (r.get(g.team_a_id) ?? 0) - (r.get(g.team_b_id) ?? 0);
    // Draft model: the ten players as of the game's start, side a = Radiant.
    const side = (t) => g.players.filter((p) => p.team === t).map((p) => ({ key: p.player_key, rank_tier: p.rank_tier }));
    const ctx = gameContext(data, { radiant: side("a"), dire: side("b") }, g.start_time);
    const steps = [...g.draft].sort((x, y) => x.order - y.order).map((x) => ({ side: x.side === "a" ? "radiant" : "dire", pick: x.pick, hero: byName.get(x.hero) })).filter((x) => x.hero != null);
    const read = readDraft(ctx, steps, ids, { alternatives: 0 });
    rows.push({ div: key, t: g.start_time, y: g.winner === "a" ? 1 : 0, ratings: sig(diff), shown: sig(ODDS_SPREAD * diff), pre: read.start, post: read.steps.at(-1).p });
  }
}

// Sybil's weights were fitted on 2026-09-19 with S48 games in them: only games after that are
// out of sample for the draft model. `--after-fit` scores those alone.
import { FIT } from "../../public/lib/cmdraft.js";
if (process.argv.includes("--after-fit")) {
  const cut = Date.parse(`${FIT.fitted}T23:59:59Z`) / 1000;
  rows.splice(0, rows.length, ...rows.filter((r) => r.t > cut));
  console.log(`games after the fit (${FIT.fitted}) only`);
}
const score = (f) => {
  let ll = 0, br = 0, acc = 0;
  for (const r of rows) {
    const p = Math.min(0.99, Math.max(0.01, f(r)));
    ll -= r.y ? Math.log(p) : Math.log(1 - p);
    br += (p - r.y) ** 2;
    acc += (p >= 0.5) === (r.y === 1) ? 1 : 0;
  }
  return { acc: acc / rows.length, logLoss: ll / rows.length, brier: br / rows.length };
};
// Equal-weight blends in log-odds: no fitting, so nothing here is tuned on the games it scores.
const models = {
  "coin flip": () => 0.5,
  "ratings (Predict page)": (r) => r.ratings,
  "ratings, as shown (stretched)": (r) => r.shown,
  "draft model, before the draft": (r) => r.pre,
  "draft model, after the draft": (r) => r.post,
  "blend: ratings + before the draft": (r) => sig((logit(r.ratings) + logit(r.pre)) / 2),
  "blend: ratings + after the draft": (r) => sig((logit(r.ratings) + logit(r.post)) / 2),
};
console.log(`\n${rows.length} played, drafted games across ${new Set(rows.map((r) => r.div)).size} divisions\n`);
console.log("model".padEnd(36), "accuracy", " log loss", "  Brier");
for (const [name, f] of Object.entries(models)) {
  const s = score(f);
  console.log(name.padEnd(36), `${(s.acc * 100).toFixed(1)}%`.padStart(8), s.logLoss.toFixed(4).padStart(9), s.brier.toFixed(4).padStart(8));
}
// Bootstrap: how often does the draft model beat the ratings on log loss?
const pick = () => rows[Math.floor(Math.random() * rows.length)];
const ll = (p, y) => -(y ? Math.log(Math.min(0.99, Math.max(0.01, p))) : Math.log(1 - Math.min(0.99, Math.max(0.01, p))));
for (const [label, f] of [["before the draft", (r) => r.pre], ["after the draft", (r) => r.post]]) {
  const diffs = [];
  for (let b = 0; b < 2000; b++) {
    let d = 0;
    for (let i = 0; i < rows.length; i++) { const r = pick(); d += ll(f(r), r.y) - ll(r.ratings, r.y); }
    diffs.push(d / rows.length);
  }
  diffs.sort((a, b) => a - b);
  console.log(`log loss, draft model ${label} minus ratings: ${(diffs[1000]).toFixed(4)} [${diffs[50].toFixed(4)}, ${diffs[1950].toFixed(4)}] (negative = draft model better)`);
}
