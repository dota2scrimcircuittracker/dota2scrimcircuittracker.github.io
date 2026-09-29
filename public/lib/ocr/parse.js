import { loadImage, findWords } from "./core.js";
import { readOverview } from "./overview.js";
import { readScoreboard, isScoreboard } from "./scoreboard.js";
import { trimBright, locateCards, cropImage } from "./locate.js";
import { matchHero } from "../heroes.js";

// How much of a screen was read: players with their core numbers (the scoreboard's hero and
// GPM/XPM, the overview's K/D/A and net worth). -1 for an error.
const GOOD = 8;
// Version 2 must read at least this many players to be used at all, so a stray pattern in
// a screenshot that isn't Dota can't replace version 1's error with a mostly empty reading.
const ENOUGH = 5;
export const quality = (kind, r) => (!r || r.error ? -1 : r.players.filter(kind === "scoreboard"
  ? (p) => matchHero(p.heroRaw ?? "") && (p.gpm != null || p.xpm != null)
  : (p) => p.kda && p.net_worth != null).length);

// Version 2, for a screenshot version 1 couldn't read well: cut away bright windows beside
// the game (locate.js), find the hero cards or scoreboard headers anywhere in what's left,
// crop to the framing version 1 expects and read that crop with version 1. `kinds`: which
// screens to try. Returns the best reading, or null.
async function readWider(engine, image, kinds) {
  const trim = trimBright(image);
  const base = trim ? cropImage(image, trim) : image;
  let best = null;
  const keep = (kind, r) => { const q = quality(kind, r); if (q > (best?.q ?? -1)) best = { kind, r, q }; };
  if (kinds.includes("overview")) {
    const loc = locateCards(base);
    if (loc) keep("overview", await readOverview(engine, cropImage(base, loc.rect)));
  }
  if (kinds.includes("scoreboard") && (best?.q ?? -1) < GOOD) {
    const words = await findWords(engine, base);
    if (isScoreboard(words)) keep("scoreboard", await readScoreboard(engine, base, words));
  }
  return best;
}

// Parse 1–2 post-game screenshots into a draft match (the review form's shape) plus
// notes about anything that couldn't be read. `inputs` are whatever engine.decode accepts.
export async function parseScreenshots(engine, inputs, { onProgress } = {}) {
  let overview = null, scoreboard = null;
  const notes = [];

  for (const [i, input] of inputs.entries()) {
    onProgress?.(`Reading screenshot ${i + 1} of ${inputs.length}…`);
    const image = await loadImage(engine, input);
    const words = await findWords(engine, image);
    // Version 2 (readWider) only runs when version 1 below fails or reads under GOOD players,
    // and only replaces version 1's reading when it reads more.
    const wider = async (kinds) => {
      onProgress?.(`Screenshot ${i + 1}: looking for the game in a wider screenshot…`);
      return readWider(engine, image, kinds.filter((k) => (k === "scoreboard" ? !scoreboard : !overview)));
    };
    const use = (w) => { if (w.kind === "scoreboard") scoreboard = w.r; else overview = w.r; };
    if (isScoreboard(words)) {
      if (scoreboard) {
        // Maybe an overview with scoreboard words beside it (this site open in another window).
        const w = !overview && await wider(["overview"]);
        if (w?.q >= GOOD) use(w); else notes.push(`Screenshot ${i + 1} is a second Scoreboard tab — ignored.`);
        continue;
      }
      const r = await readScoreboard(engine, image, words);
      const q = quality("scoreboard", r);
      const w = q < GOOD ? await wider(["scoreboard", "overview"]) : null;
      if (w && w.q > q && w.q >= ENOUGH) use(w);
      else if (r.error) notes.push(`Screenshot ${i + 1}: ${r.error}`); else scoreboard = r;
    } else {
      if (overview) {
        const w = !scoreboard && await wider(["scoreboard"]);
        if (w?.q >= GOOD) use(w); else notes.push(`Screenshot ${i + 1} looks like a second overview — ignored.`);
        continue;
      }
      const r = await readOverview(engine, image);
      const q = quality("overview", r);
      const w = q < GOOD ? await wider(["overview", "scoreboard"]) : null;
      if (w && w.q > q && w.q >= ENOUGH) use(w);
      else if (r.error) notes.push(`Screenshot ${i + 1}: ${r.error} Use the post-game overview (hero cards) or the Scoreboard tab.`);
      else overview = r;
    }
  }
  if (!overview) notes.push("Missing the overview screenshot: K/D/A, net worth, score and duration need filling in.");
  if (!scoreboard) notes.push("Missing the Scoreboard tab screenshot: names, heroes, LH/DN, GPM/XPM, heal and hero damage need filling in.");

  // Line overview cards up with scoreboard rows, per team: a scoreboard name found in exactly
  // one card's (noisy) name text pins that card; unpinned cards keep their order.
  const key = (t) => (t ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const order = [...Array(10).keys()];
  if (overview && scoreboard) for (const base of [0, 5]) {
    const cards = [0, 1, 2, 3, 4].map((j) => key(overview.players[base + j]?.nameRaw));
    const slot = [0, 1, 2, 3, 4].map((j) => {
      const n = key(scoreboard.players[base + j]?.name);
      const hits = n.length >= 3 ? cards.flatMap((c, ci) => (c.includes(n) ? [ci] : [])) : [];
      return hits.length === 1 ? hits[0] : null;
    });
    if (new Set(slot.filter((x) => x != null)).size !== slot.filter((x) => x != null).length) continue;
    const free = [0, 1, 2, 3, 4].filter((ci) => !slot.includes(ci));
    slot.forEach((ci, j) => { order[base + j] = base + (ci ?? free.shift()); });
  }

  const pick = (...vals) => vals.find((v) => v != null && v !== "") ?? null;
  const players = [];
  for (let i = 0; i < 10; i++) {
    const s = scoreboard?.players[i] ?? {};
    const o = overview?.players[order[i]] ?? {};
    const hero = s.heroRaw ? matchHero(s.heroRaw) : null;
    if (s.heroRaw && !hero) notes.push(`Row ${i + 1}: couldn't match hero text "${s.heroRaw}".`);
    players.push({
      team: i < 5 ? "a" : "b",
      name: s.name ?? "",
      tag: s.tag ?? null,
      hero: hero ?? "",
      level: s.level ?? null,
      kills: o.kda?.[0] ?? null, deaths: o.kda?.[1] ?? null, assists: o.kda?.[2] ?? null,
      net_worth: o.net_worth ?? null,
      last_hits: s.last_hits ?? null, denies: s.denies ?? null,
      gpm: s.gpm ?? null, xpm: s.xpm ?? null,
      hero_damage: s.hero_damage ?? null, hero_healing: s.hero_healing ?? null,
      pick: s.pick ?? null,
    });
  }

  const match = {
    team_a: pick(scoreboard?.team_a, overview?.team_a) ?? "",
    team_b: pick(scoreboard?.team_b, overview?.team_b) ?? "",
    score_a: pick(overview?.score_a, scoreboard?.score_a),
    score_b: pick(overview?.score_b, scoreboard?.score_b),
    winner: pick(overview?.winner, scoreboard?.winner),
    duration: overview?.duration ?? "",
    game_mode: overview?.game_mode ?? "",
    players,
  };
  return { match, notes };
}
