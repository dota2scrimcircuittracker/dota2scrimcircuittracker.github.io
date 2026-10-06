// Tier list: ratings, the breakdown modal and the tier section on the Players page.
import { hasDetails } from "../lib/stats.js";
import { tierModel, METRICS, tierList, rankLabel, WEIGHTS, MULT, RATING_STRETCH, ratingOf, TIERS, SURVIVAL, K_SHRINK, EASE, K_CONSISTENCY, K_PRIOR, K_SPEED } from "../lib/tiers.js";
import { info } from "../lib/glossary.js";
import { leagueSrc, floorOf, pct, esc, teamLink, playerLink } from "../core.js";

// ---------- Tier list ----------

let tierRole = "all";
const tierOpen = new Set(); // player keys whose card is expanded
// Each league (AD2L division, or the scrim ledger) is scored against its own games. The
// Heroic A/B views use the whole division's reference, so a player's stats are judged against
// the same field as in Combined. With the time machine on, only the picked weeks' games, and
// the lower game floor. One model per game list and floor.
const refMemo = new WeakMap();
// `pos` (1–5): that position's model, rating its players against each other.
export async function tierRef(src, pos = null) {
  const all = await (src.view ? leagueSrc(src) : src).load(), min = floorOf(src);
  const m = refMemo.get(all) ?? refMemo.set(all, new Map()).get(all), k = `${min}|${pos ?? ""}`;
  return m.get(k) ?? m.set(k, tierModel(all.filter(hasDetails), { minGames: min, pos })).get(k);
}

// How each tier-list stat reads in a breakdown, and the raw number shown under a share.
const kNum = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
const METRIC_FMT = {
  farm: pct, dmg: pct, tower: pct, xp: pct, kills: pct, assists: pct, dead: pct,
  gpm: (v) => `${Math.round(v)}`, nw: kNum,
  lane: (v) => `${Math.round(v)}%`,
  stuns: (v) => `${v.toFixed(1)}s/m`, // seconds per minute
  vision: (v) => `${v.toFixed(1)}% of map`,
  dewards: (v) => `${v.toFixed(1)}/10m`, stacks: (v) => `${v.toFixed(1)} a game`, deaths: (v) => `${v.toFixed(1)}/10m`,
  heal: (v) => `${Math.round(v)}/min`,
  lanewin: (v) => `${v >= 0 ? "+" : "−"}${kNum(Math.abs(v))}`,
  sentries: (v) => `${v.toFixed(1)}/10m`, dust: (v) => `${v.toFixed(1)}/10m`, smokes: (v) => `${v.toFixed(1)}/10m`,
  tanked: kNum,
};
const RAW_FMT = {
  farm: (v) => `${Math.round(v)} GPM`, dmg: (v) => `${kNum(v)} dmg a game`, tower: (v) => `${kNum(v)} bldg dmg a game`,
  xp: (v) => `${Math.round(v)} XPM`, kills: (v) => `${v.toFixed(1)} kills a game`, assists: (v) => `${v.toFixed(1)} assists a game`,
};
// Round a list of point values to tenths so the shown numbers add up to the shown total
// (largest remainder: the tenths lost to rounding down go to the biggest fractions).
export function tenths(values, total) {
  const raw = values.map((v) => v * 10), out = raw.map(Math.floor);
  let left = Math.round(total * 10) - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++;
  return out.map((t) => (t / 10).toFixed(1));
}
// A stat's maximum points: whole numbers as they are (10), splits between roles to a tenth.
const maxPts = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
export const meter = (v) => `<span class="bd-meter"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>`;

