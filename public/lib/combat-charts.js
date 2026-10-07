// Charts for the combat stats (lib/combat.js): the kill-streak timeline on game pages, bar rows
// (streaks reached, multi-kills, game length, deaths by source, benchmarks), the medal-vs-rating
// scatter, a hero's skill-build grid and each player's build order. No library: SVG for the
// timeline and scatter, plain HTML bars for the rest (they reflow on a phone). Hover = <title>.
import { streakRuns, multiKillsOf, streakName, MULTI, STREAKS, DEATH_SOURCES, BENCH, medalFit } from "./combat.js";
import { heroImg } from "./hero-meta.js";
import { itemIcon, itemCost, clock } from "./items.js";
import { ITEMS } from "./items-data.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const KILLER = { "-1": "a tower", "-2": "lane creeps", "-3": "neutrals", "-4": "Roshan or another unit" };

// ---------- kill-streak timeline (game page) ----------
// Every run of kills without dying, as a step line climbing one kill at a time and dropping to
// zero at the death that ended it (an ×, hover for who). Runs that reached a streak (3+) are drawn
// in full with the hero at the peak and the announcer's name; shorter runs are faint. Team A's
// lines solid, team B's dashed. Multi-kills (two or more kills within 18s) get a badge.
export function streakChartHtml(m, { id = "streaks" } = {}) {
  if (!m.players?.some((p) => Array.isArray(p.kill_t))) return "";
  // A fixed height per kill; the level names sit beside the numbers on the left.
  const W = 800, L = 112, R = 16, B = 30, STEP = 24;
  const end = m.duration_sec, start = Math.min(0, ...m.players.flatMap((p) => p.kill_t ?? []));
  const all = m.players.map((p, i) => ({ p, i, ...streakRuns(m, i), multis: multiKillsOf(p) }));
  const peak = Math.max(0, ...all.flatMap((s) => s.runs.map((r) => r.peak)));
  if (!peak) return "";
  const top = Math.max(5, peak + 1), plotH = top * STEP;
  const x = (t) => L + ((t - start) / Math.max(1, end - start)) * (W - L - R);
  // Each streak's portrait and name go above its peak; ones that would overlap step up (with a
  // leader back to the peak), and the chart grows at the top to fit them.
  const LIFT = 38;
  const peaks = all.flatMap((s) => s.runs.filter((r) => r.peak >= 3).map((r) => {
    const label = r.peak >= 10 ? `${r.peak} kills` : streakName(r.peak);
    return { s, r, label, px: x(r.peakT), up: r.peak * STEP, w: Math.max(32, label.length * 6.6), lift: 0 };
  })).sort((a, b) => a.px - b.px);
  const placed = [];
  for (const q of peaks) {
    while (placed.some((o) => Math.abs(o.px - q.px) < (o.w + q.w) / 2 + 4 && Math.abs(o.up + o.lift - (q.up + q.lift)) < LIFT)) q.lift += LIFT;
    placed.push(q);
  }
  const T = 14 + Math.max(0, ...peaks.map((q) => q.up + q.lift + 32 - plotH)), H = T + plotH + B;
  const y = (v) => T + plotH - v * STEP;
  let grid = "";
  for (let v = 0; v <= top; v++) {
    if (v % 2 === 0 && v) continue;
    const named = v >= 3 ? streakName(v) : null;
    grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${named ? `<tspan class="sk-level">${named}</tspan> ` : ""}${v}</text>`;
  }
  for (let mm = 0; mm * 60 <= end; mm += end > 3000 ? 10 : 5) grid += `<text class="tick" x="${x(mm * 60)}" y="${H - 9}" text-anchor="middle">${mm}'</text>`;
  const zone = `<rect class="sk-zone" x="${L}" y="${y(top)}" width="${W - L - R}" height="${y(3) - y(top)}"/>`;
  const who = (i) => `${m.players[i].name} (${m.players[i].hero})`;
  const ender = (r) => (r.endedBy == null ? "alive at the end" : r.endedBy >= 0 && m.players[r.endedBy] ? `ended by ${who(r.endedBy)} at ${clock(r.end)}` : `ended by ${KILLER[r.endedBy] ?? "unknown"} at ${clock(r.end)}`);
  const tipOf = (s, r) => `${who(s.i)}: ${r.peak} kill${r.peak === 1 ? "" : "s"} without dying${r.peak >= 3 ? ` (${streakName(r.peak)})` : ""}, ${clock(r.start)}–${r.end != null ? clock(r.end) : "end"}, ${ender(r)}`;
  const lines = [], marks = [];
  for (const s of all) {
    const side = s.p.team;
    for (const r of s.runs) {
      const big = r.peak >= 3;
      let d = `M${x(r.start).toFixed(1)},${y(0).toFixed(1)}`;
      r.kills.forEach((t, k) => { d += `H${x(t).toFixed(1)}V${y(k + 1).toFixed(1)}`; });
      d += `H${x(r.end ?? end).toFixed(1)}${r.end != null ? `V${y(0).toFixed(1)}` : ""}`;
      lines.push(`<path class="sk-run s-${side}${big ? " big" : ""}${side === "b" ? " dash" : ""}" d="${d}"><title>${esc(tipOf(s, r))}</title></path>`);
      if (big && r.end != null) { const ex = x(r.end), ey = y(r.kills.length); marks.push(`<g class="sk-end s-${side}"><title>${esc(`${streakName(r.peak)} ${ender(r)}`)}</title><path d="M${(ex - 4).toFixed(1)},${(ey - 4).toFixed(1)}l8,8m0,-8l-8,8"/></g>`); }
    }
    for (const mk of s.multis) {
      const k = s.runs.flatMap((r) => r.kills.map((t, j) => [t, j + 1])).find(([t]) => t === mk.end)?.[1] ?? 1;
      const label = MULTI[Math.min(mk.n, 5) - 2];
      marks.push(`<g class="sk-multi sk-n${Math.min(mk.n, 5)} s-${side}${mk.n >= 3 ? " big" : ""}"><title>${esc(`${label}: ${who(s.i)}, ${mk.n} kills ${clock(mk.t)}–${clock(mk.end)}`)}</title>
        <circle cx="${x(mk.end).toFixed(1)}" cy="${y(k).toFixed(1)}" r="${mk.n >= 3 ? 7 : 5.5}"/><text x="${x(mk.end).toFixed(1)}" y="${(y(k) + 3).toFixed(1)}" text-anchor="middle">${mk.n >= 5 ? "R" : mk.n}</text></g>`);
    }
  }
  const tags = peaks.map(({ s, r, label, px, lift }) => {
    const img = heroImg(s.p.hero), base = y(r.peak), py = base - lift;
    return `<g class="sk-peak s-${s.p.team}"><title>${esc(tipOf(s, r))}</title>
      ${lift ? `<line class="sk-lead" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${(py - 4).toFixed(1)}" y2="${(base - 2).toFixed(1)}"/>` : ""}
      <rect class="sk-frame" x="${(px - 15).toFixed(1)}" y="${(py - 22).toFixed(1)}" width="30" height="18"/>
      ${img ? `<image href="${esc(img)}" x="${(px - 14).toFixed(1)}" y="${(py - 21).toFixed(1)}" width="28" height="16" preserveAspectRatio="xMidYMid slice"/>` : ""}
      <text class="sk-name" x="${px.toFixed(1)}" y="${(py - 26).toFixed(1)}" text-anchor="middle">${label}</text></g>`;
  });
  // Toggles: streak lines, and each kind of multi-kill (with how many this game has).
  const count = (n) => all.reduce((a, x) => a + x.multis.filter((mk) => Math.min(mk.n, 5) === n).length, 0);
  const toggles = [["runs", "Streaks", null], ...MULTI.map((label, k) => [`n${k + 2}`, label.replace(" kill", ""), count(k + 2)])];
  const bar = `<div class="sk-toggles" role="group" aria-label="Show">${toggles.map(([k, label, n]) => `<button type="button" class="seg on" data-sk="${k}" aria-pressed="true"${n === 0 ? " disabled" : ""}>${label}${n != null ? ` <small>${n}</small>` : ""}</button>`).join("")}</div>`;
  const caption = `Each line is a run of kills without dying: it climbs a step per hero kill and drops at the death that ended it (×, hover for who). ${esc(m.team_a)} solid, ${esc(m.team_b)} dashed. Shaded: streak territory (3+). Numbered dots: multi-kills (2 = double … R = rampage). Hover anything for details.`;
  return `<figure class="chart sk-chart" id="${id}">${bar}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kill streaks">${zone}${grid}
    <line class="zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>${lines.join("")}${marks.join("")}${tags.join("")}</svg>
    <figcaption class="chart-read">${caption}</figcaption></figure>`;
}

// The streak chart's toggles: each hides or shows its layer (streak lines with their portraits
// and ×s, or one kind of multi-kill dot).
export function wireStreakCharts(root) {
  root.querySelectorAll(".sk-chart [data-sk]").forEach((b) => (b.onclick = () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("on", on);
    b.closest(".sk-chart").classList.toggle(`hide-${b.dataset.sk}`, !on);
  }));
}

// ---------- bar rows ----------
// rows: [{ label, value, text?, sub?, cls?, href?, title? }]. Bars scale to `max` (default: the
// biggest value). `mid`: a line at that value (e.g. 50%).
export function barRowsHtml(rows, { max = null, mid = null, cls = "" } = {}) {
  const top = max ?? Math.max(1e-9, ...rows.map((r) => r.value ?? 0));
  const row = (r) => {
    const w = Math.max(0, Math.min(1, (r.value ?? 0) / top));
    const label = r.href ? `<a href="${esc(r.href)}">${r.label}</a>` : r.label;
    return `<div class="cb-row ${r.cls ?? ""}"${r.title ? ` title="${esc(r.title)}"` : ""}><span class="cb-label">${label}${r.sub ? `<small>${r.sub}</small>` : ""}</span>
      <span class="cb-track">${mid != null ? `<i class="cb-mid" style="left:${((mid / top) * 100).toFixed(1)}%"></i>` : ""}<i class="cb-fill" style="width:${(w * 100).toFixed(1)}%"></i>${r.ref != null ? `<i class="cb-ref" style="left:${(Math.min(1, r.ref / top) * 100).toFixed(1)}%" title="${esc(r.refTitle ?? "")}"></i>` : ""}</span>
      <b class="cb-val">${r.text ?? r.value}</b></div>`;
  };
  return `<div class="cb-bars ${cls}">${rows.map(row).join("")}</div>`;
}

// Times each streak level was reached, and multi-kills, for a player or hero.
export function streakBarsHtml(t) {
  const streak = STREAKS.map((label, i) => ({ label: `${i + 3}${i === 7 ? "+" : ""} · ${label}`, value: t.streaks[i], cls: i >= 4 ? "hot" : "" }));
  const multi = MULTI.map((label, i) => ({ label, value: t.multi[i], cls: i >= 2 ? "hot" : "" }));
  return `<div class="cb-pair">
    <section><h3 class="gm-h3">Kill streaks reached</h3>${barRowsHtml(streak)}<p class="table-note">Each time they reached that many kills without dying (one long streak counts at every level on the way up).</p></section>
    <section><h3 class="gm-h3">Multi-kills</h3>${barRowsHtml(multi)}<p class="table-note">Kills in quick succession, as the game announces them.</p></section>
  </div>`;
}

// Deaths by source, a game: this player (or hero) against the league's average.
export function deathSourcesHtml(mine, league, name) {
  if (!mine.games) return `<p class="table-note keep">No games with a full death log.</p>`;
  const per = (d) => DEATH_SOURCES.map(([k]) => (d.games ? d.by[k] / d.games : 0));
  const top = Math.max(...[mine, league].filter((d) => d?.games).map((d) => per(d).reduce((a, b) => a + b, 0)));
  const bar = (d, label) => {
    const v = per(d), tot = v.reduce((a, b) => a + b, 0);
    return `<div class="ds-row"><span class="cb-label">${label}<small>${tot.toFixed(1)} deaths a game</small></span>
      <span class="ds-track">${DEATH_SOURCES.map(([k, l], j) => v[j] ? `<i class="ds-${k}" style="width:${((v[j] / top) * 100).toFixed(2)}%" title="${esc(`${l}: ${v[j].toFixed(2)} a game (${pct(v[j] / tot)})`)}"></i>` : "").join("")}</span></div>`;
  };
  const killers = mine.killers.slice(0, 5).map((k) => `<span class="ds-killer">${heroImg(k.hero) ? `<img src="${esc(heroImg(k.hero))}" alt="">` : ""}${esc(k.hero)} <b>${k.n}</b></span>`).join("");
  return `<div class="ds">${bar(mine, esc(name))}${league?.games ? bar(league, "League average") : ""}
    <div class="ds-legend">${DEATH_SOURCES.map(([k, l]) => `<span><i class="ds-${k}"></i>${l}</span>`).join("")}</div>
    ${killers ? `<div class="ds-killers"><span class="sum-k">Killed most by</span>${killers}</div>` : ""}</div>
    <p class="table-note">${mine.games} game${mine.games === 1 ? "" : "s"} with a full death log${mine.skipped ? `; ${mine.skipped} more only logged deaths to heroes, so they're left out` : ""}. The last hit decides the source.</p>`;
}

// Public benchmarks: average percentile per stat, with the league's same-role average marked.
export function benchHtml(mine, ref, { refLabel = "league average for the role" } = {}) {
  if (!mine) return "";
  const ord = (v) => { const n = Math.round(v), s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"; return `${n}${s}`; };
  const rows = BENCH.map((label, k) => mine.avg[k] == null ? null : {
    label, value: mine.avg[k], text: ord(mine.avg[k]), cls: mine.avg[k] >= 75 ? "hot" : mine.avg[k] < 25 ? "cold" : "",
    ref: ref?.avg[k] ?? null, refTitle: ref?.avg[k] != null ? `${refLabel}: ${ord(ref.avg[k])}` : "",
  }).filter(Boolean);
  return `${barRowsHtml(rows, { max: 100, mid: 50, cls: "bench" })}
    <p class="table-note">Percentile against public games on the same hero (OpenDota's benchmarks), averaged over ${mine.games} game${mine.games === 1 ? "" : "s"}: 50th = a typical public game on that hero.${ref ? ` The tick is the ${esc(refLabel)}.` : ""}</p>`;
}

// Win % by game length (team page).
export function lengthHtml(buckets) {
  const rows = buckets.map((b) => ({ label: b.label, value: b.games ? b.wins / b.games : 0, text: b.games ? `${b.wins}–${b.games - b.wins}` : "—",
    sub: b.games ? pct(b.wins / b.games) : "no games", cls: !b.games ? "none" : b.wins * 2 > b.games ? "hot" : b.wins * 2 < b.games ? "cold" : "" }));
  return barRowsHtml(rows, { max: 1, mid: 0.5, cls: "len" });
}

// ---------- medal vs rating (Players tab) ----------
// points: [{ key, name, medal (medalValue), rank (label), rating, tier, href }]
const MEDALS = ["Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"];
export function medalScatterHtml(points, { id = "medal-scatter" } = {}) {
  const fit = medalFit(points);
  if (!fit) return "";
  const W = 800, H = 340, L = 44, R = 16, T = 16, B = 34;
  const ps = fit.points, lo = Math.max(1, Math.min(...ps.map((p) => p.medal)) - 1), hi = Math.min(36, Math.max(...ps.map((p) => p.medal)) + 1);
  const x = (v) => L + ((v - lo) / Math.max(1, hi - lo)) * (W - L - R), y = (v) => T + (1 - v / 100) * (H - T - B);
  let grid = "";
  for (const v of [0, 25, 50, 75, 100]) grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  MEDALS.forEach((name, i) => {
    const at = i * 5 + 1;
    if (at < lo - 4 || at > hi) return;
    grid += `<line class="grid" x1="${x(Math.max(lo, at))}" x2="${x(Math.max(lo, at))}" y1="${T}" y2="${H - B}"/><text class="tick" x="${x(Math.min(hi, Math.max(lo, at) + (i === 7 ? 0 : 2)))}" y="${H - 12}" text-anchor="middle">${name}</text>`;
  });
  // Spread players with the same medal sideways so they don't hide each other.
  const seen = new Map();
  const jitter = (p) => { const k = `${p.medal}:${Math.round(p.rating / 4)}`, n = seen.get(k) ?? 0; seen.set(k, n + 1); return (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 5; };
  const sorted = [...ps].sort((a, b) => b.gap - a.gap), over = sorted.slice(0, 3), under = sorted.slice(-3);
  const labelled = new Set([...over, ...under]);
  const dots = ps.map((p) => {
    const cx = x(p.medal) + jitter(p), cy = y(p.rating);
    const tip = `${p.name}: ${p.rank ?? "no medal"}, rating ${p.rating} (${p.tier}) · ${p.gap >= 0 ? "+" : "−"}${Math.abs(Math.round(p.gap))} vs the line`;
    return `<a href="${esc(p.href)}" class="ms-dot t-${p.tier}${labelled.has(p) ? " lab" : ""}"><title>${esc(tip)}</title><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${labelled.has(p) ? 5.5 : 4}"/>
      ${labelled.has(p) ? `<text x="${(cx > W - 160 ? cx - 8 : cx + 8).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="${cx > W - 160 ? "end" : "start"}" class="${over.includes(p) ? "up" : "down"}">${esc(p.name)}</text>` : ""}</a>`;
  }).join("");
  const line = `<line class="ms-fit" x1="${x(lo)}" x2="${x(hi)}" y1="${y(Math.max(0, Math.min(100, fit.at(lo))))}" y2="${y(Math.max(0, Math.min(100, fit.at(hi))))}"/>`;
  const list = (xs, cls) => xs.map((p) => `<a class="ms-chip ${cls}" href="${esc(p.href)}">${esc(p.name)} <small>${esc(p.rank ?? "")} · ${p.gap >= 0 ? "+" : "−"}${Math.abs(Math.round(p.gap))}</small></a>`).join("");
  return `<figure class="chart ms-chart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Medal against tier rating">${grid}${line}${dots}</svg>
    <figcaption class="chart-read">Each dot is a player with a tier rating: medal across, rating up, coloured by tier. Dashed: the rating players of each medal usually get here. Above the line = playing above their medal. Click a dot for the player.</figcaption></figure>
    <div class="ms-lists"><div><span class="sum-k">Above their medal</span>${list(over, "up")}</div><div><span class="sum-k">Below their medal</span>${list([...under].reverse(), "down")}</div></div>`;
}

// ---------- skill builds (hero page) ----------
const ABILITY_CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/";
export function skillGridHtml(grid, named) {
  if (!grid) return "";
  const icon = (key, name, cls = "") => (key ? `<img class="sg-ico ${cls}" src="${ABILITY_CDN}${esc(key)}.png" alt="" title="${esc(name)}" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="sg-ico sg-talent ${cls}" title="${esc(name)}">T</span>`);
  const head = `<tr><th scope="col" class="l">Ability</th>${Array.from({ length: grid.levels }, (_, i) => `<th scope="col">${i + 1}</th>`).join("")}</tr>`;
  const rows = grid.rows.map((r) => `<tr><td class="l sg-name">${icon(r.key, r.name)}${esc(r.name)}</td>${r.cells.map((c, lv) => {
    const tip = c.n ? `Level ${lv + 1}: ${c.n} of ${grid.builds} builds (${pct(c.share)})${r.talent ? ` — ${c.picks.map((p) => `${p.name} ×${p.n}`).join(", ")}` : ""}` : "";
    return `<td class="sg-cell" style="--s:${c.share.toFixed(3)}"${tip ? ` title="${esc(tip)}"` : ""}>${c.share >= 0.5 ? "●" : c.share >= 0.15 ? "•" : ""}</td>`;
  }).join("")}</tr>`).join("");
  const common = grid.common.seq.map((k) => {
    if (k === "talent") return icon(null, "Talent", "sm");
    const [key, name] = named(Number(k)) ?? [null, `Ability ${k}`];
    return icon(key, name, "sm");
  }).join("");
  return `<div class="table-wrap sg-wrap"><table class="sg">${head}${rows}</table></div>
    <p class="table-note">${grid.builds} build${grid.builds === 1 ? "" : "s"}. Each cell: the share of games that put a point into that row at that level (● most of them, • some); hover for counts. Every talent shares the Talents row; hover for which.</p>
    <div class="sg-common"><span class="sum-k">Most common first 10 levels</span><span class="sg-seq">${common}</span><small>${grid.common.n} of ${grid.builds}</small></div>`;
}

// ---------- build order (game Items tab) ----------
// buy: flat [key, second, ...] from the detail file. Starting items (bought before the horn),
// then every purchase worth showing: built items, and shop items of 500+ gold (recipes and
// cheap parts left out).
const shown = (key) => !key.startsWith("recipe_") && (ITEMS[key]?.[3] === "b" || itemCost(key) >= 500);
export function buildOrderHtml(m, detail, { playerCell = (p) => esc(p.name) } = {}) {
  if (!detail) return "";
  const rows = m.players.map((p, i) => {
    const buy = detail[i]?.buy;
    if (!buy?.length) return "";
    const items = [];
    for (let j = 0; j + 1 < buy.length; j += 2) items.push({ key: buy[j], t: buy[j + 1] });
    const start = items.filter((it) => it.t <= 0), later = items.filter((it) => it.t > 0 && shown(it.key));
    const counts = new Map();
    for (const it of start) counts.set(it.key, (counts.get(it.key) ?? 0) + 1);
    return `<div class="bo-row s-${p.team}"><div class="bo-who">${playerCell(p)}</div>
      <div class="bo-start">${[...counts].map(([k, n]) => `${itemIcon(k)}${n > 1 ? `<small>×${n}</small>` : ""}`).join("")}</div>
      <div class="bo-line">${later.map((it) => itemIcon(it.key, it.t)).join("")}</div></div>`;
  }).join("");
  return rows ? `<div class="bo">${rows}</div><p class="table-note">Left: starting items. Then every built item and every shop item of 500+ gold, in the order bought, with the time.</p>` : "";
}

