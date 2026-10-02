// Hero tier lists on the Heroes tab: the heroes themselves (by how well players do on them) and
// every player on every hero they've played enough (by hero rating), each ranked S–D.
import { heroTierList, heroPowerList, HERO_TIER_MIN, MIN_GAMES, K_HERO } from "../lib/tiers.js";
import { info } from "../lib/glossary.js";
import { esc, portrait, heroLink, heroHref, playerLink, teamLink } from "../core.js";

const SHOWN = 24; // chips per band before "+N more"
const st = { role: "all", min: HERO_TIER_MIN, hero: "", open: new Set() }; // open = tiers shown in full
const hs = { min: MIN_GAMES, open: new Set() };

// The S–D board: one band per tier, the first SHOWN chips, then a "+N more" toggle.
function board(bands, chip, open) {
  return `<div class="tier-board">${bands.map(({ tier, items }) => {
    const all = open.has(tier), cut = all ? items : items.slice(0, SHOWN), more = items.length - cut.length;
    return `<div class="tier-band t-${tier}">
      <div class="tier-letter">${tier}</div>
      <div class="tier-chips">${cut.length ? cut.map(chip).join("") : `<div class="tier-empty">—</div>`}
        ${more > 0 ? `<button type="button" class="hchip-more" data-tier="${tier}">+${more} more</button>` : all && items.length > SHOWN ? `<button type="button" class="hchip-more" data-tier="${tier}">Show fewer</button>` : ""}</div>
    </div>`;
  }).join("")}</div>`;
}
const wireMore = (el, open, draw) => el.querySelectorAll(".hchip-more").forEach((b) => (b.onclick = () => { const t = b.dataset.tier; open.has(t) ? open.delete(t) : open.add(t); draw(); }));
// Never open on an empty board: with few games, lower the floor until something shows.
const floorFor = (want, counts, steps) => { let min = want; while (min > 1 && !counts.some((n) => n >= min)) min = steps.filter((n) => n < min).pop(); return min; };
const minSelect = (id, steps, min) => `<select id="${id}">${steps.map((n) => `<option value="${n}" ${n === min ? "selected" : ""}>${n}</option>`).join("")}</select>`;

// The heroes themselves. `ratings` = heroRatings for the page's games.
export function heroPowerSection(src, ratings) {
  const steps = [1, 2, 3, 5, 10];
  let min = floorFor(hs.min, [...ratings.values()].map((ps) => ps.reduce((s, p) => s + p.games, 0)), steps);
  const draw = () => {
    const el = document.getElementById("hero-power");
    if (!el) return;
    const list = heroPowerList(ratings, { minGames: min });
    const bands = list.tiers.map(({ tier, heroes }) => ({ tier, items: heroes }));
    const total = bands.reduce((n, b) => n + b.items.length, 0);
    const chip = (h, i) => `<div class="chip hchip hpow" style="--i:${i}">
        <a class="hchip-img" href="${heroHref(src, h.hero)}" title="${esc(h.hero)}">${portrait(h.hero)}</a>
        <div class="hchip-body">
          <div class="chip-top"><span class="chip-name">${heroLink(src, h.hero)}</span><span class="chip-rating">${h.rating}</span></div>
          <div class="chip-meta" title="Best player on it">Best: ${playerLink(src, h.best)} (${h.best.rating})</div>
          <div class="chip-foot"><span>${h.wins}–${h.games - h.wins}</span><span>${h.games} game${h.games === 1 ? "" : "s"}</span><span>${h.players} player${h.players === 1 ? "" : "s"}</span></div>
        </div>
      </div>`;
    el.innerHTML = `<div class="row segs hchip-bar"><label class="min-bar">Heroes picked at least ${minSelect("hp-min", steps, min)} times</label></div>
      ${total ? board(bands, chip, hs.open) : `<p class="table-note">No hero has ${min}+ games yet.</p>`}
      <p class="table-note">${total} hero${total === 1 ? "" : "es"}. Rating = how well players do on the hero: the average hero rating of everyone who played it (weighted by games, padded with ${K_HERO} average games), on a curve fitted to the heroes so they spread S–D. It ranks performance on the hero, not its win rate.</p>`;
    el.querySelector("#hp-min").onchange = (e) => { hs.min = min = +e.target.value; draw(); };
    wireMore(el, hs.open, draw);
  };
  const html = ratings.size ? `<h2 id="hero-power-list">Hero tier list${info("hero_power_list")}</h2>
    <p class="table-note wm-intro">The heroes themselves, ranked S–D by how well the players on them perform.</p>
    <div id="hero-power" class="reveal"></div>` : "";
  return { html, draw };
}