// The stat table sorts by stat, 0–100 or points (click a header; again flips it). One order for
// every breakdown, kept while the page is open; the default is the scoring's own order.
let bdSort = { by: null, dir: -1 };
const sortVal = { name: (r) => r.dataset.name, score: (r) => Number(r.dataset.score), pts: (r) => Number(r.dataset.pts) };
const cmpBy = (get) => (a, b) => { const x = get(a), y = get(b); return (typeof x === "string" ? x.localeCompare(y) : x - y) * (bdSort.by === "name" ? -bdSort.dir : bdSort.dir); };
function sortStats(stats, ptsOf) {
  if (!bdSort.by) return stats;
  const get = { name: (s) => METRICS[s.metric].label, score: (s) => s.score, pts: (s) => Number(ptsOf.get(s)) }[bdSort.by];
  return [...stats].sort(cmpBy(get));
}
const sortBtn = (k, label) => `<button type="button" class="bd-sort${bdSort.by === k ? " on" : ""}" data-sort="${k}" aria-label="Sort by ${label}">${label}<i aria-hidden="true">${bdSort.by === k ? (bdSort.dir < 0 ? (k === "name" ? "▴" : "▾") : (k === "name" ? "▾" : "▴")) : "↕"}</i></button>`;
if (typeof document !== "undefined" && !window.__bdWired) {
  window.__bdWired = true;
  document.addEventListener("click", (e) => {
    const x = e.target.closest?.(".bd-x");
    if (x) { x.closest(".chip")?.querySelector(".chip-caret")?.click(); return; }
    const b = e.target.closest?.(".bd-sort");
    if (!b) return;
    bdSort = bdSort.by === b.dataset.sort ? { by: b.dataset.sort, dir: -bdSort.dir } : { by: b.dataset.sort, dir: -1 };
    // Every open breakdown: re-sort each run of stat rows (each role's) in place.
    for (const t of document.querySelectorAll(".bd-table")) {
      t.querySelectorAll(".bd-sort").forEach((h) => { h.outerHTML = sortBtn(h.dataset.sort, h.textContent.replace(/[▴▾↕]/g, "")); });
      const rows = [...t.tBodies[0].rows];
      let run = [];
      const flush = () => { if (run.length > 1) { const after = run[run.length - 1].nextSibling, parent = run[0].parentNode; run.sort(cmpBy(sortVal[bdSort.by])).forEach((r) => parent.insertBefore(r, after)); } run = []; };
      for (const r of rows) { if (r.classList.contains("bd-stat")) run.push(r); else flush(); }
      flush();
    }
  });
}

