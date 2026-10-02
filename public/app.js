import { HEROES } from "./lib/heroes.js";
import { listTeams } from "./lib/teams.js";
import { info, wireInfo } from "./lib/glossary.js";
import { countVisit } from "./lib/visits.js";
import { buildSearchIndex, searchIndex } from "./lib/search.js";
import { DIVISIONS as DIVISION_LIST, slugOf, fullName, divisionCss, SEASON } from "./lib/divisions.js";
import { esc, DIVISIONS, SOURCES, TM_KEY, timeSel, gameWeeker, seriesWeek, shortDate, divLite, allMatches, addressOf, routedAt, setRoutedAt, showTab, app, tabInUrl, heroHref, portrait, here, bySlug, timeSrc, allLoad, gameLeague, divUploaded, setTitle } from "./core.js";
import { weekOfFn } from "./parts/lanes.js";
import { renderMatch, renderMatches } from "./pages/games.js";
import { renderHero } from "./pages/hero.js";
import { renderHeroes } from "./pages/heroes.js";
import { renderPlayer } from "./pages/player.js";
import { renderPlayers } from "./pages/players.js";
import { renderStandings } from "./pages/standings.js";
import { renderTeams } from "./pages/teams.js";
import { renderWeek } from "./pages/week.js";

// Upload (and editing an upload) and Predictions load on first visit.
const uploadPage = () => import("./pages/upload.js");
const predictPage = () => import("./pages/predict.js");
const drafterPage = () => import("./pages/drafter.js");

// ---------- League switcher + router ----------