// Every player on every hero. `ratings` = heroRatings for the page's games.
export function heroTierSection(src, ratings) {
  const heroes = [...ratings.keys()].sort();
  if (!ratings.has(st.hero)) st.hero = ""; // a pick from another league's page
  const steps = [1, 2, 3, 5];
  let min = floorFor(st.min, [...ratings.values()].flat().map((p) => p.games), steps);
  const draw = () => {
    const el = document.getElementById("hero-tiers");
    if (!el) return;
    const show = (p) => (st.role === "all" || p.role === st.role) && (!st.hero || p.hero === st.hero);
    const bands = heroTierList(ratings, { minGames: min }).map(({ tier, pairs }) => ({ tier, items: pairs.filter(show) }));
    const total = bands.reduce((n, b) => n + b.items.length, 0);
    const chip = (p, i) => `<div class="chip hchip ${p.role}" style="--i:${i}">
        <a class="hchip-img" href="${heroHref(src, p.hero)}" title="${esc(p.hero)}">${portrait(p.hero)}</a>
        <div class="hchip-body">
          <div class="chip-top"><span class="chip-name">${playerLink(src, p)}</span><span class="chip-rating">${p.rating}</span></div>
          <div class="chip-meta">${heroLink(src, p.hero)}${p.team ? ` · ${teamLink(src, p.team)}` : ""}</div>
          <div class="chip-foot"><span class="role-tag">${p.role === "core" ? "Core" : "Support"}</span><span>${p.wins}–${p.games - p.wins}</span><span>${p.games} game${p.games === 1 ? "" : "s"}</span></div>
        </div>
      </div>`;
    const seg = (k, label) => `<button type="button" class="seg${st.role === k ? " on" : ""}" data-role="${k}">${label}</button>`;
    el.innerHTML = `<div class="row segs hchip-bar">${seg("all", "Everyone")}${seg("core", "Cores")}${seg("support", "Supports")}
        <label class="min-bar">Hero <select id="ht-hero"><option value="">All heroes</option>${heroes.map((h) => `<option value="${esc(h)}" ${h === st.hero ? "selected" : ""}>${esc(h)}</option>`).join("")}</select></label>
        <label class="min-bar">At least ${minSelect("ht-min", steps, min)} games on the hero</label></div>
      ${total ? board(bands, chip, st.open) : `<p class="table-note">Nobody has ${min}+ games on ${st.hero ? esc(st.hero) : "a hero"}${st.role === "all" ? "" : ` as a ${st.role}`} yet.</p>`}
      <p class="table-note">${total} player–hero pair${total === 1 ? "" : "s"}. Rating = the hero rating: the tier rating from just their games on that hero. A couple of games is a small sample.</p>`;
    el.querySelectorAll(".seg").forEach((b) => (b.onclick = () => { st.role = b.dataset.role; draw(); }));
    el.querySelector("#ht-hero").onchange = (e) => { st.hero = e.target.value; draw(); };
    el.querySelector("#ht-min").onchange = (e) => { st.min = min = +e.target.value; draw(); };
    wireMore(el, st.open, draw);
  };
  const html = ratings.size ? `<h2 id="hero-tier-list">Players on heroes${info("hero_tier_list")}</h2>
    <p class="table-note wm-intro">Every player on every hero they've played, ranked S–D on their games on that hero.</p>
    <div id="hero-tiers" class="reveal"></div>` : "";
  return { html, draw };
}