// The expanded card: every point of the score (stat by stat, then what each multiplier adds or
// takes away), the rating, and each series.
export function tierBreakdown(src, p) {
  // Stat points, then each multiplier as the points it adds or takes away, in order; all
  // rounded together so the shown rows add up to the shown score.
  const stats = p.roles.flatMap((r) => r.stats);
  const steps = [];
  let running = p.stat_points;
  for (const k of ["survival", "consistency", "opponents", "winning"]) { const next = running * p.mult[k]; steps.push(next - running); running = next; }
  const shown = tenths([...stats.map((s) => s.points), ...steps], p.score);
  const ptsOf = new Map(stats.map((s, i) => [s, shown[i]]));
  const stepShown = Object.fromEntries(["survival", "consistency", "opponents", "winning"].map((k, i) => [k, shown[stats.length + i]]));
  const statShown = (shown.slice(0, stats.length).reduce((t, v) => t + Math.round(Number(v) * 10), 0) / 10).toFixed(1);
  const signedPts = (v) => (Number(v) > 0 ? `+${v}` : Number(v) < 0 ? `−${v.replace("-", "")}` : "0.0");

  const statRow = (s) => `<tr class="bd-stat" data-name="${esc(METRICS[s.metric].label)}" data-score="${s.score}" data-pts="${ptsOf.get(s)}" data-max="${s.max}">
      <td class="l">${esc(METRICS[s.metric].label)}${info(`tm_${s.metric}`)}${s.weight < 0 ? `<span class="bd-note"> fewer is better</span>` : ""}</td>
      <td>${METRIC_FMT[s.metric](s.value)}${s.raw != null ? `<small class="bd-raw">${RAW_FMT[s.metric](s.raw)}</small>` : ""}</td>
      <td class="bd-dim bd-wide">${METRIC_FMT[s.metric](s.avg)}</td>
      <td class="bd-100"><b>${Math.round(s.score)}</b>${meter(s.score)}</td>
      <td class="bd-pts">${ptsOf.get(s)}<small>/${maxPts(s.max)}</small></td></tr>`;
  // Survival's parts: no points of their own, they make up the survival 0–100.
  const partRow = (s) => `<tr class="bd-part">
      <td class="l">${esc(METRICS[s.metric].label)}${info(`tm_${s.metric}`)}${s.weight < 0 ? `<span class="bd-note"> fewer is better</span>` : ""}</td>
      <td>${METRIC_FMT[s.metric](s.value)}</td><td class="bd-dim bd-wide">${METRIC_FMT[s.metric](s.avg)}</td>
      <td class="bd-100"><b>${Math.round(s.score)}</b>${meter(s.score)}</td><td class="bd-dim">${Math.round(s.share * 100)}%</td></tr>`;
  const roleHead = (r) => p.roles.length > 1
    ? `<tr class="bd-role"><td class="l" colspan="5">As ${r.role} · ${r.games} of ${p.games} games</td></tr>` : "";
  const rows = p.roles.map((r) => roleHead(r) + sortStats(r.stats, ptsOf).map(statRow).join("")).join("");
  const main = p.roles[0];
  const multRow = (k, label, theirs, sub, of100) => `<tr class="bd-mult">
      <td class="l">${label}${info(`tm_${k}`)}</td>
      <td>${theirs}${sub ? `<small class="bd-raw">${sub}</small>` : ""}</td><td class="bd-wide"></td>
      <td class="bd-100">${of100 != null ? `<b>${Math.round(of100)}</b>${meter(of100)}` : ""}</td>
      <td class="bd-pts">${signedPts(stepShown[k])}<small>×${p.mult[k].toFixed(2)}</small></td></tr>`;
  // Per series: stat points (bar) and the series' score = its stat points × that opponent's
  // factor × the season's survival, consistency and winning. Weighted by games, each column
  // averages to the season's number, shown in the last row.
  const series = p.series.map((s) => `<div class="bd-series">
      <span class="bd-date">${s.time ? esc(new Date(s.time * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })) : ""}</span>
      <span class="bd-vs">${s.vs ? `vs ${teamLink(src, s.vs)}` : "—"}${s.role !== p.role ? ` <em>as ${s.role}</em>` : ""}</span>
      <span class="bd-wl">${s.wins}–${s.games - s.wins}</span>
      ${meter(s.points ?? 0)}<span class="bd-spts">${s.points == null ? "—" : s.points.toFixed(1)}</span>
      <span class="bd-opp">×${(s.opp ?? 1).toFixed(2)}</span><b>${s.score == null ? "—" : s.score.toFixed(1)}</b></div>`).join("");
  const seriesAvg = `<div class="bd-series bd-series-avg"><span></span><span class="bd-vs">Season, weighted by games</span><span class="bd-wl">${p.wins}–${p.games - p.wins}</span>
      <span></span><span class="bd-spts">${p.stat_points.toFixed(1)}</span><span class="bd-opp">×${p.mult.opponents.toFixed(2)}</span><b>${p.score.toFixed(1)}</b></div>`;
  const m = p.mult;
  // The curve row: rating − score as shown, so score + this row = the rating exactly.
  const curveDelta = p.rating - Number(p.score.toFixed(1));
  const curveShown = `${curveDelta >= 0 ? "+" : "−"}${Math.abs(curveDelta).toFixed(1)}`;
  const curveWidths = Math.abs((p.score - p.curve[0]) / p.curve[1]).toFixed(1);
  // Two columns on wide screens (rating, score and series left; the stat table right), one
  // column otherwise with the series straight under the score.
  return `<div class="bd"><button type="button" class="bd-x" aria-label="Close the breakdown" title="Close">×</button>
    <div class="bd-left">
    <div class="bd-sum">
      <div class="bd-total"><b>${p.rating}</b><small>rating</small></div>
      <div class="bd-eq">score <b>${p.score.toFixed(1)}</b> = ${statShown} stat points × ${m.survival.toFixed(2)} survival × ${m.consistency.toFixed(2)} consistency × ${m.opponents.toFixed(2)} opponents × ${m.winning.toFixed(2)} winning<br>
        <small>rating ${p.rating} = score ${p.score.toFixed(1)} ${curveShown} from the league's rating curve${info("tm_curve")}</small></div>
    </div>
    <h4>Series <small>stat points, opponent factor and score${info("tm_series")}</small></h4>
    <div class="bd-serieslist">
      <div class="bd-series bd-series-head"><span></span><span></span><span></span><span></span><span>Stats</span><span>Opp.</span><span>Score</span></div>
      ${series}${seriesAvg}</div>
    </div>
    <div class="bd-right">
    <h4>Stats <small>${p.games} games, against the same position</small></h4>
    <table class="bd-table">
      <thead><tr><th scope="col" class="l">${sortBtn("name", "Stat")}</th><th scope="col">Theirs</th><th scope="col" class="bd-wide">Pos. avg${info("tm_avg")}</th><th scope="col">${sortBtn("score", "0–100")}${info("tm_stat100")}</th><th scope="col">${sortBtn("pts", "Points")}${info("tm_points")}</th></tr></thead>
      <tbody>${rows}
        <tr class="bd-sub"><td class="l">Stat points</td><td></td><td class="bd-wide"></td><td></td><td class="bd-pts">${statShown}<small>/100</small></td></tr>
        ${multRow("survival", "Survival", "", "", p.survival)}
        ${(main?.survival ?? []).map(partRow).join("")}
        ${multRow("consistency", "Consistency", p.spread != null ? `±${p.spread.toFixed(1)}` : "—", `${p.series_points.length} series`, p.consistency)}
        ${multRow("opponents", "Opponents", `${Math.round(p.opp_rate * 100)}%`, "opp. win %", null)}
        ${multRow("winning", "Winning", `${p.wins}–${p.games - p.wins}`, `${Math.round(p.win_shrunk * 100)}% adj.${p.win_minutes ? `<br>${Math.round(p.win_minutes)}-min wins` : ""}`, p.winning)}
        <tr class="bd-sub"><td class="l">Score</td><td></td><td class="bd-wide"></td><td></td><td class="bd-pts">${p.score.toFixed(1)}</td></tr>
        <tr class="bd-mult bd-curve"><td class="l">Rating curve${info("tm_curve")}<span class="bd-note"> compares you with your league</span></td>
          <td>${p.score >= p.curve[0] ? "+" : "−"}${curveWidths}<small class="bd-raw">widths ${p.score >= p.curve[0] ? "above" : "below"} the league median (${p.curve[0].toFixed(1)}, which rates 50)</small></td><td class="bd-wide"></td>
          <td></td><td class="bd-pts">${curveShown}</td></tr>
        <tr class="bd-total-row"><td class="l">Rating</td><td></td><td class="bd-wide"></td><td></td><td class="bd-pts">${p.rating}</td></tr>
      </tbody></table>
    </div>
  </div>`;
}