const leagueBtn = document.getElementById("league-btn");
const leagueMenu = document.getElementById("league-menu");
// The division links (lowest first) go between Scrim League and All divisions, and each
// division's colours go in a <style> after style.css: both from lib/divisions.js.
leagueMenu.querySelector('a[data-league="all"]').before(...DIVISION_LIST.map((d) => {
  const a = document.createElement("a");
  a.href = `#/${slugOf(d)}/`; a.dataset.league = d.key;
  a.innerHTML = `<b>AD2L · ${esc(fullName(d))}</b>`;
  return a;
}));
document.head.append(Object.assign(document.createElement("style"), { id: "division-colors", textContent: divisionCss() }));
const setMenu = (open) => { leagueMenu.hidden = !open; leagueBtn.setAttribute("aria-expanded", String(open)); };
leagueBtn.onclick = (e) => { e.stopPropagation(); setMenu(leagueMenu.hidden); };
document.addEventListener("click", (e) => { if (!e.target.closest(".switcher")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

// Settings cog: colour-blind mode swaps the green/red pair for blue/vermilion (html.cb in
// style.css; index.html applies the saved choice before the first paint).
const settingsBtn = document.getElementById("settings-btn");
const settingsPop = document.getElementById("settings-pop");
const settingsEl = settingsPop.parentElement;
// Opens leftward from the cog; on narrow screens it slides right just enough to stay on screen.
const placeSettings = () => {
  if (settingsPop.hidden) return;
  settingsPop.style.right = "";
  const { left } = settingsPop.getBoundingClientRect();
  if (left < 8) settingsPop.style.right = `${left - 8}px`;
};
const setSettings = (open) => {
  settingsPop.hidden = !open; settingsBtn.setAttribute("aria-expanded", String(open));
  if (open) placeSettings(); else setTM(false);
};
settingsBtn.onclick = (e) => { e.stopPropagation(); setSettings(settingsPop.hidden); };
document.addEventListener("click", (e) => { if (!e.target.closest(".settings")) setSettings(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setSettings(false); });
const cbBox = document.getElementById("cb-mode");
cbBox.checked = document.documentElement.classList.contains("cb");
cbBox.onchange = () => {
  document.documentElement.classList.toggle("cb", cbBox.checked);
  try { localStorage.setItem("colorblind", cbBox.checked ? "1" : "0"); } catch { /* not remembered */ }
};
// Theme: dark (no class), html.grey or html.light in style.css. The browser bar follows the page colour.
const THEME_BAR = { dark: "#0c0b0a", grey: "#2b2d31", light: "#efe9df" };
const themeNow = ["light", "grey"].find((t) => document.documentElement.classList.contains(t)) ?? "dark";
for (const r of document.querySelectorAll('input[name="theme"]')) {
  r.checked = r.value === themeNow;
  r.onchange = () => {
    document.documentElement.classList.remove("light", "grey");
    if (r.value !== "dark") document.documentElement.classList.add(r.value);
    document.querySelector('meta[name="theme-color"]').content = THEME_BAR[r.value];
    try { localStorage.setItem("theme", r.value); } catch { /* not remembered */ }
  };
}

// Sub-division switch (Heroic/Aegis): Division A, Division B or Combined, keeping the current
// tab. Pages tied to one team or game fall back to that tab's list, which may not include it.
function divisionBar(src, h) {
  const bar = document.getElementById("div-switch");
  const views = DIVISIONS[src.key]?.views;
  bar.hidden = !views;
  if (bar.hidden) return;
  const base = SOURCES[src.key].root;
  const rest = h.slice(src.root.length).replace(/^\/+/, "");
  const [first] = rest.split("/");
  const keep = { game: "week", games: "week", edit: "week", teams: "", player: "players", tiers: "players", draft: "heroes" };
  const path = first in keep ? keep[first] : rest;
  bar.innerHTML = `<span class="div-label">View</span>${[...views.map((v) => [`${base}/${v}`, `Division ${v.toUpperCase()}`]), [base, "Combined"]]
    .map(([root, label]) => `<a href="${root}/${path}" class="${root === src.root ? "active" : ""}"${root === src.root ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
    <span class="div-note">${src.view ? `Only Division ${src.view.toUpperCase()} teams and the games between them` : "Both divisions together"}</span>`;
}
const saveTimeSel = () => {
  try { sessionStorage.setItem(TM_KEY, JSON.stringify(Object.fromEntries(Object.entries(timeSel).map(([k, v]) => [k, [...v]])))); } catch { /* private mode */ }
};
// Every week with a game or a played series, oldest first, numbered from the first.
async function leagueWeeks(src) {
  const [games, d] = await Promise.all([src.load(), src.ad2l ? src.data() : null]);
  const wk = gameWeeker(d), counts = new Map();
  for (const m of games) { const w = wk(m); if (w != null) counts.set(w, (counts.get(w) ?? 0) + 1); }
  for (const s of d?.series ?? []) {
    const w = seriesWeek(s);
    if (w != null && s.home_score + s.away_score > 0 && !counts.has(w)) counts.set(w, 0);
  }
  const weeks = [...counts.keys()].sort((a, b) => a - b);
  const num = (w) => Math.round((w - weeks[0]) / (7 * 864e5)) + 1;
  return { weeks, counts, num, total: games.length };
}
// "1–3, 5" from week numbers.
const weekRanges = (ns) => ns.sort((a, b) => a - b).reduce((out, n) => {
  const last = out[out.length - 1];
  if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]);
  return out;
}, []).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");

const tmEl = document.getElementById("tm"), tmBtn = document.getElementById("tm-btn"), tmPop = document.getElementById("tm-pop");
// Lives in the settings menu (under the cog); the week panel opens in place below its button.
const setTM = (open) => { tmPop.hidden = !open; tmBtn.setAttribute("aria-expanded", String(open)); placeSettings(); };
tmBtn.onclick = (e) => { e.stopPropagation(); setTM(tmPop.hidden); };
document.addEventListener("click", (e) => { if (!e.target.closest(".tm")) setTM(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setTM(false); });
let tmCtx = null, tmToken = 0;
// The header button (with the pick when one is on) and its week panel. Hidden on pages it
// doesn't apply to, and in leagues with fewer than two weeks.
async function timeBar(src, on) {
  const token = ++tmToken;
  const hide = () => { tmEl.hidden = true; setTM(false); tmCtx = null; settingsEl.classList.remove("tm-on"); };
  if (!on) return hide();
  let lw;
  try { lw = await leagueWeeks(src); } catch { lw = null; }
  if (token !== tmToken) return;
  if (!lw || lw.weeks.length < 2) return hide();
  const sel = timeSel[src.key];
  tmCtx = { key: src.key, weeks: lw.weeks, last: tmCtx?.key === src.key ? tmCtx.last : null };
  const picked = sel ? lw.weeks.filter((w) => sel.has(w)) : [];
  const games = picked.reduce((n, w) => n + lw.counts.get(w), 0);
  const range = weekRanges(picked.map(lw.num));
  const chip = (w) => {
    const c = lw.counts.get(w), on = sel?.has(w);
    return `<button type="button" class="tm-chip${on ? " on" : ""}" data-w="${w}" aria-pressed="${!!on}"
      title="Week of ${shortDate(new Date(w))} · ${c} game${c === 1 ? "" : "s"}"><span class="wn">W${lw.num(w)}</span><span class="wd">${shortDate(new Date(w))}</span></button>`;
  };
  tmBtn.innerHTML = sel ? `Wk ${range}` : "All weeks";
  tmBtn.title = sel ? `Time machine: showing week${picked.length === 1 ? "" : "s"} ${range}` : "Time machine: view chosen weeks only";
  tmEl.classList.toggle("active", !!sel);
  // The cog wears the accent while a pick narrows the page, since the button is tucked inside.
  settingsEl.classList.toggle("tm-on", !!sel);
  document.getElementById("settings-btn").title = sel ? `Settings · time machine on: week${picked.length === 1 ? "" : "s"} ${range}` : "Settings";
  tmPop.innerHTML = `<div class="tm-head"><span class="tm-label">Pick weeks${info("time_machine")}</span>
      <button type="button" class="tm-chip tm-all${sel ? "" : " on"}" data-w="all" aria-pressed="${!sel}">All weeks</button></div>
    <div class="tm-chips">${lw.weeks.map(chip).join("")}</div>
    <p class="tm-note">${sel
      ? `Showing week${picked.length === 1 ? "" : "s"} <b>${range}</b> · ${games} of ${lw.total} games`
      : "Pick weeks to see the league as it stood then."} Shift-click for a range.</p>`;
  tmEl.hidden = false;
}
tmPop.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-w]");
  if (!b || !tmCtx) return;
  const { key, weeks } = tmCtx;
  if (b.dataset.w === "all") { delete timeSel[key]; tmCtx.last = null; }
  else {
    const w = Number(b.dataset.w), cur = timeSel[key];
    let next;
    if (e.shiftKey && tmCtx.last != null) {
      // Range from the last week clicked, added to what's picked.
      const [lo, hi] = [Math.min(w, tmCtx.last), Math.max(w, tmCtx.last)];
      next = new Set([...(cur ?? []), ...weeks.filter((x) => x >= lo && x <= hi)]);
    } else if (!cur) next = new Set([w]); // from All: just this week
    else { next = new Set(cur); if (next.has(w)) next.delete(w); else next.add(w); }
    tmCtx.last = w;
    if (!next.size || weeks.every((x) => next.has(x))) delete timeSel[key]; else timeSel[key] = next;
  }
  saveTimeSel();
  route();
});

// Header search: every player and team in every league. The index loads every division's
// file and the saved scrims on first focus (then the pages reuse them); a division that
// can't load is left out rather than failing the search.
const searchEl = document.getElementById("search"), searchIn = document.getElementById("search-in"), searchPop = document.getElementById("search-pop");
let searchReady = null, searchIdx = null, searchHits = [], searchAt = -1;
function loadSearch() {
  searchReady ??= Promise.all([
    Promise.all(Object.entries(DIVISIONS).map(async ([key, dv]) => {
      try { return { key, label: dv.short, root: SOURCES[key].root, views: dv.views, data: await divLite(key) }; }
      catch (e) { console.warn(`search: ${key} unavailable`, e); return null; }
    })),
    allMatches().catch((e) => { console.warn("search: scrims unavailable", e); return null; }),
  ]).then(([leagues, scrims]) => (searchIdx = buildSearchIndex(leagues.filter(Boolean), scrims && { label: "Scrims", matches: scrims })))
    .catch((e) => { searchReady = null; throw e; });
  return searchReady;
}
const setSearch = (open) => {
  searchPop.hidden = !open; searchIn.setAttribute("aria-expanded", String(open));
  // Open toward whichever side has room: the header wraps on narrow screens.
  if (open) { searchPop.classList.remove("flip"); if (searchPop.getBoundingClientRect().left < 8) searchPop.classList.add("flip"); }
};
const mark = (name, q) => {
  const i = name.toLowerCase().indexOf(q.trim().toLowerCase());
  return i < 0 || !q.trim() ? esc(name) : `${esc(name.slice(0, i))}<mark>${esc(name.slice(i, i + q.trim().length))}</mark>${esc(name.slice(i + q.trim().length))}`;
};
async function showSearch() {
  const q = searchIn.value;
  if (!q.trim()) { searchHits = []; setSearch(false); return; }
  if (!searchIdx) {
    searchPop.innerHTML = `<div class="search-note">Loading every league…</div>`; setSearch(true);
    try { await loadSearch(); } catch { searchPop.innerHTML = `<div class="search-note">Search couldn't load. Try again.</div>`; return; }
    if (searchIn.value !== q) return showSearch();
  }
  searchHits = searchIndex(searchIdx, q);
  searchAt = searchHits.length ? 0 : -1;
  const lg = (r) => `<span class="lg-chip" data-lg="${r.league}">${esc(r.leagueLabel)}</span>`;
  searchPop.innerHTML = searchHits.length ? searchHits.map((r, i) => {
    const sub = r.kind === "team"
      ? (r.players.length ? esc(r.players.join(", ")) : "Team")
      : `${r.standin ? "Stand-in for " : ""}${r.team ? `<b>${esc(r.team)}</b>` : "No team"}${r.captain ? " · Captain" : ""}${r.alias ? ` · plays as ${mark(r.alias, q)}` : ""}`;
    return `<a class="search-hit${i === searchAt ? " on" : ""}" href="${r.href}" role="option" id="sh-${i}" aria-selected="${i === searchAt}">
      <span class="sh-kind sh-${r.kind}">${r.kind === "team" ? "Team" : "Player"}</span>
      <span class="sh-main"><span class="sh-name">${mark(r.name, q)}</span><span class="sh-sub">${sub}</span></span>${lg(r)}</a>`;
  }).join("") : `<div class="search-note">No player or team matches “${esc(q.trim())}”.</div>`;
  searchIn.setAttribute("aria-activedescendant", searchAt >= 0 ? `sh-${searchAt}` : "");
  setSearch(true);
}
const moveSearch = (d) => {
  if (!searchHits.length) return;
  searchAt = (searchAt + d + searchHits.length) % searchHits.length;
  searchPop.querySelectorAll(".search-hit").forEach((a, i) => { a.classList.toggle("on", i === searchAt); a.setAttribute("aria-selected", String(i === searchAt)); });
  searchPop.querySelector(".search-hit.on")?.scrollIntoView({ block: "nearest" });
  searchIn.setAttribute("aria-activedescendant", `sh-${searchAt}`);
};
searchIn.addEventListener("focus", () => { loadSearch().catch(() => {}); if (searchIn.value.trim()) showSearch(); });
searchIn.addEventListener("input", showSearch);
searchIn.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); moveSearch(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveSearch(-1); }
  else if (e.key === "Enter" && searchAt >= 0) { e.preventDefault(); searchPop.querySelectorAll(".search-hit")[searchAt]?.click(); }
  else if (e.key === "Escape") { setSearch(false); searchIn.blur(); }
});
// Picking a result: close and clear (the in-app link handler below does the navigating).
searchPop.addEventListener("click", (e) => { if (e.target.closest(".search-hit")) { setSearch(false); searchIn.value = ""; searchIn.blur(); } });
document.addEventListener("click", (e) => { if (!e.target.closest(".search")) setSearch(false); });
// "/" focuses the search from anywhere that isn't a text field.
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  e.preventDefault(); searchIn.focus();
});
// In-app links: move the address without a page load, then route as a hash change would.
document.addEventListener("click", (e) => {
  const a = e.target.closest?.('a[href^="#/"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
  e.preventDefault();
  // "#/x/teams/5?tab=roster" (the nav dropdowns): open that page on that tab.
  const [h, q = ""] = a.getAttribute("href").split("?");
  const tab = new URLSearchParams(q).get("tab");
  const u = new URL(addressOf(h), location.href);
  if (tab) u.searchParams.set("tab", tab);
  history.pushState(tab ? { tab } : null, "", u.pathname + u.search + u.hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
});
const samePage = (a, b) => { const x = new URL(a), y = new URL(b); return x.pathname === y.pathname && x.hash === y.hash; };
const onNav = () => {
  if (location.href === routedAt) return;
  // Back / Forward between tabs of the same page: switch the tab, don't rebuild the page.
  if (routedAt && showTab && samePage(location.href, routedAt) && app.querySelector(".pp-tabs")) {
    setRoutedAt(location.href);
    return showTab(tabInUrl());
  }
  countVisit();
  Promise.resolve(route()).then(focusPage, () => {});
};
// After a page change, focus moves to the new page's heading, so a screen reader announces the
// page and the keyboard starts from it rather than from the link left behind. Not on the first
// load, not while the tour is moving the page, and not if the visitor has already moved on.
function focusPage() {
  if (document.body.classList.contains("touring") || document.body.classList.contains("tour-pick")) return;
  const a = document.activeElement;
  if (a && a !== document.body && app.contains(a)) return;
  const h = app.querySelector("h1");
  if (!h) return;
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
}

// Nav dropdowns: hovering Teams, Weekly, Players or Heroes lists that tab's teams, weeks,
// players or heroes; hovering one of those shows its page's tabs on the right (a week shows
// its games). Built from the league's data the first time a tab opens. Mouse hover where
// the device has one; from the keyboard, Arrow Down on a tab opens it.
const tabsOf = (list) => (href) => list.map(([id, label]) => [label, `${href}?tab=${id}`]);
const TEAM_TABS = (src) => tabsOf([["overview", "Overview"], ["roster", "Roster"], ["games", src.ad2l ? "Series" : "Games"], ["heroes", "Heroes"], ["map", "Map"]]);
const PLAYER_TABS = tabsOf([["stats", "Stats"], ["heroes", "Heroes"], ["combat", "Combat"], ["lanes", "Laning"], ["items", "Items"], ["map", "Map"], ["games", "Games"]]);
const HERO_TABS = tabsOf([["stats", "Stats"], ["players", "Players"], ["draft", "Draft"], ["matchups", "Matchups"], ["combat", "Combat"], ["lanes", "Laning"], ["items", "Items"], ["map", "Map"], ["games", "Games"]]);
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
// Each returns { head: [[label, href]], items: [{ name, sub, href, group, side: [[label, href]] }] }.
async function teamMenu(src) {
  const tabs = TEAM_TABS(src);
  if (!src.ad2l) {
    const items = listTeams(await allMatches()).map((t) => ({ name: t.name, href: `#/teams/${t.slug}` })).sort(byName);
    return { items: items.map((t) => ({ ...t, side: tabs(t.href) })) };
  }
  const d = await src.data();
  const items = d.teams.map((t) => ({ name: t.name, href: `${src.root}/teams/${t.id}`, group: src.all ? t.division : null,
    sub: t.players.slice(0, 5).map((p) => p.name).join(", ") }))
    .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || byName(a, b));
  const head = [["table", "Table"], ["matches", "Matches"], ["cross", "Crosstable"], ["next", "Up next"]].map(([id, label]) => [label, `${src.root}/?tab=${id}`]);
  return { head, items: items.map((t) => ({ ...t, side: tabs(t.href) })) };
}
async function playerMenu(src) {
  // The header search's index, built for this league only: rostered players, then stand-ins.
  const idx = src.ad2l
    ? buildSearchIndex([{ key: src.key, label: "", root: src.root, data: await src.data() }])
    : buildSearchIndex([], { label: "", matches: await allMatches() });
  const items = idx.filter((e) => e.kind === "player")
    .map((p) => ({ name: p.name, href: p.href, group: p.team ?? "No team", sub: p.standin ? "Stand-in" : p.captain ? "Captain" : "", side: PLAYER_TABS(p.href) }))
    .sort((a, b) => a.group.localeCompare(b.group, undefined, { sensitivity: "base" }) || byName(a, b));
  return { items };
}
async function heroMenu(src) {
  const games = new Map();
  for (const m of await src.load()) for (const h of new Set((m.players ?? []).map((p) => p.hero).filter(Boolean))) games.set(h, (games.get(h) ?? 0) + 1);
  const items = [...games].map(([hero, n]) => ({ name: hero, hero, href: heroHref(src, hero), sub: `${n} game${n === 1 ? "" : "s"}` })).sort(byName);
  return { items: items.map((h) => ({ ...h, side: HERO_TABS(h.href) })) };
}
async function weekMenu(src) {
  const games = await src.load(), weekOf = weekOfFn(src.ad2l ? await src.data() : null);
  const weeks = [...new Set(games.map(weekOf))].sort((a, b) => b - a);
  const first = weeks.at(-1), base = src.ad2l ? `${src.root}/week` : "#/week";
  const items = weeks.map((w, i) => {
    const gs = games.filter((m) => weekOf(m) === w).sort((a, b) => a.createdAt - b.createdAt);
    // A series' games share a matchup: number them ("· Game 2").
    const seen = new Map();
    const label = (m) => {
      const pair = [m.team_a, m.team_b].sort().join("\n"), n = (seen.get(pair) ?? 0) + 1;
      seen.set(pair, n);
      return `${m.team_a ?? "?"} vs ${m.team_b ?? "?"}${n > 1 ? ` · Game ${n}` : ""}`;
    };
    return { name: `Week ${Math.round((w - first) / (7 * 864e5)) + 1}`, href: `${base}/${i}`, sub: `${shortDate(new Date(w))} · ${gs.length} game${gs.length === 1 ? "" : "s"}`,
      side: [["Whole week", `${base}/${i}`], ...gs.map((m) => [label(m), src.link(m)])] };
  });
  return { items };
}
const NAV_MENUS = { standings: teamMenu, teams: teamMenu, players: playerMenu, heroes: heroMenu, week: weekMenu };
let navSrc = null;
const canHover = matchMedia("(hover: hover) and (pointer: fine)");
const navItemOf = (el) => el?.closest?.(".nav-item");
function closeNavMenus(except = null) {
  for (const it of document.querySelectorAll("#nav .nav-item.open")) {
    if (it === except) continue;
    it.classList.remove("open");
    it.querySelector(".nav-drop").hidden = true;
    it.querySelector(":scope > a").setAttribute("aria-expanded", "false");
  }
}
async function openNavMenu(it) {
  closeNavMenus(it);
  if (it.classList.contains("open")) return;
  const drop = it.querySelector(".nav-drop"), src = navSrc;
  it.classList.add("open");
  it.querySelector(":scope > a").setAttribute("aria-expanded", "true");
  drop.hidden = false;
  fitNavDrop(drop);
  if (drop.dataset.built) return;
  drop.dataset.built = "1";
  drop.innerHTML = `<div class="nd-note">Loading…</div>`;
  let menu;
  try { menu = await NAV_MENUS[it.dataset.menu](src); }
  catch (e) { console.warn("nav menu unavailable", e); drop.innerHTML = `<div class="nd-note">Couldn't load this list.</div>`; delete drop.dataset.built; return; }
  if (!drop.isConnected || src !== navSrc) return;
  if (!menu.items.length) { drop.innerHTML = `<div class="nd-note">Nothing here yet.</div>`; return; }
  let group = null;
  const list = menu.items.map((x, i) => {
    const g = x.group != null && x.group !== group ? `<div class="nd-group">${esc(x.group)}</div>` : "";
    group = x.group ?? group;
    return `${g}<a class="nd-item" href="${x.href}" data-i="${i}">${x.hero ? portrait(x.hero, "nd-face") : ""}<span class="nd-name">${esc(x.name)}</span>${x.sub ? `<span class="nd-sub">${esc(x.sub)}</span>` : ""}</a>`;
  }).join("");
  drop.innerHTML = `${menu.head ? `<div class="nd-head">${menu.head.map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join("")}</div>` : ""}
    <div class="nd-body"><div class="nd-list">${list}</div><div class="nd-side" aria-live="polite"></div></div>`;
  drop._items = menu.items;
  // Start on the page you're on (a team's page opens its team), else the first entry.
  const at = here().split("?")[0], cur = menu.items.findIndex((x) => x.href === at);
  pickNavItem(drop, Math.max(0, cur), cur >= 0);
  fitNavDrop(drop);
}
function pickNavItem(drop, i, scroll = false) {
  const x = drop._items?.[i];
  if (!x) return;
  drop.querySelectorAll(".nd-item").forEach((a) => a.classList.toggle("on", a.dataset.i === String(i)));
  if (scroll) drop.querySelector(`.nd-item[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
  drop.querySelector(".nd-side").innerHTML = `<a class="nd-title" href="${x.href}">${esc(x.name)}</a>
    ${x.side.map(([label, href]) => `<a class="nd-tab" href="${href}">${esc(label)}</a>`).join("")}`;
}
// Keep the dropdown on screen: shift it left when it would run off the right edge.
function fitNavDrop(drop) {
  drop.style.left = "";
  const r = drop.getBoundingClientRect(), over = r.right - (innerWidth - 8);
  if (over > 0) drop.style.left = `${-Math.min(over, r.left - 8)}px`;
}
{
  const nav = document.getElementById("nav");
  let timer = null;
  const later = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
  nav.addEventListener("mouseover", (e) => {
    if (!canHover.matches) return;
    const it = navItemOf(e.target);
    if (it) later(() => openNavMenu(it), it.classList.contains("open") || nav.querySelector(".nav-item.open") ? 0 : 120);
    else later(() => closeNavMenus(), 200);
    const item = e.target.closest(".nd-item");
    if (item) pickNavItem(item.closest(".nav-drop"), Number(item.dataset.i));
  });
  nav.addEventListener("mouseleave", () => { if (canHover.matches) later(() => closeNavMenus(), 200); });
  nav.addEventListener("focusin", (e) => {
    const item = e.target.closest(".nd-item");
    if (item) pickNavItem(item.closest(".nav-drop"), Number(item.dataset.i));
  });
  nav.addEventListener("focusout", (e) => { if (!navItemOf(e.relatedTarget)) closeNavMenus(); });
  nav.addEventListener("click", (e) => { if (e.target.closest(".nav-drop a")) { clearTimeout(timer); closeNavMenus(); } });
  nav.addEventListener("keydown", async (e) => {
    const it = navItemOf(e.target);
    if (!it) return;
    const tabLink = it.querySelector(":scope > a"), drop = it.querySelector(".nav-drop");
    const items = () => [...drop.querySelectorAll(".nd-item")];
    if (e.key === "Escape") { closeNavMenus(); tabLink.focus(); return; }
    if (e.target === tabLink) {
      if (e.key !== "ArrowDown") return;
      e.preventDefault();
      await openNavMenu(it);
      (drop.querySelector(".nd-item.on") ?? items()[0])?.focus();
      return;
    }
    const list = e.target.classList.contains("nd-item") ? items() : [...drop.querySelectorAll(".nd-side a")];
    const i = list.indexOf(e.target), step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); list[Math.min(list.length - 1, Math.max(0, i + step))]?.focus(); }
    else if (e.key === "ArrowRight" && e.target.classList.contains("nd-item")) { e.preventDefault(); drop.querySelector(".nd-side a")?.focus(); }
    else if (e.key === "ArrowLeft" && !e.target.classList.contains("nd-item")) { e.preventDefault(); drop.querySelector(".nd-item.on")?.focus(); }
  });
}

// The home page (#/, and #/ad2l): pick a league. Scrim standings live at #/scrims; Champion's
// pages moved from #/ad2l/... to #/champion/... (route() forwards old links). Same order as
// the menu: the scrims, then AD2L lowest division first.
function renderHub() {
  const order = [...leagueMenu.querySelectorAll("a")].map((a) => a.dataset.league).filter((k) => k !== "all");
  const link = (key) => key === "scrim"
    ? `<a href="#/scrims" data-league="scrim" class="hub-scrim"><b>Scrim League</b><span>Our scrims</span></a>`
    : `<a href="${SOURCES[key].root}/" data-league="${key}"><b>${esc(DIVISIONS[key].short)}</b><span>AD2L ${SEASON.name}</span></a>`;
  app.innerHTML = `<section class="hub">
    <div class="kicker">Dota 2 · Scrims and AD2L ${SEASON.long}</div>
    <h1 class="hub-title">Pick a league</h1>
    <nav class="hub-list">${order.map(link).join("")}</nav>
    <a class="hub-all" href="#/all/" data-league="all"><b>All divisions</b><span>Every AD2L division's teams, games, players and heroes in one view</span></a>
  </section>`;
}

export function route() {
  setMenu(false);
  let h = here();
  if (/^#\/ad2l\/./.test(h)) h = h.replace(/^#\/ad2l/, SOURCES.ad2l.root); // old Champion links
  // Show this page's /path/ form (replaceState: no reload, no new history entry).
  const want = addressOf(h);
  if (location.pathname + location.hash !== want) history.replaceState(history.state, "", want + location.search);
  setRoutedAt(location.href);
  if (h === "#/" || /^#\/ad2l\/?$/.test(h)) return routeHub();
  // #/<division>/..., or #/<division>/<view>/... for a sub-division.
  const [, slug, view] = /^#\/([a-z0-9]+)(?:\/([a-z])(?=\/|$))?/.exec(h) ?? [];
  const key = bySlug[slug];
  const src = !key ? SOURCES.scrim : view && SOURCES[`${key}_${view}`] || SOURCES[key];
  const isAd2l = src.ad2l, r = src.root;
  document.body.dataset.league = src.key;
  const divLabel = DIVISIONS[src.key]?.views ? (src.view ? `Division ${src.view.toUpperCase()}` : "Combined") : "";
  const leagueTitle = src.all ? `AD2L ${SEASON.name} · All Divisions` : isAd2l ? `AD2L ${src.division}${divLabel ? ` · ${divLabel}` : ""}` : "Scrim League";
  document.getElementById("league-name").innerHTML = src.all ? "AD2L<b>All Divisions</b>" : isAd2l ? `AD2L<b>${src.division}</b>${divLabel ? `<em class="div-badge">${src.view ? `Div ${src.view.toUpperCase()}` : DIVISIONS[src.key].views.join(" + ").toUpperCase()}</em>` : ""}` : "Scrim<b>League</b>";
  leagueMenu.querySelectorAll("a").forEach((a) => a.classList.toggle("current", a.dataset.league === src.key));

  // Pages that read through the time machine; `tm` marks them so its bar shows.
  const t = timeSrc(src);
  let section, page, tm = false;
  if (isAd2l) {
    // Every AD2L division (#/champion, #/heroic, #/conqueror, #/warrior, #/challenger, #/voyager, #/explorer) shares these pages.
    const gameId = new RegExp(`^${r}/game/(\\d+|[0-9a-f]{32})$`).exec(h)?.[1];
    if (gameId && src.all) {
      // All has no game pages of its own: open the game in its division.
      section = "week";
      page = async () => {
        await allLoad().catch(() => null);
        const home = SOURCES[gameLeague.get(gameId)];
        if (!home) return renderMatch(gameId, src);
        history.replaceState(null, "", addressOf(`${home.root}/game/${gameId}`));
        return route();
      };
    }
    else if (gameId) { section = "week"; page = () => renderMatch(gameId, src); }
    else if (h.startsWith(`${r}/games`)) { section = "week"; page = () => renderWeek(src, 0); } // old Games tab: Weekly lists every game
    else if (h.startsWith(`${r}/teams`)) {
      // Standings doubles as the team list; a team's own page still lives under <root>/teams/<id>.
      const slug = decodeURIComponent(h.slice(r.length).split("/")[2] ?? "");
      section = "standings"; tm = true; page = slug ? () => renderTeams(t, slug) : () => renderStandings(t);
    }
    else if (h.startsWith(`${r}/week`)) { section = "week"; page = () => renderWeek(src, Number(h.slice(r.length).split("/")[2] ?? 0) || 0); }
    else if (h.startsWith(`${r}/tiers`)) { section = "players"; tm = true; page = () => renderPlayers(t); }
    else if (h.startsWith(`${r}/player/`)) { section = "players"; tm = true; page = () => renderPlayer(t, decodeURIComponent(h.slice(`${r}/player/`.length))); }
    else if (h.startsWith(`${r}/players`)) { section = "players"; tm = true; page = () => renderPlayers(t); }
    else if (h.startsWith(`${r}/hero/`)) { section = "heroes"; tm = true; page = () => renderHero(t, h.slice(`${r}/hero/`.length)); }
    else if (h.startsWith(`${r}/heroes`)) { section = "heroes"; tm = true; page = () => renderHeroes(t); }
    else if (h.startsWith(`${r}/draft`) && !h.startsWith(`${r}/drafter`)) { section = "heroes"; tm = true; page = () => renderHeroes(t); } // old Draft tab: now part of Heroes
    else if (src.all && /^\/(predict|drafter|upload|edit)/.test(h.slice(r.length))) { section = "standings"; tm = true; page = () => renderStandings(t); }
    else if (h.startsWith(`${r}/predict`)) { section = "predict"; page = async () => (await predictPage()).renderPredict(src); }
    else if (h.startsWith(`${r}/drafter`)) { section = "drafter"; page = async () => (await drafterPage()).renderDrafter(src); }
    else if (new RegExp(`^${r}/edit/[0-9a-f]{32}$`).test(h)) { section = "week"; page = async () => (await uploadPage()).renderEdit(h.slice(`${r}/edit/`.length), src.key); }
    else if (h.startsWith(`${r}/upload`)) { section = "upload"; page = async () => { const { endEdit, upload, checkDraft, renderUpload } = await uploadPage(); endEdit(); upload.league = src.key; await src.data().catch(() => null); await divUploaded(src.key); if (upload.draft) upload.check = checkDraft(upload.draft); return renderUpload(); }; }
    else { section = "standings"; tm = true; page = () => renderStandings(t); }
  } else {
    const matchId = /^#\/match\/([0-9a-f]{32})$/.exec(h)?.[1];
    if (matchId) { section = "matches"; page = () => renderMatch(matchId, src); }
    else if (/^#\/edit\/[0-9a-f]{32}$/.test(h)) { section = "matches"; page = async () => (await uploadPage()).renderEdit(h.slice("#/edit/".length), "scrim"); }
    else if (h.startsWith("#/upload")) {
      section = "upload";
      page = async () => {
        const { endEdit, upload, checkDraft, renderUpload, startPrivate } = await uploadPage();
        endEdit(); upload.league = "scrim";
        // Came from a scheduled scrim's "Private result" button: open the result form.
        if (upload.fixtureQuick) { upload.fixtureQuick = false; return startPrivate(); }
        if (upload.draft) upload.check = checkDraft(upload.draft);
        return renderUpload();
      };
    }
    else if (h.startsWith("#/predict")) { section = "predict"; page = async () => (await predictPage()).renderScrimPredict(); }
    else if (h.startsWith("#/teams")) { section = "teams"; tm = true; page = () => renderTeams(t, decodeURIComponent(h.split("/")[2] ?? "")); }
    else if (h.startsWith("#/week")) { section = "week"; page = () => renderWeek(src, Number(h.split("/")[2] ?? 0) || 0); }
    else if (h.startsWith("#/tiers")) { section = "players"; tm = true; page = () => renderPlayers(t); }
    else if (h.startsWith("#/player/")) { section = "players"; tm = true; page = () => renderPlayer(t, decodeURIComponent(h.slice("#/player/".length))); }
    else if (h.startsWith("#/players")) { section = "players"; tm = true; page = () => renderPlayers(t); }
    else if (h.startsWith("#/hero/")) { section = "heroes"; tm = true; page = () => renderHero(t, h.slice("#/hero/".length)); }
    else if (h.startsWith("#/heroes")) { section = "heroes"; tm = true; page = () => renderHeroes(t); }
    else { section = "matches"; tm = true; page = () => renderMatches(t); }
  }
  document.getElementById("nav").innerHTML = src.nav.map(([href, key, label, cls]) => {
    const a = `<a href="${href}" data-nav="${key}" class="${cls ?? ""}${key === section ? " active" : ""}"${key === section ? ' aria-current="page"' : ""}${NAV_MENUS[key] ? ' aria-haspopup="true" aria-expanded="false"' : ""}>${label}</a>`;
    return NAV_MENUS[key] ? `<div class="nav-item" data-menu="${key}">${a}<div class="nav-drop" hidden></div></div>` : a;
  }).join("");
  navSrc = src;
  // League menu: each league opens on the tab you're on (Players stays Players). A team,
  // game or player page opens that tab's list, since it needn't exist in the other league.
  // Standings, the scrim match list and scrim Teams all land on the other league's standings.
  const tab = { standings: "", matches: "", teams: "" }[section] ?? section;
  leagueMenu.querySelectorAll("a").forEach((a) => {
    const l = a.dataset.league;
    a.href = l === "scrim" ? `#/${tab === "drafter" ? "scrims" : tab || "scrims"}` : `${SOURCES[l].root}/${tab}`;
  });
  divisionBar(src, h);
  timeBar(src, tm);
  // The tab's own name first ("Players · AD2L S48 Warrior"); detail pages put theirs in front
  // when they draw (crumbs).
  const label = src.nav.find(([, key]) => key === section)?.[2] ?? "";
  setTitle(...(label ? [label] : []), leagueTitle);
  return Promise.resolve(page()).finally(() => footSync(src));
}
// Footer: when the page's division last synced (from its data file), on AD2L pages.
function footSync(src) {
  const el = document.getElementById("foot-sync");
  const at = src?.ad2l && src.cache?.()?.updated;
  el.textContent = at ? ` · ${src.all ? "All divisions" : DIVISIONS[src.key].short} synced ${new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
}

// The picker page: no tabs, no time machine, and the menu opens each league's first page.
function routeHub() {
  footSync(null);
  document.body.dataset.league = "hub";
  document.title = "AD2L Stat Tracker";
  document.getElementById("league-name").innerHTML = "AD2L<b>Stat Tracker</b>";
  leagueMenu.querySelectorAll("a").forEach((a) => {
    a.classList.remove("current");
    a.href = a.dataset.league === "scrim" ? "#/scrims" : `${SOURCES[a.dataset.league].root}/`;
  });
  document.getElementById("nav").innerHTML = "";
  document.getElementById("div-switch").hidden = true;
  timeBar(null, false);
  return renderHub();
}

document.getElementById("hero-list").innerHTML = HEROES.map((h) => `<option value="${esc(h)}">`).join("");
// Team names inside a card that's itself a link: open the team, not the card.
const openNested = (e) => {
  const t = e.target.closest?.("[data-href]");
  if (!t || (e.type === "keydown" && e.key !== "Enter")) return;
  e.preventDefault(); e.stopPropagation();
  location.hash = t.dataset.href;
};
app.addEventListener("click", openNested);
app.addEventListener("keydown", openNested);
// "Skip to content" (first in the page, shown on focus): to the page's heading. Handled here,
// since a plain #app link would be read as a route.
document.getElementById("skip-link").addEventListener("click", (e) => {
  e.preventDefault();
  const h = app.querySelector("h1") ?? app;
  h.tabIndex = -1;
  h.focus();
});
window.addEventListener("hashchange", onNav);
window.addEventListener("popstate", onNav);
wireInfo();
route();
countVisit();
// Feedback mode (lib/feedback.js) and the guided tour (lib/tour.js) load after the first page
// starts drawing, so they don't hold it up.
// Feedback: the Feedback button in the top bar.
import("./lib/feedback.js").then((m) => m.initFeedback()).catch((e) => console.warn("feedback unavailable", e));
// Tour: invites first-time visitors; "New here?" (or Resume) in the footer starts it.
// rerender re-routes the current page (after the tour puts back the choices it changed).
import("./lib/tour.js").then((m) => m.initTour({
  here,
  go: (h, { rerender } = {}) => {
    if (rerender) return route();
    history.pushState(null, "", addressOf(h));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  },
})).catch((e) => console.warn("tour unavailable", e));
