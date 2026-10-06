// Draft (AD2L Captains Mode): draft-slot and phase tables for player and hero pages.
import { playerKey, hasDetails } from "../lib/stats.js";
import { info } from "../lib/glossary.js";
import { verdict } from "../lib/lanes.js";
import { fmt, pct, heroStrip, esc } from "../core.js";
import { STATS } from "./lanes.js";

// ---------- Draft (AD2L Captains Mode) ----------

const SLOT_NAMES = ["1st pick", "2nd pick", "3rd pick", "4th pick", "Last pick"];
const SLOT_PHASE = [1, 2, 2, 2, 3];

// A game's rating for one player-in-game `p`, from the page's games and their gameRatings.
export const rateOf = (games, rated) => {
  const by = new Map(games.map((g, i) => [g.p, rated[i].find((r) => r.key === playerKey(g.p))?.rating ?? null]));
  return (p) => by.get(p) ?? null;
};

// How a set of { m, p } games played, beyond the result: average game rating (`rate(p)`, the
// tier curve's 0–100), KDA, GPM and damage per minute (weighted by game length), kill
// participation. Games without stats are left out; null when none have them.
function slotImpact(rows, rate) {
  const d = rows.filter(({ m }) => hasDetails(m));
  if (!d.length) return null;
  const sum = (f) => d.reduce((s, g) => s + f(g), 0);
  const min = sum(({ m }) => m.duration_sec / 60);
  const rs = d.map(({ p }) => rate?.(p)).filter((x) => x != null), kp = d.map(({ p }) => p.kill_participation).filter((x) => x != null);
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    games: d.length,
    rating: avg(rs),
    kda: (sum(({ p }) => p.kills) + sum(({ p }) => p.assists)) / Math.max(sum(({ p }) => p.deaths), 1),
    gpm: min ? sum(({ m, p }) => p.gpm * m.duration_sec / 60) / min : null,
    dpm: min ? sum(({ p }) => p.hero_damage) / min : null,
    kp: avg(kp),
  };
}

// Record by the team's pick number for one player or hero: does it only win as a last pick, and
// does it actually play better from there? `rate(p)` gives a game's rating, when known.
export function draftSlotHtml(rec, src, who, rate = null) {
  if (!rec) return "";
  const wl = (w, g) => `${w}–${g - w}`;
  const base = slotImpact(rec.slots.flatMap((r) => r.rows), rate);
  const imp = rec.slots.map((r) => slotImpact(r.rows, rate));
  // Each stat against the same games from every slot: coloured when 2+ games sit clearly off it
  // (rating 5+ points, the rest 10%+).
  const vs = (k, v, n) => {
    const b = base?.[k];
    if (v == null || b == null || n < 2) return "";
    const off = k === "rating" ? v - b : b ? (v - b) / b : 0, cut = k === "rating" ? 5 : 0.1;
    return off >= cut ? " up" : off <= -cut ? " down" : "";
  };
  const STATS = [["kda", "KDA", (v) => v.toFixed(1)], ["gpm", "GPM", (v) => fmt(Math.round(v))], ["dpm", "Dmg/m", (v) => fmt(Math.round(v))], ["kp", "KP", pct]];
  const impactHtml = (x) => {
    if (!x) return "";
    const d = x.rating != null && base?.rating != null ? Math.round(x.rating - base.rating) : null;
    return `<div class="dp-impact">
        ${x.rating != null ? `<div class="dp-rating${vs("rating", x.rating, x.games)}"><b>${Math.round(x.rating)}</b><small>game rating${d ? ` <em>${d > 0 ? "+" : "−"}${Math.abs(d)}</em>` : ""}</small></div>` : ""}
        <dl class="dp-stats">${STATS.filter(([k]) => x[k] != null).map(([k, label, f]) => `<div class="${vs(k, x[k], x.games).trim()}"><dt>${label}</dt><dd>${f(x[k])}</dd></div>`).join("")}</dl>
      </div>`;
  };
  const last = rec.slots[4], early = rec.slots.slice(0, 4).reduce((a, r) => ({ games: a.games + r.games, wins: a.wins + r.wins }), { games: 0, wins: 0 });
  const earlyImp = slotImpact(rec.slots.slice(0, 4).flatMap((r) => r.rows), rate);
  const gap = last.games >= 2 && early.games >= 2 ? last.win_rate - early.wins / early.games : null;
  const verdict = gap == null ? "" : gap >= 0.3 ? `<div class="dp-verdict good">Wins far more as a last pick</div>` : gap <= -0.3 ? `<div class="dp-verdict bad">Does worse as a last pick</div>` : "";
  // Win-rate colour: a clear winner or loser from that slot (2+ games), else neutral.
  const tone = (r) => (r.games >= 2 && r.win_rate >= 0.6 ? " dp-good" : r.games >= 2 && r.win_rate <= 0.4 ? " dp-bad" : "");
  const slot = (r, i) => `<div class="dp-slot${r.games ? tone(r) : " dp-empty"}${i === 4 ? " dp-last" : ""}" style="--i:${i}; --m:${r.games ? r.win_rate.toFixed(3) : 0}">
      <div class="dp-head"><span class="dp-num">${i === 4 ? "L" : i + 1}</span><span class="dp-name">${SLOT_NAMES[i]}<small>Phase ${SLOT_PHASE[i]}</small></span></div>
      <div class="dp-wl">${r.games ? wl(r.wins, r.games) : "—"}</div>
      <div class="dp-wr">${r.games ? pct(r.win_rate) : "never"}<small>${r.games ? `${r.games} game${r.games === 1 ? "" : "s"}` : ""}</small></div>
      ${impactHtml(imp[i])}
      <div class="dp-heroes">${r.games ? heroStrip(src, r.heroes) : ""}</div>
      <div class="ld-meter"><i></i></div>
    </div>`;
  const cmp = (label, w, g, x) => `<div><b>${g ? wl(w, g) : "—"}</b><small>${label}${g ? ` · ${pct(w / g)}` : ""}${x?.rating != null ? ` · ${Math.round(x.rating)} rating` : ""}</small></div>`;
  return `<h2>By draft pick${info("by_draft_pick")}</h2>
    <p class="table-note wm-intro">${esc(who)} by the team's pick order, from ${rec.games} drafted game${rec.games === 1 ? "" : "s"}: average game rating, KDA, GPM, damage per minute and kill participation from each slot.${base?.rating != null ? ` Green or red = clearly above or below the ${Math.round(base.rating)} average across all slots (2+ games).` : ""}</p>
    <div class="sr-summary dp-compare">${cmp("Picks 1–4", early.wins, early.games, earlyImp)}${cmp("Last pick", last.wins, last.games, imp[4])}${verdict}</div>
    <div class="dp-grid reveal">${rec.slots.map(slot).join("")}</div>`;
}