// Games at each position, for the role tag's tooltip: "Pos 4: 9 games · Pos 5: 3 games".
const posTitle = (p) => `${p.role === "core" ? "Core" : "Support"}. ` + Object.entries(p.pos_games ?? {}).filter(([, n]) => n).map(([k, n]) => `Pos ${k}: ${n} game${n === 1 ? "" : "s"}`).join(" · ");

// The tier list, shown at the top of the Players page: returns its HTML and a function
// that fills it in once it's on the page.
export function tierSection(src, matches, model) {
  const full = tierList(matches, { model, minGames: floorOf(src) });
  // Pos 1–5: that position's own list (its games only, rated against its players), made once.
  const posLists = {};
  const draw = async () => {
    const posOf = (k) => (k.startsWith("pos") ? Number(k.slice(3)) : null);
    const n = posOf(tierRole);
    if (n && !posLists[n]) posLists[n] = tierList(matches, { model: await tierRef(src, n), minGames: floorOf(src), pos: n });
    const list = n ? posLists[n] : full;
    const el = document.getElementById("tiers");
    if (!el) return;
    const show = (p) => tierRole === "all" || n || p.role === tierRole;
    const chip = (p, i) => {
      const rank = rankLabel(p.rank_tier);
      const open = tierOpen.has(p.key);
      return `<div class="chip ${p.role}${open ? " open" : ""}" style="--i:${i}" data-key="${esc(p.key)}" tabindex="0" role="button" aria-expanded="${open}" title="${open ? "Click to close" : "Click for the breakdown"}">
        <div class="chip-top"><span class="chip-name">${playerLink(src, p)}</span><span class="chip-rating">${p.rating}</span></div>
        <div class="chip-meta">${p.team ? teamLink(src, p.team) : ""}${p.standin ? " · stand-in" : ""}</div>
        <div class="chip-foot"><span class="role-tag" title="${esc(posTitle(p))}">Pos ${posOf(tierRole) ?? p.pos}</span><span>${p.wins}–${p.games - p.wins}</span>${rank ? `<span>${esc(rank)}</span>` : ""}</div>
        <div class="chip-caret" aria-hidden="true">${open ? "Close <b>▴</b>" : "Breakdown <b>▾</b>"}</div>
        ${open ? tierBreakdown(src, p) : ""}
      </div>`;
    };
    const bands = list.tiers.map(({ tier, players }) => {
      const shown = players.filter(show);
      return `<div class="tier-band t-${tier}">
        <div class="tier-letter">${tier}</div>
        <div class="tier-chips reveal">${shown.length ? shown.map(chip).join("") : `<div class="tier-empty">—</div>`}</div>
      </div>`;
    }).join("");
    const tab = (k, label) => `<button type="button" class="seg${tierRole === k ? " on" : ""}" data-role="${k}">${label}</button>`;
    el.innerHTML = `
      <div class="row segs">${tab("all", "Everyone")}${tab("core", "Cores")}${tab("support", "Supports")}</div>
      <div class="row segs tier-pos">${[1, 2, 3, 4, 5].map((n) => tab(`pos${n}`, `Pos ${n}`)).join("")}</div>
      ${n ? `<p class="table-note">Games at pos ${n} only, rated against the other pos ${n} players. Players who also play other positions are rated on their pos ${n} games alone.</p>` : ""}
      <div class="tier-board">${bands}</div>
      ${list.unranked.length ? `<p class="table-note">Not ranked yet (needs ${floorOf(src)}+ games${n ? ` at pos ${n}` : ""}): ${list.unranked.map((p) => `${playerLink(src, p)} (${p.games})`).join(", ")}.</p>` : ""}`;
    el.querySelectorAll(".seg").forEach((b) => (b.onclick = () => { tierRole = b.dataset.role; draw(); }));
    const toggle = (c) => {
      const k = c.dataset.key;
      tierOpen.has(k) ? tierOpen.delete(k) : tierOpen.add(k);
      draw();
      el.querySelector(`.chip[data-key="${CSS.escape(k)}"]`)?.focus({ preventScroll: true });
    };
    el.querySelectorAll(".chip").forEach((c) => {
      c.onclick = (e) => { if (!e.target.closest("a") && !e.target.closest(".bd")) toggle(c); };
      c.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); toggle(c); } };
    });
  };
  const html = full.eligible ? `<h2 id="tier-list">Tier list${info("tier_list")}</h2>
    <p class="table-note wm-intro">${full.eligible} players ranked from ${matches.length} ${matches.length === 1 ? "game" : "games"}.</p>
    <div id="tiers"></div>
    ${tierHow(full.model, src)}`
    : `<p class="table-note">Tier list: players need ${floorOf(src)}+ games to be ranked.</p>`;
  return { html, draw };
}

