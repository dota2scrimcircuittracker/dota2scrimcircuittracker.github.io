// Items (AD2L, parsed replays): the Items tabs on game, player and hero pages.
import { info } from "../lib/glossary.js";
import { itemIcon, clock, hasItems, timingsOf, itemStats, itemName, averageTimes } from "../lib/items.js";
import { kg, playerLink, heroLink, teamLink, esc, pct, portrait, app } from "../core.js";

// ---------- items (AD2L, parsed replays) ----------

const itemRow = (keys) => `<span class="item-row">${keys.map((k) => (k ? itemIcon(k) : `<span class="item empty"></span>`)).join("")}</span>`;
// Average lead swing around an item finish (see itemSwing), with how many games it's from;
// greyed under 3 games, where one fight decides it.
const swingCell = (s) => (s.swing == null ? "—" : `<span class="${s.swings < 3 ? "muted" : s.swing > 0 ? "pos" : s.swing < 0 ? "neg" : ""}" title="Over ${s.swings} game${s.swings === 1 ? "" : "s"} with the lead series${s.swings < 3 ? " (too few to judge)" : ""}">${s.swing > 0 ? "+" : s.swing < 0 ? "−" : "±"}${kg(Math.abs(s.swing))}</span>`);
const ago = (d) => (d == null ? "" : `<span class="${d > 0 ? "pos" : d < 0 ? "neg" : ""}">${d > 0 ? "−" : d < 0 ? "+" : "±"}${clock(Math.abs(d))}</span>`);

// Game page: each player's final items and core-item timeline.
export function gameItemsHtml(m, src) {
  if (!m.players.some(hasItems)) return "";
  const row = (p) => `<tr class="team-${p.team}"><td class="l">${playerLink(src, p)}</td><td class="l">${heroLink(src, p.hero)}</td>
    <td class="l">${p.items ? `${itemRow(p.items.slice(0, 6))}${p.items[6] ? itemIcon(p.items[6], null, "neutral") : ""}` : "—"}</td>
    <td class="l"><span class="item-row timeline">${timingsOf(p).map(({ key, sec }) => itemIcon(key, sec)).join("") || "—"}</span></td></tr>`;
  const head = `<th scope="col" class="l">Player</th><th scope="col" class="l">Hero</th><th scope="col" class="l">Final items</th><th scope="col" class="l">Core items finished</th>`;
  const side = (t) => `<tr class="sep ${t}"><td colspan="4">${t === "a" ? teamLink(src, m.team_a, m.team_a_id) : teamLink(src, m.team_b, m.team_b_id)}</td></tr>${t === "b" ? `<tr class="head-repeat">${head}</tr>` : ""}${m.players.filter((p) => p.team === t).map(row).join("")}`;
  return `<h2>Items${info("core_items")}</h2>
    <div class="table-wrap items-table"><table>
      <thead><tr>${head}</tr></thead>
      <tbody>${side("a")}${side("b")}</tbody></table></div>
`;
}

// Hero page: that hero's core items over the league: how often, when, and how it went.
export function heroItemsHtml(src, games, hero) {
  const stats = itemStats(games);
  if (!stats.length) return "";
  const parsed = games.filter(({ p }) => hasItems(p)).length;
  return `<h2>Core items${info("core_items")}</h2>
    <div class="table-wrap items-table"><table>
      <thead><tr><th scope="col" class="l">Item</th><th scope="col">Built</th><th scope="col">Avg. time</th><th scope="col" class="l">Fastest</th><th scope="col">Win % built</th><th scope="col">Lead swing${info("lead_swing")}</th></tr></thead>
      <tbody>${stats.map((s) => `<tr><td class="l">${itemIcon(s.key)} ${esc(itemName(s.key))}</td>
        <td>${s.n} · ${pct(s.share)}</td><td>${clock(s.avg)}</td>
        <td class="l">${clock(s.best.sec)} · ${playerLink(src, s.best.p)} · <a href="${src.link(s.best.m)}">game</a></td>
        <td>${pct(s.winRate)}</td><td>${swingCell(s)}</td></tr>`).join("")}</tbody></table></div>
    <p class="table-note">From ${parsed} ${esc(hero)} game${parsed === 1 ? "" : "s"} with a replay. Built = games it was finished in and their share. Win % built = ${esc(hero)}'s win rate in those games. Lead swing = the change in the team's gold lead in the 3 minutes after finishing it, against the 3 minutes before. It shows timing, not that the item caused it: teams already ahead finish items sooner.</p>`;
}