// One hero's bans and picks by draft phase: a card per phase (its picks' record, the win-rate
// meter, bans), and the totals above.
export function heroPhaseHtml(row, drafted) {
  if (!row) return "";
  const wl = (w, g) => (g ? `${w}–${g - w}` : "—");
  const wins = row.pick_wins.reduce((a, b) => a + b, 0);
  const tone = (w, g) => (g >= 2 && w / g >= 0.6 ? " dp-good" : g >= 2 && w / g <= 0.4 ? " dp-bad" : "");
  const WHAT = ["opening 7 bans · first 2 picks", "3 bans · 6 picks", "last 4 bans · last 2 picks"];
  const phase = (i) => {
    const g = row.picks[i], w = row.pick_wins[i], b = row.bans[i];
    return `<div class="dp-slot${g || b ? tone(w, g) : " dp-empty"}" style="--i:${i}; --m:${g ? (w / g).toFixed(3) : 0}">
      <div class="dp-head"><span class="dp-num">${i + 1}</span><span class="dp-name">Phase ${i + 1}<small>${WHAT[i]}</small></span></div>
      <div class="dp-wl">${wl(w, g)}</div>
      <div class="dp-wr">${g ? pct(w / g) : "not picked"}<small>${g ? `${g} pick${g === 1 ? "" : "s"}` : ""}</small></div>
      <div class="dp-bans"><b>${b}</b> ban${b === 1 ? "" : "s"}${row.ban_total ? ` <small>${pct(b / row.ban_total)} of its bans</small>` : ""}</div>
      <div class="ld-meter"><i></i></div>
    </div>`;
  };
  return `<h2>Draft phases${info("hero_phases")}</h2>
    <div class="sr-summary dp-compare">
      <div><b>${row.ban_total}</b><small>bans · ${pct(row.ban_total / drafted)} of drafts</small></div>
      <div><b>${row.pick_total}</b><small>picks</small></div>
      <div><b>${wl(wins, row.pick_total)}</b><small>when picked${row.pick_total ? ` · ${pct(wins / row.pick_total)}` : ""}</small></div>
    </div>
    <div class="dp-grid dp-grid-3 reveal">${[0, 1, 2].map(phase).join("")}</div>`;
}