// "How it's scored": the whole method, with the live points, multipliers, curve and cutoffs.
function tierHow(model, src) {
  const curve = model.curve;
  const pool = src.ad2l ? `this division (${model.games} games)` : `the scrim ledger (${model.games} games)`;
  const statTable = (role) => `<table class="how-table"><thead><tr><th scope="col" class="l">Stat</th><th scope="col">Points</th><th scope="col" class="l">What it measures</th></tr></thead><tbody>
    ${Object.entries(WEIGHTS[role]).map(([m, w]) => `<tr><td class="l">${esc(METRICS[m].label)}</td><td>${Math.abs(w)}${w < 0 ? "↓" : ""}</td><td class="l wrap">${esc(METRICS[m].def)}</td></tr>`).join("")}
    <tr><td class="l"><b>Total</b></td><td><b>${Object.values(WEIGHTS[role]).reduce((t, w) => t + Math.abs(w), 0)}</b></td><td></td></tr>
    </tbody></table>`;
  const range = (k) => `×${MULT[k][0].toFixed(2)} to ×${MULT[k][1].toFixed(2)}`;
  const farmMax = WEIGHTS.core.farm;
  const [center, spread] = curve;
  const gpmSlope = model?.positions?.[1]?.gpm?.length === 3 ? model.positions[1].gpm[1] : null;
  const curveScores = [...new Set([-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5].map((k) => Math.round(center + k * (spread / RATING_STRETCH))))];
  const curveRows = curveScores.map((s) => `<tr><td>${s}</td><td>${Math.round(ratingOf(s, curve))}</td></tr>`).join("");
  const cuts = TIERS.map((t, i) => t.min === -Infinity ? `<b>D</b> below ${TIERS[i - 1].min}` : `<b>${t.tier}</b> ${t.min}+`).join(" · ");
  const survShare = (m) => Math.round((Math.abs(SURVIVAL[m]) / Object.values(SURVIVAL).reduce((t, w) => t + Math.abs(w), 0)) * 100);
  return `<details class="how how-tiers">
    <summary>How it's scored</summary>
    <div class="how-body">
    <p>Ratings use game stats only, not medals or pub records. Click a player above to see their numbers at each step.</p>
    <p class="how-formula">score = stat points (out of 100) × survival × consistency × opponents × winning<br>rating = the score on the rating curve</p>
    <p>There's no starting number. In a breakdown, the stat rows add up to the stat points, and each multiplier shows the points it adds or takes away, so the rows add up to the score.</p>

    <h3>1. Role</h3>
    <p>Each replay gives every player a position, 1 to 5. Positions 1–3 are <b>cores</b>, 4–5 <b>supports</b>. Games without positions (screenshot uploads, scrims) use net worth: a team's three richest players are its cores. Each game is scored in the role played, so a support who cored two games has those two scored as core.</p>

    <h3>2. Each stat, against the same position</h3>
    <p>Each stat in each game is compared with the average for that position across ${pool}: a position 3 against other position 3s. The comparison is a z-score (standard deviations from average), capped at ±2.5 so one freak number can't carry a game, and flipped for stats where less is better.</p>
    <p><b>Shares, so long games don't pay.</b> Farm, hero damage, building damage, XP, kills and assists are measured as the player's <i>share of their team's total</i>, because per-minute and per-game numbers climb in long games. The breakdown shows the raw number (GPM, damage, kills per game) next to each share.</p>
    <p><b>GPM and net worth</b> count on top of farm share: farm share is how much of the team's gold you took, these are how rich you got. Both climb with game length${gpmSlope ? ` (about +${gpmSlope.toFixed(1)} GPM per extra minute for a position 1)` : ""}, so they're compared with what that position gets in a game <i>that long</i>, from a straight line fitted through every game. <b>Stacks</b> (supports) work the same way. They're counted per game, not per minute, because stacking is early-game work.</p>
    <p><b>Lane result</b> is the gold + XP lead at 10 minutes over whoever you laned against: a position 1 against the enemy position 3, mid against mid, a position 3 against the enemy position 1. Supports are judged as a lane pair: the safe-lane support with their carry against the enemy offlane pair, and the reverse. Laning efficiency counts separately for cores: how much of the lane's gold you took, whoever was across from you.</p>
    <p><b>Kills and assists</b> are separate. Kill share is the team's kills you finished; assist share is the ones you helped with. Together they make kill participation.</p>
    <p><b>Utility</b> (supports): smokes used, dust used and sentries placed, per 10 minutes, each its own stat. Sentries count as placed, not bought. They're worth few points because dewards already credit the sentries that find enemy wards.</p>
    <p>If a game is missing a stat (screenshot uploads have no wards, stuns or laning), that stat is left out and the others fill its points.</p>

    <h3>3. Each stat on its own 0–100</h3>
    <p>Each stat is scored against the other players in ${pool}, in the same role:</p>
    <ul class="how-list">
      <li>First, the player's average for the stat in that role, padded with ${K_SHRINK} games at the position average. A 3-game player keeps about half of how far they are from average, a 20-game player nearly all of it.</li>
      <li><b>100</b> = the <b>best</b> such average of any player with ${floorOf(src)}+ games in that role in this league. If you have the league's best average farm share among cores, you get all of farm share's points.</li>
      <li><b>0</b> = the <b>worst</b> such average. Everyone else sits in between, in proportion.</li>
      <li><b>Stacks (supports)</b> are easier: 100 sits ${Math.round(EASE.support.stacks * 100)}% of the way from the worst stacker to the best. A few supports stack far more than anyone else, and without this everyone else would score close to nothing.</li>
    </ul>
    <p>Each AD2L division and the scrim ledger has its own 100s and 0s, so a 90 in one division isn't the same as a 90 in another.</p>

    <h3>4. Stat points (out of 100)</h3>
    <p>Each stat is worth a fixed number of the 100 stat points (the tables below), and earns its 0–100 as a percentage of them. For example, a core's farm share is worth up to ${farmMax} points, so a farm share of 80/100 earns ${(farmMax * 0.8).toFixed(1)}. A player who played both roles has each role's points scaled by their share of games (7 of 8 games as core: 7/8 of each core stat's points).</p>
    <div class="how-tables">
      <div><h4>Cores</h4>${statTable("core")}</div>
      <div><h4>Supports</h4>${statTable("support")}</div>
    </div>
    <p><b>Why these points.</b> Cores are there to farm, fight, win their lane and take buildings, so damage, farm, lane result and buildings carry the most. Supports win games through vision, killing the enemy's vision, assists, disables and utility. Their farm and net worth count a little: a support who turns gold into items fights better, but farm isn't the job.</p>

    <h3>5. The multipliers</h3>
    <p>Four multipliers scale the stat points. They measure <i>how</i> the stats were earned: 50 stat points from a player who never died, against strong teams, in wins, are worth more than the same 50 from one who fed in losses to weak teams.</p>
    <ul class="how-list">
      <li><b>Survival, ${range("survival")}.</b> Deaths (${survShare("deaths")}%), share of the game spent dead (${survShare("dead")}%), and hero damage taken per life (${survShare("tanked")}%), each compared with the same position and put on a 0–100 like the stats. Damage taken per life credits players who soak a lot of damage and live, like an offlaner who absorbs the fight. At 100 survival nothing is lost; at 0 the stat points lose 15%.</li>
      <li><b>Consistency, ${range("consistency")}.</b> How much the player's stat points swing from series to series (the standard deviation). Short records are pulled toward the league's typical swing (${model.consistency ? `±${model.consistency.typical.toFixed(1)}` : "the median"}) as if they'd played ${K_CONSISTENCY} more typical series, so two series can't make anyone look perfectly steady. The steadiest player in the league sets ×1.00, the streakiest ×0.90.</li>
      <li><b>Opponents, ${range("opponents")}.</b> For each game, the opponent's game win % in their other games (not the ones against this player's team), padded with ${K_PRIOR} even games. An opponent winning 75% elsewhere is ×1.10, 50% is ×1.00, 25% is ×0.90. Each series takes its opponent's factor, and the season multiplier weights the series by their stat points: a big series against a strong team lifts it more than a big series against a weak one. It evens out schedules within a division; it doesn't measure division strength.</li>
      <li><b>Winning, ${range("winning")}.</b> Two parts win rate to one part win speed, as a 0–100:
        <br>Win rate: every record is padded with ${K_PRIOR} imaginary games at 50%. 3–0 becomes 6 of 9 (67%), and 9–3 becomes 12 of 18 (67%). Then 25% or worse scores 0, 50% scores 50, 75% or better scores 100.
        <br>Win speed: each win scores the share of the league's wins that took longer, so a win faster than 90% of wins scores 90. The average is padded with ${K_SPEED} average wins (50), so one quick stomp can't max it out; a player with no wins sits at 50.
        <br>A winning score of 50 is ×1.00; 100 is ×1.30; 0 is ×0.70.</li>
    </ul>

    <h3>6. Series</h3>
    <p>The breakdown lists every series with its own stat points and score. A series' stat points use the same padding as the season, so a great series can pass 100. Its score is those stat points × that opponent's factor × the season's survival, consistency and winning. Weighted by games, the series average to the season's stat points and score, shown in the last row.</p>

    <h3>7. The rating</h3>
    <p>The rating is the step that places a player's score within their league. The breakdown shows it as the <b>Rating curve</b> row (rating minus score), so the rows still add up to the rating.</p>
    <p>Scores bunch up (a typical player lands near 40, a great season around 75), so the curve spreads them onto 0–100: the league's median score rates 50, and each step further from the middle is worth a little less, so 0 and 100 stay nearly out of reach. It's a normal distribution ${RATING_STRETCH}× as wide as the spread of the league's scores: one width above the median rates 84, two widths 98, one below 16. It's refit on every data update. Right now the median score is ${center.toFixed(1)} and a width is ${spread.toFixed(1)}:</p>
    <table class="how-table how-curve"><thead><tr><th scope="col">Score</th><th scope="col">Rating</th></tr></thead><tbody>${curveRows}</tbody></table>

    <h3>8. Tiers</h3>
    <p>Fixed rating cutoffs, the same for cores and supports: ${cuts}. The cutoffs don't move with the field, so a tier can be empty and a strong division can have more S players. A player needs ${floorOf(src)}+ games to be ranked.</p>

    <h3>What isn't counted</h3>
    <ul class="how-list">
      <li><b>Slows and saves.</b> The replay data has neither. Nothing records a Glimmer Cape or Force Staff that saved an ally.</li>
      <li><b>Hero difficulty and the draft.</b> A position 1 on a hard lane is compared with every other position 1.</li>
      <li><b>Division strength.</b> Ratings rank players within their division. A Conqueror 90 isn't compared with a Champion 90.</li>
      <li><b>Gems, courier kills, buybacks, runes.</b> Too rare or too situational to score fairly.</li>
      <li><b>Medals and pubs.</b> Shown on the cards but not scored.</li>
    </ul>
  </div></details>`;
}