// Player page: their core items and timings against the league's average for the same item on
// the same hero (− = faster). Chips pick one hero or all of them; one table shows at a time.
export function playerItemsHtml(src, matches, games) {
  const mine = games.filter(({ p }) => hasItems(p));
  if (!mine.length) return "";
  const league = averageTimes(matches, { perHero: true });
  const byHeroPlayed = new Map();
  for (const g of mine) byHeroPlayed.set(g.p.hero, [...(byHeroPlayed.get(g.p.hero) ?? []), g]);
  const heroes = [...byHeroPlayed].sort((a, b) => b[1].length - a[1].length);
  // League average for their own mix of heroes: each of their builds compared with that hero's
  // league average, so "All" doesn't pit an Axe Blink against every hero's Blink.
  const leagueFor = (gs, key) => {
    const refs = gs.filter(({ p }) => timingsOf(p).some((t) => t.key === key)).map(({ p }) => league.get(`${p.hero}|${key}`)).filter(Boolean);
    if (!refs.length) return null;
    const heroesSeen = new Map(gs.map(({ p }) => [p.hero, league.get(`${p.hero}|${key}`)?.n ?? 0]));
    return { avg: Math.round(refs.reduce((t, r) => t + r.avg, 0) / refs.length), n: [...heroesSeen.values()].reduce((t, v) => t + v, 0) };
  };
  // Under All heroes, items built once hide behind a button, to keep the table short.
  const table = (gs, all) => itemStats(gs).map((s) => {
    const l = leagueFor(gs, s.key);
    return `<tr${all && s.n < 2 ? ` class="ih-more" hidden` : ""}><td class="l">${itemIcon(s.key)} ${esc(itemName(s.key))}</td><td>${s.n}/${gs.length}</td><td>${clock(s.avg)}</td>
      <td>${l ? `${clock(l.avg)} <span class="muted">(${l.n})</span>` : "—"}</td><td>${l && l.n > s.n ? ago(l.avg - s.avg) : "—"}</td><td>${swingCell(s)}</td></tr>`;
  }).join("");
  const views = [["all", "All heroes", mine], ...heroes.map(([hero, gs]) => [hero, hero, gs])];
  const chip = ([v, label, gs], i) => `<button type="button" data-v="${esc(v)}" aria-pressed="${i === 0}">${v === "all" ? "" : portrait(v, "ih-img")}<span>${esc(label)}</span><b>${gs.length}</b></button>`;
  return `<h2>Core items${info("core_items")}</h2>
    <div class="ih-chips" role="group" aria-label="Hero">${views.map(chip).join("")}</div>
    ${views.map(([v, , gs], i) => `<div class="ih-view" data-v="${esc(v)}"${i ? " hidden" : ""}><div class="table-wrap items-table"><table>
      <thead><tr><th scope="col" class="l">Item</th><th scope="col">Built</th><th scope="col">Their avg.</th><th scope="col">League avg. on ${v === "all" ? "their heroes" : "hero"}</th><th scope="col">vs league</th><th scope="col">Lead swing${info("lead_swing")}</th></tr></thead>
      <tbody>${table(gs, v === "all")}</tbody></table></div>
      ${v === "all" ? (() => { const more = itemStats(gs).filter((s) => s.n < 2).length; return more && more < itemStats(gs).length ? `<button type="button" class="ih-more-btn">Show ${more} item${more === 1 ? "" : "s"} built once</button>` : ""; })() : `<p class="table-note">${heroLink(src, v)}: ${gs.length} game${gs.length === 1 ? "" : "s"} with a replay.</p>`}</div>`).join("")}
    <p class="table-note">League avg. = every build of that item on the same hero in this league, theirs included (count in brackets). Under All heroes, each build is compared with its own hero's average. vs league: − = faster; shown only when others have built it too.</p>`;
}

// Hero chips on the player Items tab: show one table.
export function wireItemHeroes() {
  const bar = app.querySelector(".ih-chips");
  if (!bar) return;
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    bar.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    app.querySelectorAll(".ih-view").forEach((v) => { v.hidden = v.dataset.v !== b.dataset.v; });
  });
  const more = app.querySelector(".ih-more-btn");
  if (more) more.onclick = () => { app.querySelectorAll(".ih-more").forEach((r) => { r.hidden = false; }); more.remove(); };
}