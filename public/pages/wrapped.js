// AD2L Wrapped (#/<division>/wrapped[/<player>]): a season in review as a story of cards. Your own
// season first (signed in, or the player in the address), then the league's awards. Each of your
// cards (and any award you won) can be pinned to your profile; the profile draws it with
// pinnedCardHtml. The maths is lib/wrapped.js.
import { app, wrappedSrcData, esc, pageHead, playerLink, teamLink, heroLink, fmt, pct, signedK, setTitle, SOURCES, playerHref, DIVISIONS, floorOf, divLite, setRoutedAt, addressOf } from "../core.js";
import { loadNicknames, nicknameOf } from "../lib/nicknames.js";
import { hasDetails, playerKey, mainAccount } from "../lib/stats.js";
import { laneCuts, LANE_GROUPS } from "../lib/lanes.js";
import { seasonGames, seasonAwards, playerWrapped, byPlayer, PLAYER_CARDS, MIN_GAMES, seasonOver, seasonResults, mergeResults, leaguePersonalities, mainTeamOf } from "../lib/wrapped.js";
import { heroImg, HERO_META } from "../lib/hero-meta.js";
import { heroArt } from "../lib/hero-art.js";
import { screenArt, cardArtwork } from "../lib/card-art.js";
import { CARD_ART } from "../lib/card-art-data.js";
import { CATEGORIES as CUP_CATEGORIES, podium as cupPodium } from "../lib/arcana-cup.js";
import { ALL_SCREENS } from "../lib/legendary-screens.js";
import { modelReads as liveReads, unpackReads } from "../lib/wrapped-reads.js";
import { draftDataFor } from "../parts/cmdraft.js";
import { SEASON, slugOf, DIVISIONS as DIVISIONS_LIST, CONFIRMED_FINAL } from "../lib/divisions.js";
import { steamAccount } from "../lib/store.js";
import { collectionAction, publicCollection, finishLayersHtml, finishStackOf, cupView, cosmeticBorder } from "../lib/cosmetics.js";
import { itemByKey, CATALOG, PERSONAL_CATALOG } from "../lib/cosmetics-catalog.js";
import { loading, errorBox } from "../parts/lanes.js";
import { listCards } from "../lib/store.js";
import { clipOf, clipHtml } from "../lib/clips.js";
import { gameRatings, rankLabel, tierModel, tierList } from "../lib/tiers.js";
import { hitText } from "../parts/combat.js";
import { MULTI, streakName } from "../lib/combat.js";
import { teamWrapped } from "../lib/team-wrapped.js";
import { leagueDraftOf } from "../lib/wrapped-draft.js";
import { VB as MAP_VB, Y as mapY } from "../lib/wardmap.js";
import { parsedPlayers, moreOf, everyDivision, divisionShowdown, leaderboards, teamMapOf, performanceOf, gameRecords, playerRecords } from "../lib/wrapped-more.js";
import { teamGames } from "../lib/team-wrapped.js";
import { itemImg, itemName } from "../lib/items.js";
import { signatureHtml } from "../lib/signatures.js";
import { DEFAULT_EQUIPMENT } from "../lib/cosmetics-catalog.js";
import { slideMs, highlightCards, resumeKey, resumeAt, lowData } from "../lib/story-player.js";

// The page's styles live in their own file, added once on first use.
function addStyles() {
  if (document.querySelector('link[data-wrapped-css]')) return;
  document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="wrapped.css" data-wrapped-css>');
}

const name = (p) => esc(p?.name ?? "?");
const lane = (g) => LANE_GROUPS.find(([k]) => k === g)?.[1] ?? g;
const num = (v, f) => (f === "%" ? pct(v) : Number(v).toFixed(f));
const plural = (n, w) => `${fmt(n)} ${n === 1 ? w : w === "hero" ? "heroes" : `${w}s`}`;
const seriesScore = (s) => `${Math.max(s.home_score, s.away_score)}–${Math.min(s.home_score, s.away_score)}`;

// Everything a story needs from one league: its season games, awards and team names. Cached per
// league for the visit (the profile pin and the page share it).
// A league's own id: Heroic/Aegis's views share its key, so they add theirs ('heroic_a').
// The league as the page names it: "Heroic/Aegis · Division A" on a view.
const leagueName = (src) => { const d = String(src.division ?? "").replace(new RegExp(`^${SEASON.name} `), ""); return esc(src.view ? `${d} · Division ${src.view.toUpperCase()}` : d); };
const srcId = (src) => (src.view ? `${src.key}_${src.view}` : src.key);
const cache = new Map();
export async function wrappedData(src) {
  if (cache.has(srcId(src))) return cache.get(srcId(src));
  const job = (async () => {
    const d = await wrappedSrcData(src);
    const games = seasonGames(d.games);
    const cuts = src.ad2l ? laneCuts(d.games.filter(hasDetails)) : null;
    const reads = await modelReads(src, d).catch(() => []);
    // Group stage and playoffs (lib/wrapped.js seasonResults); All puts every division's together.
    const results = src.all
      ? mergeResults(await Promise.all(Object.keys(DIVISIONS).map((k) => wrappedData(SOURCES[k]).then((x) => x.results).catch(() => null))).then((rs) => rs.filter(Boolean)))
      : src.ad2l ? seasonResults(d, { split: !!DIVISIONS[src.key]?.views && !src.view }) : null;
    // Most sandbagged: ranked pubs since the season's first series (main accounts only) and the
    // roster's current medals.
    const ranked = src.ad2l ? await pubRanked(src, d) : null;
    const since = Math.min(...d.series.map((s) => s.time).filter(Boolean));
    const awards = seasonAwards(games, { series: d.series, teams: d.teams, reads, cuts, results, ranked, since: Number.isFinite(since) ? since : null,
      ranks: new Map(d.teams.flatMap((t) => t.players.filter((q) => q.rank_tier).map((q) => [String(q.account_id), q.rank_tier]))) });
    const teamName = new Map(d.teams.map((t) => [t.id, t.name]));
    for (const [id, n] of teamName) wrappedTeamName.set(id, n);
    for (const t of d.teams) if (t.league) wrappedTeamLeague.set(t.id, t.league);
    return { d, games, cuts, awards, results, teamName, open: await unlocked(src, d).catch(() => false) };
  })();
  cache.set(srcId(src), job);
  job.catch(() => cache.delete(srcId(src)));
  return job;
}

// The model's read of every decided series (lib/wrapped-reads.js): from the deploy's
// data/wrapped-reads.json when it matches this data, else worked out here (npm start has no file).
// A division's Wrapped reads its own league's share (data/wrapped-reads-<key>.json), All the whole file.
const prebuilt = {};
const prebuiltFile = (key = "all") => (prebuilt[key] ??= fetch(key === "all" ? "data/wrapped-reads.json" : `data/wrapped-reads-${key}.json`, { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : null)).then((f) => (f?.season === SEASON.name ? f : null)).catch(() => null)
  .then((f) => f ?? (key === "all" ? null : prebuiltFile("all"))));
const prebuiltReads = (key) => prebuiltFile(key).then((f) => f?.leagues ?? null);
// Most sandbagged's ranked pubs (main accounts only): the file's cut of each division's draft
// `ranked` when it has them all from the same sync as this data (merged in the same order as
// draftDataFor), else the draft files themselves.
async function pubRanked(src, d) {
  const keys = [...new Set(src.all ? d.teams.map((t) => t.league) : [src.key])].filter((k) => DIVISIONS[k]);
  const file = await prebuiltFile(src.all ? "all" : src.key), packed = file?.ranked;
  const fresh = async (k) => packed?.[k] && file.updated?.[k] === (await wrappedSrcData(SOURCES[k])).updated;
  if ((await Promise.all(keys.map(fresh))).every(Boolean)) return Object.assign({}, ...keys.map((k) => packed[k]));
  return (await draftDataFor(keys).catch(() => null))?.ranked ?? null;
}
async function modelReads(src, d) {
  if (!src.view) {
    const ready = unpackReads((await prebuiltReads(src.key))?.[src.key], d);
    if (ready) return ready;
  }
  const file = await draftDataFor(src.all ? [...new Set(d.teams.map((t) => t.league))] : [src.key]).catch(() => null);
  return liveReads(d, file);
}

// ---------- Unlock ----------
// A league's Wrapped opens once its season is over: every bracket's grand final has a winner
// (Heroic/Aegis combined needs both; one of its views, its own). All waits for every division.
export function seasonDone(src, d) {
  return seasonOver(d, { split: !!DIVISIONS[src.key]?.views && !src.view });
}
// load: how a division's file is read (Wrapped's copy; the notice reads what the page itself loads).
async function unlocked(src, d, load = wrappedSrcData) {
  if (!src.all) return seasonDone(src, d);
  for (const k of Object.keys(DIVISIONS)) if (!seasonDone(SOURCES[k], await load(SOURCES[k]))) return false;
  return true;
}
// Locally (the dev server) a locked Wrapped still opens, under a note, so it can be tested.
const isLocal = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

// ---------- Cards ----------
// Each card: { key, tone (colour scheme 1–6), hero (background art, or null), kicker, body }.
// body is the card's inside: a big line and the lines under it.
const big = (v, unit = "") => `<div class="wr-big">${v}${unit ? `<small>${unit}</small>` : ""}</div>`;
const line = (t) => `<p class="wr-line">${t}</p>`;
// Labelled numbers, as on the preview image: [[label, value], ...] (a falsy item is left out).
const stats = (items) => `<dl class="wr-stats">${items.filter(Boolean).map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
const gold = (t) => `<b class="wr-gold">${t}</b>`;
const chips = (titles) => (titles.length ? `<p class="wr-chips">${titles.map((t) => `<span class="wr-chip">${esc(t)}</span>`).join("")}</p>` : "");
const kdaOf = (k, d, a) => ((k + a) / Math.max(d, 1)).toFixed(1);
// "#6 of 131 players in Heroic/Aegis with 3+ games", the rank in gold.
const rankLine = (rank, of, field) => line(rank === 1 ? `${gold("#1")} · the most in ${field} (${of} players with ${MIN_GAMES}+ games)` : `${gold(`#${rank}`)} of ${of} players in ${field} with ${MIN_GAMES}+ games`);

// A player's cards. scope: { name ("Champion", "AD2L"), league }: in the league scope (part 3) only
// the cards a league-wide field changes: signature, MVPs and awards won across AD2L. Every card
// carries its league's id (div) for pinning.
function playerCards(src, w, scope = { name: leagueName(src), league: false }) {
  const who = playerLink(src, w.p), pn = esc(w.p?.name ?? "?"), div = srcId(src), field = esc(scope.name);
  const cards = [];
  // Slides with their player card are numbered (pc.n), so each can show another of their designs.
  let shown = 0;
  const add = (c) => cards.push({ ...c, ...(c.pc ? { pc: { ...c.pc, n: shown++ } } : {}), div });
  if (!scope.league) {
    add({ key: "intro", tone: 1, pick: [], pc: { src, key: w.key, hero: null }, kicker: `${who}'s ${SEASON.name}`,
      body: `${big(who)}${line(esc(w.team ?? "their team"))}`, view: "season",
      views: [{ id: "season", label: "Season", body: `${stats([["Record", `${w.wins}–${w.losses} (${winPct({ n: w.wins + w.losses, w: w.wins })})`], ["Games", fmt(w.games)], ["Hours", fmt(Math.max(1, Math.round(w.minutes / 60)))], ["KDA", kdaOf(w.kills, w.deaths, w.assists)]])}${line(`${fmt(w.kills)} kills · ${fmt(w.assists)} assists · ${fmt(w.deaths)} deaths`)}` },
        { id: "game", label: "A game", body: `${stats([["Win rate", pct(w.wins / Math.max(w.games, 1))], ["Kills", (w.kills / Math.max(w.games, 1)).toFixed(1)], ["Assists", (w.assists / Math.max(w.games, 1)).toFixed(1)], ["Deaths", (w.deaths / Math.max(w.games, 1)).toFixed(1)]])}${line(`${fmt(Math.round(w.minutes / Math.max(w.games, 1)))} minutes a game, on average`)}` }] });
    if (w.finish) add(finishCard(src, w));
    if (FAV_WALLS && w.heroes5?.length) {
      const list = w.heroes5;
      const best = bestHeroOf(list, w);
      const heroList5 = (l) => `<ol class="wr-heroes wr-heroes-5">${l.map((h) => `<li class="${h === best ? "wr-best" : ""}">${heroImg(h.hero) ? `<img src="${esc(heroImg(h.hero))}" alt="" loading="lazy">` : "<span></span>"}<span class="wr-hname">${heroLink(src, h.hero)}<small>${plural(h.n, "game")} · ${kdaOf(h.k, h.d, h.a)} KDA${h === best ? ` · <b class="wr-gold">best</b>` : ""}</small></span><b class="wr-hrec">${recW(h)}</b></li>`).join("")}</ol>`;
      add({ key: "heroes", tone: 2, pick: list.map((h) => h.hero), pc: { src, key: w.key, hero: list[0].hero }, kicker: `${pn}'s heroes`,
        // Most played, or by record (Fav, 2026-11-26: switch cards).
        view: "games", views: [{ id: "games", label: "Most played", body: heroList5(list) }, { id: "record", label: "By record", body: heroList5(byRecord(list)) }],
        after: `${line(`${plural(w.heroCount, "hero")} played this season`)}${best ? line(`<span class="wr-hint">Best: game rating, record and how often it was banned against them, together.</span>`) : ""}` });
    } else if (w.heroes.length) add({ key: "heroes", tone: 2, pick: w.heroes.map((h) => h.hero), pc: { src, key: w.key, hero: w.heroes[0].hero }, kicker: `${pn}'s heroes`, view: "games",
      views: [w.heroes, byRecord(w.heroes)].map((l, i) => ({ id: i ? "record" : "games", label: i ? "By record" : "Most played", body: `<ol class="wr-heroes">${l.map((h) => `<li>${heroImg(h.hero) ? `<img src="${esc(heroImg(h.hero))}" alt="" loading="lazy">` : "<span></span>"}<span class="wr-hname">${heroLink(src, h.hero)}<small>${plural(h.n, "game")} · ${kdaOf(h.k, h.d, h.a)} KDA</small></span><b class="wr-hrec">${recW(h)}</b></li>`).join("")}</ol>` })),
      after: `${w.bestHero && w.bestHero.hero !== w.heroes[0].hero ? line(`Best: ${heroLink(src, w.bestHero.hero)} <b>${recP(w.bestHero)}</b>`) : ""}${line(`${plural(w.heroCount, "hero")} played this season`)}` });
    if (w.bans) {
      const [top, ...rest] = w.bans.heroes;
      add({ key: "bans", tone: 5, hero: top.hero, fixed: true, pc: { src, key: w.key, hero: top.hero }, kicker: `Banned against ${pn}`,
        body: `${big(esc(top.hero))}${line(`banned <b>${plural(top.n, "time")}</b> by their opponents`)}${stats([["Ban share", pct(w.bans.share)], ["Bans", fmt(w.bans.total)], ["Drafts", fmt(w.bans.drafts)]])}${line(`${gold(pct(w.bans.share))} of the other team's bans aimed at ${pn}, on average a game`)}${rest.length ? (FAV_WALLS ? `<p class="wr-line wr-then">Then ${rest.map((h) => `<span class="wr-then-h">${heroImg(h.hero) ? `<img src="${esc(heroImg(h.hero))}" alt="" loading="lazy">` : ""}${heroLink(src, h.hero)} <b>×${h.n}</b></span>`).join("")}</p>` : line(`Then ${rest.map((h) => `${heroLink(src, h.hero)} ×${h.n}`).join(" · ")}`)) : ""}` });
    }
  }
  const more = w.more ?? {};
  if (!scope.league) { const c = itemsMore(src, more.items, pn, field); if (c) add(c); }
  if (w.signature) {
    const s = w.signature;
    add({ key: "signature", tone: 3, pick: [], kicker: `${pn}'s signature${scope.league ? " across AD2L" : ""}`,
      body: `${big(num(s.value, s.fmt))}${line(`<b>${esc(s.label)}</b>`)}${rankLine(s.rank, s.of, field)}${FAV_WALLS && w.sigMore ? sigMoreHtml(s, w.sigMore, field) : ""}` });
  }
  if (!scope.league && w.best) {
    const { m, p } = w.best, opp = p.team === "a" ? m.team_b : m.team_a;
    add({ key: "best", tone: 4, hero: p.hero, fixed: true, game: m, pc: { src, key: w.key, hero: p.hero }, kicker: `${pn}'s ${w.best.won ? "best" : "biggest"} game`,
      body: `${big(`${p.kills}/${p.deaths}/${p.assists}`)}${line(`${heroLink(src, p.hero)} vs ${esc(opp)}`)}${stats([["Damage", fmt(p.hero_damage)], ["GPM", fmt(p.gpm)], ["Minutes", fmt(Math.round(m.duration_sec / 60))]])}${line(`<a href="${src.root}/game/${esc(m.id)}">Open the game ›</a>`)}` });
  }
  if (!scope.league && w.ratings) add(ratingCard(src, w, pn));
  const clip = !scope.league && clipOf(w.key);
  if (clip) add({ key: "clip", tone: 4, ...(w.clipHero ? { hero: w.clipHero, fixed: true } : { hero: null }), kicker: `${pn}'s top play`, body: clipHtml(clip) });
  if (!scope.league) { const c = highlightsCard(w, pn, !more.early); if (c) add(c); }
  if (!scope.league) for (const c of [earlyMore(more.early, pn, field), fightMore(more.fight, pn, field)]) if (c) add(c);
  if (!scope.league && w.playoffs) add(playoffsCard(src, w));
  if (!scope.league) { const c = clutchMore(more.clutch, pn); if (c) add(c); }
  if (scope.league) { const c = everyDivMore(w.everyDiv, pn); if (c) add(c); }
  const mvpAward = w.awards.find((a) => a.key === "mvp");
  if (FAV_WALLS && !scope.league && w.mvps && w.mvpWhy) add(mvpCard(src, w, field, mvpAward));
  else if (w.mvps && (!scope.league || w.mvpRank)) add({ key: "mvps", tone: 5, pick: [], kicker: scope.league ? "MVPs across AD2L" : "Game MVPs",
    body: `${big(fmt(w.mvps), w.mvps === 1 ? "MVP" : "MVPs")}${line(`in ${plural(w.games, "game")}, ${pct(w.mvps / w.games)} of them`)}${w.mvpRank ? line(w.mvpRank === 1 ? `${gold("#1")} · more than anyone in ${field}` : `${gold(`#${w.mvpRank}`)} of ${w.ranked} in ${field}`) : ""}` });
  // A won award keeps its hero when it's the award's subject (the duo); else its stat's hero first.
  for (const a of w.awards) if (!(FAV_WALLS && !scope.league && a.key === "mvp" && w.mvpWhy)) add({ ...awardCard(src, a, null), ...(a.key === "duo" ? { fixed: true } : { pick: [a.p?.hero] }), key: `award:${a.key}`, kicker: `${pn} won ${esc(a.title)}${scope.league ? " across AD2L" : ""}` });
  // Across AD2L (part 2) carries on from the division's slides (part 1), so it doesn't reuse theirs.
  if (scope.league) return spreadHeroes(cards, w, playerCards(src, w));
  if (w.lane?.lanes) {
    const l = w.lane;
    add({ key: "lane", tone: 6, pick: [], kicker: `${pn}'s laning · ${esc(lane(l.group))}`,
      body: `${big(`${l.won}–${l.even}–${l.lost}`)}${line("lanes won, even and lost")}${stats([["Lanes won", pct(l.won / Math.max(l.lanes, 1))], FAV_WALLS && ["Lanes lost", pct(l.lost / Math.max(l.lanes, 1))], l.margin != null && ["At 10 min", signedK(l.margin)]])}${l.margin != null ? line("gold + XP ahead at 10 minutes, on average") : ""}` });
  }
  { const c = farmMore(src, more.farm, pn, field) ?? assistMore(src, more.assists, pn, field); if (c) add(c); }
  for (const r of w.records ?? []) add(recordCard(src, r, w.key, pn));
  for (const c of [visionMore(more.vision, pn, field), mapMore(more.map, pn, field), siegeMore(more.siege, pn, field)]) if (c) add(c);
  if (w.nemesis) add({ key: "nemesis", tone: 2, hero: w.nemesis.hero, fixed: true, kicker: `${pn}'s nemesis`,
    body: `${big(esc(w.nemesis.hero))}${line(`beat ${pn} <b>${w.nemesis.lost}</b> of ${plural(w.nemesis.n, "time")} they faced it`)}${stats([["Faced", fmt(w.nemesis.n)], ["Lost", fmt(w.nemesis.lost)]])}${FAV_WALLS && w.nemesisMore ? nemesisMoreHtml(src, w, pn) : ""}` });
  if (w.hit) {
    const { m, p } = w.hit, opp = p.team === "a" ? m.team_b : m.team_a;
    add({ key: "hit", tone: 5, hero: p.hero, fixed: true, game: m, pc: { src, key: w.key, hero: p.hero }, kicker: `${pn}'s biggest hit`,
      body: `${big(fmt(w.hit.damage), "damage")}${line(`<b>${esc(hitText([w.hit.damage, w.hit.source, w.hit.target]))}</b>`)}${line(`their hardest single hit of the season, playing ${heroLink(src, p.hero)} vs ${esc(opp)}`)}${line(`<a href="${src.root}/game/${esc(m.id)}">Open the game ›</a>`)}${FAV_WALLS && w.hits?.length > 1 ? heroRows(src, w.hits.slice(1).map((x, i) => ({ ...x, hero: x.p.hero, i })), (x) => fmt(x.damage), (x) => `${["2nd", "3rd"][x.i]} · ${esc(hitText([x.damage, x.source, x.target]))}`) : ""}` });
  }
  if (w.dead?.seconds >= 60) add(deadCard(src, w, pn));
  { const c = handsMore(more.hands, pn, field); if (c) add(c); }
  if (w.personality) {
    const t = w.personality;
    add({ key: "personality", tone: 4, pick: [], kicker: `${pn}'s Dota personality`,
      body: `<p class="wr-reveal">${pn} is</p>${big(esc(t.title))}${line(esc(t.blurb))}${stats(t.traits.map((x) => [x.label.replace(/^of /, ""), num(x.value, x.fmt)]))}${line(`${t.traits.filter((x, i) => !i || x.top <= 0.5).map((x, i) => `${gold(`${i ? "top" : "Top"} ${Math.max(1, Math.ceil(x.top * 100))}%`)} for ${esc(x.label.replace(/^of /, ""))}`).join(" · ")}, of ${t.of} players in ${field}`)}${FAV_WALLS && t.traits.some((x) => x.key === "stacks") && w.mostStacks?.p.camps_stacked ? line(`Most in one game: ${gold(`${w.mostStacks.p.camps_stacked} stacks`)} on ${esc(w.mostStacks.p.hero)}.`) : ""}` });
  }
  add({ key: "summary", tone: 1, pick: [], kicker: `${who} · ${SEASON.name} Wrapped`,
    body: `<dl class="wr-summary">
      <div><dt>Record</dt><dd>${w.wins}–${w.losses} (${winPct({ n: w.wins + w.losses, w: w.wins })})</dd></div>
      ${w.finish?.playoff ? `<div><dt>Finish</dt><dd>${esc(w.finish.playoff.label.replace("Still in the playoffs", "Still in"))}</dd></div>` : w.finish?.group ? `<div><dt>Group stage</dt><dd>#${w.finish.group.rank}</dd></div>` : ""}
      ${FAV_WALLS ? summaryRows(w) : `<div><dt>Top hero</dt><dd>${w.heroes[0] ? esc(w.heroes[0].hero) : "—"}</dd></div>
      <div><dt>MVPs</dt><dd>${fmt(w.mvps)}</dd></div>
      <div><dt>KDA</dt><dd>${kdaOf(w.kills, w.deaths, w.assists)}</dd></div>
      ${w.personality ? `<div class="wide"><dt>Personality</dt><dd>${esc(w.personality.title)}</dd></div>` : ""}
      ${w.signature ? `<div class="wide"><dt>Signature</dt><dd>${num(w.signature.value, w.signature.fmt)} ${esc(w.signature.label)}</dd></div>` : ""}`}
    </dl>${chips(w.awards.map((a) => a.title))}` });
  return spreadHeroes(cards, w);
}
// The best of the top five (Fav, 2026-11-25: "rating, record, how often it was a targeted ban;
// combine those", no games gate). Each hero scores on:
//   rating: its average game rating, pulled toward their own average by 8 games' worth, then
//           0.5 + (that - their average) / 20 (so 10 points above them reads 1);
//   record: its win rate, pulled toward their own win rate by 8 games' worth;
//   bans:   share of their drafted games it was banned at them (lib/wrapped.js targetedBans),
//           over 25%: banned at them in a quarter of their games counts as fully targeted.
// The pull keeps a 1-game hero from winning on one big night (Icarus's 1-0 Tusk).
// Weights 0.4 / 0.4 / 0.2; with no ratings (unparsed, under 3 games) record 0.7, bans 0.3.
const PULL = 8, BANNED = 0.25;
function bestHeroOf(list, w) {
  if (list.length < 2) return null;
  const pts = w.ratings ?? [], avg = pts.length ? pts.reduce((a, x) => a + x.rating, 0) / pts.length : null;
  const wr = w.games ? w.wins / w.games : 0.5;
  const rating = (h) => {
    const r = pts.filter((x) => x.p.hero === h.hero);
    const v = (r.reduce((a, x) => a + x.rating, 0) + PULL * avg) / (r.length + PULL);
    return Math.max(0, Math.min(1, 0.5 + (v - avg) / 20));
  };
  const record = (h) => (h.w + PULL * wr) / (h.n + PULL);
  const ban = (h) => Math.min(1, w.bans?.drafts ? (w.bans.byHero?.[h.hero] ?? 0) / w.bans.drafts / BANNED : 0);
  const score = (h) => (avg == null ? 0.7 * record(h) + 0.3 * ban(h) : 0.4 * rating(h) + 0.4 * record(h) + 0.2 * ban(h));
  return list.reduce((a, h) => (score(h) > score(a) ? h : a));
}
// The new summary's rows after Record/Finish: two columns all the way down (Fav, 2026-11-25:
// "add 3 more lines to the right side"). Left: top hero, KDA, personality, signature.
// Right: heroes played, MVPs, hours, biggest hit.
function summaryRows(w) {
  const cell = (dt, dd) => (dd == null ? "" : `<div><dt>${dt}</dt><dd>${dd}</dd></div>`);
  const left = [
    cell("Top hero", w.heroes[0] ? esc(w.heroes[0].hero) : "—"),
    cell("KDA", kdaOf(w.kills, w.deaths, w.assists)),
    w.personality && cell("Personality", esc(w.personality.title)),
    w.signature && cell("Signature", `${num(w.signature.value, w.signature.fmt)} ${esc(w.signature.label)}`),
  ].filter(Boolean);
  const right = [
    cell("Heroes played", fmt(w.heroCount)),
    cell("MVPs", fmt(w.mvps)),
    cell("Hours played", fmt(Math.max(1, Math.round(w.minutes / 60)))),
    w.hit && cell("Biggest hit", fmt(w.hit.damage)),
  ].filter(Boolean);
  let out = "";
  for (let i = 0; i < Math.max(left.length, right.length); i++) out += (left[i] ?? "<div></div>") + (right[i] ?? "<div></div>");
  return out;
}
// Each slide's hero (its art and its Fantasy card), so a player's slides take turns with the heroes
// they played instead of repeating their most played one. A slide whose hero is its subject (bans,
// best game, nemesis, the duo) keeps it. Every other slide (c.pick: its own picks, best first) takes
// the least-shown of its picks, then of every hero they played (most played first), so a hero comes
// back only once every one of theirs has been shown. Slides with picks of their own choose first.
// before: slides already shown (part 1, for part 2).
function spreadHeroes(cards, w, before = []) {
  const shown = new Map(), show = (h) => h && shown.set(h, (shown.get(h) ?? 0) + 1);
  for (const c of before) show(c.hero);
  for (const c of cards) if (c.fixed) show(c.hero);
  for (const c of [...cards.filter((x) => x.pick?.length), ...cards.filter((x) => x.pick && !x.pick.length)]) {
    if (!c.pick) continue;
    let h = null;
    for (const x of [...c.pick, ...(w.played ?? [])]) if (x && (h == null || (shown.get(x) ?? 0) < (shown.get(h) ?? 0))) h = x;
    // A hero already shown comes back as a backdrop, not the model (cardHtml): c.repeat, its nth return.
    if (h && shown.get(h)) c.repeat = shown.get(h);
    show(h);
    c.hero = h;
    c.flex = true; // its hero is a choice, not its subject: the backgrounds may swap it (assignWalls)
    // The Fantasy card turns to it too, unless it's the card as they saved it (the intro).
    if (c.pc?.hero != null) c.pc = { ...c.pc, hero: h };
    delete c.pick;
  }
  return cards;
}
// The scope a league's cards are ranked in: All is the league (part 3), anything else a division.
const scopeOf = (src) => (src.all ? { name: "AD2L", league: true } : { name: leagueName(src), league: false });

// The team's season: how it finished, its group stage, its playoff run.
const teamOf = (src, id) => teamLink(src, wrappedTeamName.get(id) ?? "?", id);
function finishCard(src, w) {
  const { group: g, playoff: po } = w.finish;
  const champ = po?.place === 1;
  const where = g ? `${gold(`#${g.rank}`)} of ${g.of} in the group stage${g.division ? ` (Division ${esc(g.division)})` : ""}` : "";
  const out = po?.out ? line(`Out in the ${esc(po.out.label.toLowerCase())} to ${teamOf(src, po.out.by)}${po.out.score ? `, ${po.out.score[1]}–${po.out.score[0]}` : ""}`) : "";
  return { key: "finish", tone: champ ? 4 : 6, pick: [], kicker: `${esc(w.team ?? "Their team")}'s ${SEASON.name}`,
    body: `${big(po ? esc(po.label) : "Group stage")}${line(po ? `${po.bracket ? `${esc(po.bracket)} bracket` : "Playoffs"}${champ ? " · won it all" : ""}` : "Missed the playoffs")}${chips(champ ? [po.bracket ? `${po.bracket} champions` : "Champions"] : [])}${stats([g && ["Group games", `${g.gw}–${g.gl}`], g && ["Group series", `${g.w}–${g.t ? `${g.t}–` : ""}${g.l}`], po && ["Playoffs", `${po.w}–${po.l}`]])}${where ? line(where) : ""}${out}` };
}
// Their playoff games against their group-stage ones.
function playoffsCard(src, w) {
  const po = w.playoffs, gr = w.group, top = po.heroes[0];
  const kda = kdaOf(po.kills, po.deaths, po.assists), gk = gr ? kdaOf(gr.kills, gr.deaths, gr.assists) : null;
  const vs = (a, b, what) => (b == null ? "" : `${what} ${a > b ? "up" : a < b ? "down" : "level"} from ${b}`);
  return { key: "playoffs", tone: 2, pick: po.heroes.map((h) => h.hero), pc: { src, key: w.key, hero: top?.hero ?? null }, kicker: `${esc(w.p?.name ?? "?")}'s playoffs`,
    body: `${big(`${po.wins}–${po.games - po.wins}`, "in playoff games")}${stats([["KDA", kda], ["MVPs", fmt(po.mvps)], ["Win %", pct(po.wins / po.games)]])}${gr ? line(`${vs(Number(kda), Number(gk), "KDA")} in the group stage; win rate ${pct(gr.wins / gr.games)} there.`) : ""}${top ? line(`Most played: ${heroLink(src, top.hero)} <b>${top.w}–${top.n - top.w}</b>`) : ""}` };
}
// Their game rating, game by game (w.ratings, from ratingsOf), as a line with the peak and the low.
function ratingCard(src, w, pn) {
  const pts = w.ratings, peak = pts.reduce((a, b) => (b.rating > a.rating ? b : a)), low = pts.reduce((a, b) => (b.rating < a.rating ? b : a));
  const avg = pts.reduce((s, x) => s + x.rating, 0) / pts.length, top = pts.filter((x) => x.tier === "S").length;
  const W = 480, H = 130, pad = 14, x = (i) => pad + (i * (W - 2 * pad)) / Math.max(pts.length - 1, 1), y = (r) => H - pad - ((r / 100) * (H - 2 * pad));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join("");
  const at = (p) => pts.indexOf(p);
  const opp = (p) => esc(p.p.team === "a" ? p.m.team_b : p.m.team_a);
  const svg = `<svg class="wr-line-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Game rating in each of ${pts.length} games, peak ${Math.round(peak.rating)}">
      <line class="wr-lc-avg" x1="${pad}" x2="${W - pad}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}"/>
      <path class="wr-lc-area" d="${path}L${x(pts.length - 1).toFixed(1)},${H - pad}L${pad},${H - pad}Z"/>
      <path class="wr-lc-path" d="${path}" pathLength="1"/>
      <circle class="wr-lc-low" cx="${x(at(low)).toFixed(1)}" cy="${y(low.rating).toFixed(1)}" r="4"/>
      <circle class="wr-lc-peak" cx="${x(at(peak)).toFixed(1)}" cy="${y(peak.rating).toFixed(1)}" r="6"/>
    </svg>`;
  return { key: "rating", tone: 3, ...(FAV_WALLS ? { hero: peak.p.hero, fixed: true } : { pick: [peak.p.hero] }), game: peak.m, kicker: `${pn}'s season in one line`,
    body: `${big(fmt(Math.round(peak.rating)), "peak rating")}${svg}${line(`Peak: ${heroLink(src, peak.p.hero)} vs ${opp(peak)} · <a href="${src.root}/game/${esc(peak.m.id)}">game ${at(peak) + 1}</a>`)}${stats([["Average", fmt(Math.round(avg))], ["S-tier games", fmt(top)], ["Low", fmt(Math.round(low.rating))]])}` };
}
// Multi-kills, their longest kill streak and first bloods. Null when there's nothing to show.
// fb: show first bloods. Off when the most-active-time slide is in the story: it has them, beside "Died first".
function highlightsCard(w, pn, fb = true) {
  const h = w.highlights;
  if (!h) return null;
  const fbs = fb ? h.firstBloods : 0;
  const topI = h.multi.findLastIndex((n) => n > 0);
  if (topI < 0 && h.streak < 3 && !fbs) return null;
  const head = topI >= 0 ? big(fmt(h.multi[topI]), `${MULTI[topI].toLowerCase()}${h.multi[topI] === 1 ? "" : "s"}`) : h.streak >= 3 ? big(esc(streakName(h.streak))) : big(fmt(fbs), fbs === 1 ? "first blood" : "first bloods");
  return { key: "highlights", tone: 6, pick: [], kicker: `${pn}'s highlight reel`,
    body: `${head}${stats(["Doubles", "Triples", "Ultras", "Rampages"].map((label, i) => [label, fmt(h.multi[i])]))}${h.streak >= 3 ? line(`Longest streak: ${gold(esc(streakName(h.streak)))} (${h.streak === 10 ? "10+" : h.streak} kills without dying)`) : ""}${fbs ? line(`Drew first blood ${gold(plural(fbs, "time"))}`) : ""}` };
}
// Time spent dead, with something it'd have covered.
const hm = (s) => { const t = Math.round(s / 60), h = Math.floor(t / 60), m = t % 60; return h ? `${h}<small>h</small> ${m}<small>m</small>` : `${m}<small>m</small>`; };
const ms = (s) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
function deadCard(src, w, pn) {
  const d = w.dead, min = d.seconds / 60, opp = d.worst.p.team === "a" ? d.worst.m.team_b : d.worst.m.team_a;
  const like = min >= 100 ? `About ${plural(Math.round(min / 110), "full movie")} of grey screen.` : min >= 20 ? `That's ${plural(Math.round(min / 22), "sitcom episode")}.` : `Barely long enough to make a sandwich.`;
  return { key: "dead", tone: 2, pick: [], kicker: `${pn}'s time in the grey`,
    body: `<div class="wr-big wr-big-time">${hm(d.seconds)}</div>${line("spent dead this season, waiting to respawn")}${line(like)}${stats([["Of game time", pct(d.seconds / Math.max(1, w.minutes * 60))], ["A game", ms(d.seconds / d.games)]])}${line(`Most in one game: <b>${ms(d.worst.seconds)}</b> on ${heroLink(src, d.worst.p.hero)} vs ${esc(opp)}`)}${FAV_WALLS && w.deadRole ? line(`${gold(ms(d.seconds / d.games))} a game, against ${ms(w.deadRole.perGame)} for ${leagueName(src)}'s ${POSN[w.deadRole.pos] ?? "players"} (${w.deadRole.of} of them).`) : ""}` };
}
// ---------- Fav's feedback (2026-11-24, public/_dev/wrapped-feedback.md), new version only ----------
// Signature: its best single game and the division's average; kills add their share and multi-kills.
function sigMoreHtml(s, x, field) {
  const v = (n) => (s.fmt !== "%" && Number.isInteger(n) ? fmt(n) : num(n, s.fmt));
  return `${stats([x.best && ["Best game", v(x.best.v)], ["Average", v(x.avg)], x.share != null && ["Kill share", pct(x.share)]])}${x.best ? line(`Best game: <b>${v(x.best.v)}</b> on ${esc(x.best.p.hero)} vs ${esc(x.best.p.team === "a" ? x.best.m.team_b : x.best.m.team_a)}. Average in ${field}: ${v(x.avg)}.`) : ""}${x.multi?.some(Boolean) ? line(`${x.multi.map((n, i) => (n ? `${fmt(n)} ${["double", "triple", "ultra", "rampage"][i]}${n === 1 ? "" : "s"}` : "")).filter(Boolean).join(" · ")}`) : ""}`;
}
// One MVP slide: the count, what earns one (the site's rule), their numbers in those three against
// the division's average, their best MVP game, and the season MVP award as a chip when they won it.
function mvpCard(src, w, field, award) {
  // Each bar on a fixed scale (shares top out near half the team; kill participation at all of it),
  // the division's average as a tick on it.
  const y = w.mvpWhy, at = (v, max) => Math.min(100, Math.round((v / max) * 100));
  const row = (label, mine, avg, max) => `<div class="wr-trait"><span>${label}</span><i class="wr-vs"><b style="width:${at(mine, max)}%"></b><em style="left:${at(avg, max)}%" title="${field.replace(/<[^>]*>/g, "")} average ${pct(avg)}"></em></i><span>${pct(mine)}</span></div>`;
  const b = y.best, opp = b && (b.p.team === "a" ? b.m.team_b : b.m.team_a);
  return { key: "mvps", tone: 5, pick: y.topHero ? [y.topHero[0]] : [], kicker: "Game MVPs",
    body: `${big(fmt(w.mvps), w.mvps === 1 ? "MVP" : "MVPs")}${line(`in ${plural(w.games, "game")}, ${pct(w.mvps / w.games)} of them${w.mvpRank ? (w.mvpRank === 1 ? ` · ${gold("#1")} in ${field}` : ` · ${gold(`#${w.mvpRank}`)} of ${w.ranked} in ${field}`) : ""}`)}${line('<span class="wr-hint">A game’s MVP: the winner with the best average of damage share, kill participation and net-worth share.</span>')}<div class="wr-traits">${row("Damage share", y.me.dmg, y.avg.dmg, 0.5)}${row("Kill participation", y.me.kp, y.avg.kp, 1)}${row("Net-worth share", y.me.nw, y.avg.nw, 0.5)}</div>${line(`<span class="wr-hint">White tick: the ${field} average (${pct(y.avg.dmg)} · ${pct(y.avg.kp)} · ${pct(y.avg.nw)}).</span>`)}${b ? line(`Best MVP game: ${heroLink(src, b.p.hero)} vs ${esc(opp)}, ${b.p.kills}/${b.p.deaths}/${b.p.assists} · <a href="${src.root}/game/${esc(b.m.id)}">open ›</a>`) : ""}${chips(award ? [`${SEASON.name} MVP · ${award.value} in ${award.games} games`] : [])}` };
}
// Nemesis: every game against it as a strip (their own hero, won or lost, oldest first, each a
// link to the game; a win is "the one that got away"), their KDA against it next to their season's
// as two bars, who was on it, and the runner-up as a small strip.
function nemesisMoreHtml(src, w, pn) {
  const x = w.nemesisMore;
  const name = (h) => HERO_META.find(([n]) => n === h)?.[1] ?? h;
  const tile = (g) => `<a class="wr-nm-g ${g.won ? "is-w" : "is-l"}" href="${src.root}/game/${esc(g.id)}" title="${esc(name(g.hero))} · ${g.won ? "won" : "lost"}">${heroImg(g.hero) ? `<img src="${esc(heroImg(g.hero))}" alt="" loading="lazy">` : `<span>${esc(name(g.hero))}</span>`}<b>${g.won ? "W" : "L"}</b></a>`;
  const strip = x.strip?.length ? `<div class="wr-nm-strip">${x.strip.map(tile).join("")}</div>${x.win ? line(`<span class="wr-hint">Green: the one that got away, won on ${esc(name(x.win.p.hero))}. Each links to its game.</span>`) : line('<span class="wr-hint">Every game against it, oldest first. Each links to its game.</span>')}` : "";
  const max = Math.max(x.kdaVs, x.kdaAll, 0.1);
  const bar = (label, v, cls) => `<div class="wr-trait"><span>${label}</span><i><b class="${cls}" style="width:${Math.round((v / max) * 100)}%"></b></i><span>${v.toFixed(1)}</span></div>`;
  const kda = `<div class="wr-traits">${bar("KDA vs it", x.kdaVs, "wr-nm-bad")}${bar("KDA all season", x.kdaAll, "wr-nm-all")}</div>`;
  const next = x.next ? `<div class="wr-nm-next">${heroImg(x.next.hero) ? `<img src="${esc(heroImg(x.next.hero))}" alt="" loading="lazy">` : ""}<span>Then ${heroLink(src, x.next.hero)}</span><span class="wr-nm-pips">${(x.next.strip ?? []).map((g) => `<a class="${g.won ? "is-w" : "is-l"}" href="${src.root}/game/${esc(g.id)}" title="${esc(name(g.hero))} · ${g.won ? "won" : "lost"}"></a>`).join("")}</span><span class="wr-hint">${x.next.lost} losses in ${x.next.n}</span></div>` : "";
  return `${strip}${kda}${x.who.length ? line(`Played by ${x.who.slice(0, 3).map(([n, k]) => `<b>${esc(n)}</b>${k > 1 ? ` ×${k}` : ""}`).join(", ")}.`) : ""}${next}`;
}

// Part 2, performance (Fav: "a team performance card, then a division performance card, then a
// league performance card"), in place of the old "across AD2L" part.
const rankFmt = (r) => (r.name === "KDA" || r.name === "Kills" ? r.value.toFixed(1) : fmt(Math.round(r.value)));
const perfTable = (cols, rows) => `<table class="wr-table"><tr><th>Stat</th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${rows.map(([name, cells]) => `<tr><td>${name}</td>${cells.map((x) => `<td class="${x?.rank === 1 ? "wr-best" : ""}">${x == null ? "–" : typeof x === "string" ? x : `#${x.rank}/${x.of}`}</td>`).join("")}</tr>`).join("")}</table>`;
function performanceCards(home, wDiv, wAll, pn) {
  const out = [], perf = wDiv?.perf, dname = home ? leagueName(home) : "AD2L";
  const t = perf?.team;
  if (t) {
    const top = [...t.ranks].sort((a, b) => a.rank - b.rank)[0];
    out.push({ key: "perf-team", tone: 3, pick: [], kicker: `${pn} in ${esc(t.name)}`,
      body: `${big(t.share.kills != null ? pct(t.share.kills) : `#${top.rank}`, t.share.kills != null ? "of the team's kills" : `in ${esc(top.name)}`)}${stats([t.share.damage != null && ["Damage share", pct(t.share.damage)], t.share.gold != null && ["Gold share", pct(t.share.gold)]])}${perfTable(["Fav", "In the team"].map((c, i) => (i ? c : pn)), t.ranks.map((r) => [esc(r.name), [rankFmt(r), r]]))}${line(`<span class="wr-hint">Against the ${t.of} players with ${MIN_GAMES}+ parsed games for ${esc(t.name)}.</span>`)}` });
  }
  if (perf?.division) {
    const d = perf.division, s = wDiv.signature;
    out.push({ key: "perf-division", tone: 5, pick: [], kicker: `${pn} in ${dname}`,
      body: `${s ? `${big(`#${s.rank}`, `of ${s.of}`)}${line(`for ${esc(s.label)} (${num(s.value, s.fmt)}), their best rank in ${dname}.`)}` : big(dname)}${d.posRanks ? "" : perfTable(["All"], d.ranks.map((r) => [esc(r.name), [r]]))}`,
      // Everyone, or only their role (Fav, 2026-11-26: switch cards).
      ...(d.posRanks ? { view: "all", views: [{ id: "all", label: "Everyone", body: perfTable(["All"], d.ranks.map((r) => [esc(r.name), [r]])) },
        { id: "role", label: `${esc(POSN[d.pos] ?? "Role")}`, body: perfTable([`${esc(POSN[d.pos] ?? "Role")}`], d.ranks.map((r, i) => [esc(r.name), [d.posRanks[i]]])) }] } : {}),
      after: `${chips([wDiv.mvpRank && `#${wDiv.mvpRank} of ${wDiv.ranked} for MVPs`, wDiv.personality && wDiv.personality.title].filter(Boolean))}` });
  }
  if (wAll) {
    const s = wAll.signature, e = wAll.everyDiv;
    out.push({ key: "perf-league", tone: 6, pick: [], kicker: `${pn} across AD2L`,
      body: `${s ? `${big(num(s.value, s.fmt))}${line(`<b>${esc(s.label)}</b> · ${gold(`#${s.rank}`)} of ${s.of} players in AD2L`)}` : big("AD2L")}${e ? `<table class="wr-table"><tr><th>If they played in</th>${e.stats.map((x) => `<th>${esc(x)}</th>`).join("")}</tr>${e.rows.map((r) => `<tr class="${r.home ? "me" : ""}"><td>${esc(r.name)}</td>${r.ranks.map((x) => `<td class="${x.rank === 1 ? "wr-best" : ""}">#${x.rank}/${x.of}</td>`).join("")}</tr>`).join("")}</table>${line(`<span class="wr-hint">Ranked against each division's ${POSN[e.pos] ?? "players"}. Their division in gold.</span>`)}` : ""}${chips([wAll.mvpRank && `#${wAll.mvpRank} of ${wAll.ranked} in AD2L for MVPs`].filter(Boolean))}` });
  }
  return out;
}

// ---------- More cards (lib/wrapped-more.js) ----------
// Each takes the player's w.more piece (null when the card doesn't fit them) and returns a card or null.
// "#4 of 54 in Champion" as a chip.
const rankChip = (r, what, field) => (r ? chips([`#${r.rank} of ${r.of} ${what}${field ? ` in ${field.replace(/<[^>]*>/g, "")}` : ""}`]) : "");
const crosses = (pts) => pts.map(([x, y]) => `<g transform="translate(${x} ${mapY(y)})" stroke="#ff4f6b" stroke-width=".6" opacity=".75"><line x1="-1.2" y1="-1.2" x2="1.2" y2="1.2"/><line x1="1.2" y1="-1.2" x2="-1.2" y2="1.2"/></g>`).join("");
function visionMore(v, pn, field) {
  if (!v) return null;
  const g = Math.max(1, v.games ?? 1);
  return { key: "m-vision", tone: 6, pick: [], kicker: `${pn}'s vision`, view: "season",
    views: [{ id: "season", label: "Season", body: `${big(fmt(v.total), "observers")}${line(`${gold(pct(v.unfound))} never found · ${fmt(v.dewards)} enemy wards killed`)}` },
      { id: "game", label: "A game", body: `${big((v.total / g).toFixed(1), "observers a game")}${line(`${gold(pct(v.unfound))} never found · ${(v.dewards / g).toFixed(1)} enemy wards killed a game`)}` }],
    body: "", after: `${mapHtml(v.wards.map((w) => `<circle cx="${w.x}" cy="${mapY(w.y)}" r="${w.killed ? 0.9 : 1.1}" fill="${w.killed ? "#ff4f6b" : "#1ed760"}" opacity="${w.killed ? 0.5 : 0.6}"/>`).join("") + ring(v.spot, 6, "#2fd4ff"))}${line(`Circle: their spot, ${v.spot.n} wards. Green: never found. Red: dewarded.${v.bestNight ? ` Best night: ${v.bestNight.n} dewards on ${esc(v.bestNight.hero)}.` : ""}`)}${rankChip(v.rank, "for observers a game", field)}` };
}
function fightMore(f, pn, field) {
  if (!f) return null;
  const g = Math.max(1, f.games ?? 1);
  return { key: "m-fight", tone: 1, pick: [], kicker: `${pn} in the fight`, view: "season",
    body: `${big(pct(f.share))}${line(`of their team's fights joined, against ${pct(f.rank?.avg ?? 0)} for the average player in ${field}`)}`,
    views: [{ id: "season", label: "Season", body: stats([["Stun time", `${(f.stuns / 60).toFixed(1)} min`], ["Damage soaked", kShort(f.soaked)]]) },
      { id: "game", label: "A game", body: stats([["Stun time", `${Math.round(f.stuns / g)} s`], ["Damage soaked", kShort(Math.round(f.soaked / g))]]) }],
    after: `${rankChip(f.rank, "for fights joined", field)}${f.deaths ? `${mapHtml(crosses(f.deaths.pts) + `<circle cx="${f.deaths.spot.x}" cy="${mapY(f.deaths.spot.y)}" r="9" fill="none" stroke="#fff" stroke-width=".8" stroke-dasharray="1.6 1.2"/>`)}${line(`${f.deaths.spot.n} of their ${fmt(f.deaths.pts.length)} teamfight deaths happened in the same patch of map.`)}` : ""}` };
}
const perMin = (r) => (r >= 1 ? r.toFixed(1) : r.toFixed(2));
// Heroes by record: win rate, then more games first. A list's own order breaks ties.
const byRecord = (list) => [...list].sort((a, b) => b.w / b.n - a.w / a.n || b.n - a.n);
function earlyMore(e, pn, field) {
  if (!e) return null;
  const lbl = (i) => (i === 8 ? "40+" : `${i * 5}`), span = (i) => (i === 8 ? "40+" : `${i * 5}–${i * 5 + 5}`), what = e.assists ? "kills and assists" : "kills";
  const when = e.early > 0.45 ? `${pct(e.early)} before 15:00. An early-game menace.` : e.early < 0.25 ? `Only ${pct(e.early)} before 15:00. Wakes up late.` : `${pct(e.early)} of them came before 15:00.`;
  const bars = (v, peak) => { const mx = Math.max(...v) || 1; return `<div class="wr-bars">${v.map((n, i) => `<i class="${i === peak ? "hi" : ""}" style="height:${(n / mx) * 100}%"><span>${lbl(i)}</span></i>`).join("")}</div>`; };
  const fb = [["First bloods", fmt(e.fb)], ["Died first", fmt(e.fd)]], hint = (t) => line(`<span class="wr-hint">${t}${e.assists ? " Assist times are estimated from the teamfights they dealt damage in." : ""}</span>`);
  // A minute: their rate in each stretch, so long games don't win it. A game: what a game holds in
  // each stretch, games that ended before it counting 0 (Fav, 2026-11-26: "a game vs a minute").
  return { key: "m-early", tone: 1, pick: [], kicker: `${pn}'s most active time`, view: "min",
    views: [{ id: "game", label: "A game", body: `${big(span(e.peakGame), "min")}${line(`Their biggest stretch: ${e.perGame[e.peakGame].toFixed(1)} ${what} a game. ${when}`)}${bars(e.perGame.slice(0, 8), e.peakGame)}${stats([["Kills/game", e.kpg.toFixed(1)], ["Assists/game", e.apg.toFixed(1)], ...fb])}${rankChip(e.rankGame, "for kills + assists a game", field)}${hint(`Then ${e.perGame[8].toFixed(1)} a game after 40:00. Every game counts in every stretch, so late ones drop when games end early.`)}` },
      { id: "min", label: "A minute", body: `${big(span(e.peak), "min")}${line(`Their busiest stretch: ${perMin(e.rate[e.peak])} ${what} a minute. ${when}`)}${bars(e.rate, e.peak)}${stats([["Kills/min", e.kpm.toFixed(2)], ["Assists/min", e.apm.toFixed(2)], ...fb])}${rankChip(e.rank, "for kills + assists a minute", field)}${hint("Each stretch over the minutes played in it.")}` }] };
}
function mapMore(a, pn, field) {
  if (!a) return null;
  const head = { stacks: [fmt(a.stacks), "stacks", a.mostStacks ? `Most in one game: ${a.mostStacks.n} on ${esc(a.mostStacks.hero)}.${a.ancients ? ` ${fmt(a.ancients)} ancients killed.` : ""}` : ""],
    runes: [fmt(a.runes), "runes", a.runeTypes[0] ? `Favourite: ${esc(a.runeTypes[0].name)}, ${a.runeTypes[0].n} times.` : ""],
    smoke: [fmt(a.smoke), "smoke kills", "Kills out of a Smoke of Deceit."] }[a.lead];
  const r = a.ranks[a.lead], mx = a.runeTypes[0]?.n ?? 1;
  return { key: "m-map", tone: 5, pick: [], kicker: "The work nobody sees",
    body: `${big(head[0], head[1])}${head[2] ? line(head[2]) : ""}${rankChip(r, `for ${head[1]}`, field)}${stats([a.lead !== "stacks" && ["Stacks", fmt(a.stacks)], a.lead !== "runes" && ["Runes", fmt(a.runes)], a.lead !== "smoke" && ["Smoke kills", fmt(a.smoke)]])}${a.runeTypes.length ? `<div class="wr-hbars">${a.runeTypes.map((t) => `<span>${esc(t.name)}</span><i><b style="width:${(t.n / mx) * 100}%"></b></i><span>${t.n}</span>`).join("")}</div>` : ""}` };
}
function clutchMore(c, pn) {
  if (!c) return null;
  const cb = c.comeback;
  return { key: "m-clutch", tone: 3, hero: cb.p.hero, fixed: true, game: cb.m, kicker: `${pn} never gave up`,
    body: `${big(`${(cb.d / 1000).toFixed(1)}k`, "down. Won.")}${line(`Their best comeback: ${heroLink_(cb.p.hero)} vs ${esc(cb.vs)}, ${mmss(cb.m.duration_sec)}.`)}<div class="wr-graphbox up">${leadGraph(cb.lead)}</div>${c.thrown ? line(`The one that hurt: up ${(c.thrown.d / 1000).toFixed(1)}k against ${esc(c.thrown.vs)} on ${esc(c.thrown.p.hero)}, and lost.`) : ""}${c.buybacks ? stats([["Buybacks", fmt(c.buybacks)], ["Buyback wins", `${c.buybackWins}/${c.buybacks}`]]) : ""}` };
}
const heroLink_ = (h) => `<b>${esc(h)}</b>`;
function siegeMore(s, pn, field) {
  if (!s) return null;
  const games = Math.max(1, Math.round(s.damage / s.perGame)), hint = line('<span class="wr-hint">A tower ≈ 1,800 HP. Roshans and Tormentors count last hits.</span>');
  return { key: "m-siege", tone: 2, pick: [], kicker: `${pn}'s siege mode`, view: "season",
    views: [{ id: "season", label: "Season", body: `${big(kShort(s.damage), "building damage")}${line(`About ${plural(s.towers, "tower")}' worth.`)}${stats([["A game", kShort(s.perGame)], ["Roshans", fmt(s.roshans)], ["Tormentors", fmt(s.tormentors)]])}${rankChip(s.rank, "for building damage a game", field)}${hint}` },
      { id: "game", label: "A game", body: `${big(kShort(s.perGame), "a game")}${line(`About ${(s.perGame / 1800).toFixed(1)} towers' worth every game, over ${plural(games, "game")}.`)}${stats([["Roshans", (s.roshans / games).toFixed(2)], ["Tormentors", (s.tormentors / games).toFixed(2)]])}${rankChip(s.rank, "for building damage a game", field)}${hint}` }] };
}
function handsMore(h, pn, field) {
  if (!h) return null;
  const g = Math.max(1, h.games ?? 1), loud = h.loudest ? line(`Loudest game: ${h.loudest.n} pings on ${esc(h.loudest.hero)}.`) : "";
  return { key: "m-hands", tone: 4, pick: [], kicker: `${pn}'s hands and mouth`, view: "season",
    body: `${big(fmt(Math.round(h.apm)), "APM")}`,
    views: [{ id: "season", label: "Season", body: `${line(`${fmt(Math.round(h.actions))} actions across the season. Top speed: ${h.top.apm} on ${esc(h.top.hero)}.`)}${rankChip(h.rank, "for APM", field)}${stats([["Pings", fmt(h.pings)], ["Games", fmt(g)]])}${loud}${rankChip(h.pingRank, "for pings a game", field)}` },
      { id: "game", label: "A game", body: `${line(`${fmt(Math.round(h.actions / g))} actions a game. Top speed: ${h.top.apm} on ${esc(h.top.hero)}.`)}${rankChip(h.rank, "for APM", field)}${stats([["Pings", fmt(Math.round(h.perGame))]])}${loud}${rankChip(h.pingRank, "for pings a game", field)}` }] };
}
function itemsMore(src, it, pn, field) {
  if (!it) return null;
  const img = (k) => (itemImg(k) ? `<img class="wr-item" src="${esc(itemImg(k))}" alt="">` : ""), clk = (s) => mmss(Math.max(0, s));
  if (it.vs === "hero") return { key: "m-items", tone: 2, pick: [it.hero], kicker: "Ahead of the curve",
    body: `${big(clk(it.gain), "faster")}${line(`${pn}'s ${esc(itemName(it.key))} on ${heroLink(src, it.hero)} came ${clk(it.gain)} before the usual ${esc(it.hero)} in ${field}.`)}${stats([[`${pn} (${plural(it.builds, "build")})`, `${img(it.key)}${clk(it.mine)}`], [`Usual on ${esc(it.hero)}`, clk(it.usual)]])}${it.rows.length > 1 ? heroRows(src, it.rows, (r) => `−${clk(r.gain)}`, (r) => `${img(r.key)}${esc(itemName(r.key))} · ${clk(r.mine)} vs ${clk(r.usual)}`) : ""}${line(`<span class="wr-hint">Median finish time against every build of the same item on the same hero in ${field} (5+ builds, 3+ by others).</span>`)}` };
  return { key: "m-items", tone: 2, ...(it.hero ? { pick: [it.hero] } : { pick: [] }), kicker: "Ahead of the curve",
    body: `${big(clk(it.gain), "faster")}${line(`${pn}'s ${esc(itemName(it.key))} came ${clk(it.gain)} before ${field}'s usual timing.`)}${stats([[`${pn} (${plural(it.builds, "build")})`, `${img(it.key)}${clk(it.mine)}`], [field, clk(it.usual)]])}${line('<span class="wr-hint">Median finish time, on items the division usually finishes after 12:00.</span>')}` };
}
// A record board they made the top 5 of, them in gold.
function recordCard(src, r, key, pn) {
  const me = r.top[r.rank - 1];
  return { key: `m-rec-${r.key}`, rail: r.title, tone: r.tone, hero: me.hero, fixed: true, game: me.m, kicker: `${pn} in the ${esc(r.scope)} record book`,
    body: `${big(r.rank === 1 ? "#1" : `#${r.rank}`, esc(r.title.toLowerCase()))}${line(`${r.rank === 1 ? `The ${esc(r.scope)} record` : `${ordinal(r.rank)} in ${esc(r.scope)}`}: ${gold(esc(me.val))} on ${heroLink(src, me.hero)} vs ${esc(me.vs ?? "")}.${r.blurb === "In one game." ? "" : ` ${esc(r.blurb)}`}`)}${heroRows(src, r.top, (t) => (t.key === key ? gold(esc(t.val)) : esc(t.val)), (t) => `${esc(t.hero)} · ${esc(t.team ?? "")} · <a href="${src.root}/game/${esc(t.m.id)}">game</a>`, (t) => (t.key === key ? gold(playerLink(src, t.p)) : playerLink(src, t.p)))}` };
}
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
// recRank: where a single game ranks in the division's record book (each player's best game) (top 10 only, so it reads as a flex).
const recRank = (r, field) => (r && r.rank <= 10 ? `, ${r.rank === 1 ? gold(`the record in ${field}`) : `${gold(`#${r.rank}`)} in ${field}'s record book`}` : "");
// Last hits (cores) and assists (supports): the flex card.
const posRank = (r, what) => (r ? chips([`#${r.rank} of ${r.of} ${what}`]) : "");
function farmMore(src, f, pn, field) {
  if (!f) return null;
  const biggest = `Biggest game: ${fmt(f.bestGame.n)} on ${heroLink(src, f.bestGame.hero)}${recRank(f.bestGame.rank, field)} (<a href="${src.root}/game/${esc(f.bestGame.m.id)}">game</a>).`;
  return { key: "m-farm", tone: 4, hero: f.best10.hero, fixed: true, kicker: `${pn}'s last hits`, view: "10",
    views: [{ id: "10", label: "At 10:00", body: `${big(f.lh10.toFixed(1), "at 10 min")}${line(`Last hits at 10:00, on average. ${fmt(f.total)} last hits this season.`)}${stats([["Denies @10", f.dn10.toFixed(1)], ["Best @10", `${f.best10.n}`]])}${line(`Best start: ${gold(`${f.best10.n} at 10:00`)} on ${heroLink(src, f.best10.hero)}${recRank(f.best10.rank, field)}.`)}${rankChip(f.rank10, "for last hits at 10", field)}${posRank(f.core10, "cores for last hits at 10")}` },
      ...(f.perGame != null ? [{ id: "game", label: "A game", body: `${big(fmt(Math.round(f.perGame)), "a game")}${line(`Last hits a game, on average. ${fmt(f.total)} last hits this season.`)}${stats([["LH/min", f.perMin.toFixed(1)], ["Most in a game", fmt(f.bestGame.n)]])}${line(biggest)}${rankChip(f.rankGame, "for last hits a game", field)}${posRank(f.coreGame, "cores for last hits a game")}` }] : []),
      { id: "min", label: "A minute", body: `${big(f.perMin.toFixed(1), "a minute")}${line(`Last hits a minute, across the whole game. ${fmt(f.total)} last hits this season.`)}${stats([["Best rate", `${f.bestRate.n.toFixed(1)}`], ["Most in a game", fmt(f.bestGame.n)]])}${line(`Fastest farm: ${gold(`${f.bestRate.n.toFixed(1)} a minute`)} on ${heroLink(src, f.bestRate.hero)}. ${biggest}`)}${rankChip(f.rankMin, "for last hits a minute", field)}${posRank(f.coreMin, "cores for last hits a minute")}` }] };
}
function assistMore(src, a, pn, field) {
  if (!a) return null;
  const said = line(`${fmt(a.total)} assists this season. ${gold(pct(a.kp))} of their team's kills had their name on it.`);
  const busiest = line(`Busiest game: ${gold(`${a.bestGame.k}/${a.bestGame.d}/${a.bestGame.n}`)} on ${heroLink(src, a.bestGame.hero)}${recRank(a.bestGame.rank, field)} (<a href="${src.root}/game/${esc(a.bestGame.m.id)}">game</a>).`);
  return { key: "m-assists", tone: 6, hero: a.bestGame.hero, fixed: true, kicker: `${pn}'s assists`, view: "game",
    views: [{ id: "game", label: "A game", body: `${big(a.perGame.toFixed(1), "assists a game")}${said}${stats([["Kill share", pct(a.kp)], ["Most in a game", fmt(a.bestGame.n)]])}${busiest}${rankChip(a.rankGame, "for assists a game", field)}${rankChip(a.rankKp, "for kill share", field)}${posRank(a.posGame, `${POSN[a.pos]} for assists a game`)}` },
      { id: "min", label: "A minute", body: `${big(a.perMin.toFixed(2), "assists a minute")}${said}${stats([["Kill share", pct(a.kp)], ["A game", a.perGame.toFixed(1)]])}${busiest}${rankChip(a.rankMin, "for assists a minute", field)}${rankChip(a.rankKp, "for kill share", field)}` }] };
}
// Across AD2L: their averages ranked against each division's players at their position.
const POSN = ["players", "carries", "mids", "offlaners", "soft supports", "hard supports"];
function everyDivMore(e, pn) {
  if (!e) return null;
  const pos = POSN[e.pos] ?? "players";
  return { key: "m-everydiv", tone: 5, pick: [], kicker: `If ${pn} played in every division`,
    body: `${e.top ? big(`#${e.top.rank}`, `in ${esc(e.top.div.split("/")[0])}`) : big("AD2L")}${e.top ? line(`Their ${esc(e.top.stat)} would rank #${e.top.rank} of ${e.top.of} among ${esc(e.top.div)}'s ${pos}. Every division:`) : ""}<table class="wr-table"><tr><th>Division</th>${e.stats.map((s) => `<th>${esc(s)}</th>`).join("")}</tr>${e.rows.map((r) => `<tr class="${r.home ? "me" : ""}"><td>${esc(r.name)}</td>${r.ranks.map((x) => `<td class="${x.rank === 1 ? "wr-best" : ""}">#${x.rank}/${x.of}</td>`).join("")}</tr>`).join("")}</table>${line(`<span class="wr-hint">Same main position, ${MIN_GAMES}+ parsed games. Their division in gold.</span>`)}` };
}
// Season review: one leaderboard per new card, and the division showdown.
function boardCard(src, b, scope) {
  if (b.key === "clutch") return { key: `board-${scope}:clutch`, tone: b.tone, hero: b.hero, fixed: true, game: b.game, kicker: `${scope} · ${esc(b.group)}`,
    body: `${big(esc(b.title))}${line(`${gold(esc(b.team))} came back from ${(b.d / 1000).toFixed(1)}k down to beat ${esc(b.lost)}, ${mmss(b.game.duration_sec)}.`)}<div class="wr-graphbox up">${leadGraph((b.game.gold_adv ?? []).map((v) => (b.game.winner === "a" ? v : -v)))}</div>${line(`<a href="${src.root}/game/${esc(b.game.id)}">Open the game ›</a>`)}` };
  return { key: `board-${scope}:${b.key}`, ...(b.record ? { rail: b.title } : {}), tone: b.tone, pick: b.top.map((t) => t.hero).filter(Boolean), sig: b.top[0]?.p?.name, who: b.top[0]?.p && mainAccount(b.top[0].p), kicker: `${scope} · ${esc(b.group)}`,
    body: `${big(esc(b.title))}${line(esc(b.blurb))}${heroRows(src, b.top, (t) => esc(t.val), b.record ? (t) => `${esc(t.hero)} · ${esc(t.team ?? "")} vs ${esc(t.vs ?? "")} · <a href="${src.root}/game/${esc(t.m.id)}">game</a>` : (t) => esc(t.team ?? ""), (t) => playerLink(src, t.p))}${b.best ? line(`Best single game: ${gold(esc(b.best.val))}, ${playerLink(src, b.best.p)} on ${esc(b.best.hero)} vs ${esc(b.best.vs ?? "")} · <a href="${src.root}/game/${esc(b.best.m.id)}">game</a>`) : ""}` };
}
function showdownCard(s, homeKey) {
  if (!s) return null;
  const col = [["Length", (r) => mmss(r.length), "length"], ["Kills/m", (r) => r.kpm.toFixed(2), "kpm"], ["Obs/g", (r) => r.wards.toFixed(0), "wards"], ["Comeback", (r) => pct(r.comeback), "comeback"]];
  return { key: "showdown", tone: 2, hero: null, kicker: "Division showdown",
    body: `${big(esc(s.bloodiest.name.split("/")[0]))}${line(`The bloodiest division: ${gold(s.bloodiest.kpm.toFixed(2))} kills a minute.`)}<table class="wr-table"><tr><th>Division</th>${col.map(([n]) => `<th>${n}</th>`).join("")}</tr>${s.rows.map((r) => `<tr class="${r.key === homeKey ? "me" : ""}"><td>${esc(r.name.split("/")[0])}</td>${col.map(([, f, k]) => `<td class="${s.best[k] === r.key ? "wr-best" : ""}">${f(r)}</td>`).join("")}</tr>`).join("")}</table>${line('<span class="wr-hint">Comeback: the winner was 5k+ down at some minute.</span>')}` };
}

// Every ranked player's personality, shared out across the league (lib/wrapped.js
// leaguePersonalities): Map league key -> Map player key -> personality. Heroic/Aegis's two
// divisions count apart. Worked out once a visit.
let personalities;
const leaguePersonalityMap = () => (personalities ??= (async () => {
  const leagues = [];
  for (const k of Object.keys(DIVISIONS)) {
    const src = SOURCES[k];
    if (!src) continue;
    const { d, games } = await wrappedData(src);
    const players = byPlayer(games), teamDiv = new Map(d.teams.map((t) => [t.id, t.division ?? null]));
    const divisionOf = (key) => { const rows = players.get(key)?.rows; return rows?.length && DIVISIONS[k].views ? teamDiv.get(mainTeamOf(rows).id) ?? null : null; };
    leagues.push({ id: k, players, divisionOf });
  }
  return leaguePersonalities(leagues, { pairsOnly: FAV_WALLS, draft: FAV_WALLS });
})().catch((e) => { personalities = null; throw e; }));
const sharedPersonality = async (src, key) => (await leaguePersonalityMap().catch(() => null))?.get(src.key)?.get(key) ?? null;
// A player's game ratings in their division, oldest first: [{ m, p, rating, tier }], or null under 3.
// The rating model is fitted on Wrapped's own copy of the division: the same model and ratings as
// parts/tiers.js tierRef on the full file (none of the fields lib/lite.js drops are read), without
// downloading the full file (about 1 MB more) for it.
async function ratingsOf(src, data, key) {
  let detailed, model = null;
  try { ({ detailed, model } = tiersOf(src, data.d)); } catch { return null; }
  if (!model) return null;
  const pts = [];
  for (const m of data.games) {
    const p = m.players.find((q) => playerKey(q) === key);
    if (!p) continue;
    const r = gameRatings(m, detailed, { model }).find((x) => x.key === key);
    if (r) pts.push({ m, p, rating: r.rating_exact, tier: r.tier });
  }
  pts.sort((a, b) => (a.m.start_time ?? 0) - (b.m.start_time ?? 0));
  return pts.length >= 3 ? pts : null;
}
// Team names for the cards above, from the league being drawn (set as its data loads).
const wrappedTeamName = new Map();
const wrappedTeamLeague = new Map();

// A league award as a card. teamName: id → name (null on a player's own award card, which only
// uses player awards).
// A player award is signed with the winner's name (c.sig, favSigHtml).
function awardCard(src, a, teamName) {
  const c = awardCardOf(src, a, teamName);
  if (c && a.p?.name) { c.sig = a.p.name; c.who = mainAccount(a.p); }
  return c;
}
function awardCardOf(src, a, teamName) {
  const tn = (id) => esc(teamName?.get(id) ?? "?");
  const p = a.p && playerLink(src, a.p);
  // The winner's player card, on the award's hero (the duo's hero; else the one the stat came from).
  const pc = a.p && { src, key: playerKey(a.p), hero: a.hero ?? a.p.hero };
  switch (a.key) {
    case "mvp": return { tone: 5, hero: a.p.hero, pc, kicker: "MVP", body: `${big(p)}${line(`<b>${a.value}</b> game MVPs in ${a.games} games`)}` };
    case "playoffMvp": return { tone: 2, hero: a.p.hero, pc, kicker: "Playoff MVP", body: `${big(p)}${line(`<b>${a.value}</b> game MVPs in ${a.games} playoff games`)}${stats([["Won", `${recP({ n: a.games, w: a.wins })}`], ["MVP rate", pct(a.value / a.games)]])}` };
    case "champions": {
      const g = a.group;
      // All divisions: each division's champions, named.
      const dv = src.all && DIVISIONS_LIST.find((x) => x.key === wrappedTeamLeague.get(a.team));
      return { tone: 4, hero: null, kicker: `${dv ? `${esc(dv.name)} · ` : ""}${esc(a.title)}`, body: `${big(teamLink(src, teamName?.get(a.team) ?? "?", a.team))}${line(`Won the grand final${a.final?.score && !CONFIRMED_FINAL.includes(a.final.series) ? ` <b>${a.final.score[0]}–${a.final.score[1]}</b>` : ""} over ${tn(a.final?.against)}`)}${g ? stats([["Group", `#${g.rank}`], ["Games", `${g.gw}–${g.gl}`]]) : ""}${chips([a.title])}` };
    }
    case "support": return { tone: 3, hero: a.p.hero, pc, kicker: "Best support", body: `${big(p)}${line(`${pct(a.kp)} kill participation · ${a.wards.toFixed(1)} wards a game · ${a.dewards.toFixed(1)} dewards`)}${line(`${pct(a.winRate)} wins`)}` };
    case "laner": return { tone: 6, hero: a.p.hero, pc, kicker: "Best laner", body: `${big(p)}${line(`${esc(lane(a.group))} · won ${a.won} of ${a.lanes} lanes`)}${a.margin != null ? line(`${signedK(a.margin)} gold + XP at 10 minutes`) : ""}` };
    case "duo": return { tone: 4, hero: a.hero, pc, kicker: "Strongest player + hero", body: `${big(`${p} <span class="wr-amp">+</span> ${heroLink(src, a.hero)}`)}${line(`<b>${recP({ n: a.games, w: a.wins })}</b> together · ${a.kda.toFixed(1)} KDA`)}` };
    case "sandbagged": {
      const med = (rt) => esc(rankLabel(rt) ?? "?"), up = (n) => `${n > 0 ? "+" : ""}${n}`;
      return { tone: 1, hero: a.p.hero, pc, kicker: "Most sandbagged", body: `${big(p, `${up(a.climb)} ★`)}${line(`<b>${med(a.from)}</b> → <b>${med(a.to)}</b> · ${a.wins + a.losses} ranked games (${a.wins}–${a.losses}, ${winPct({ n: a.wins + a.losses, w: a.wins })} won) since the season started`)}<table class="wr-table"><tr><th></th><th>Player</th><th>Start → now</th><th>Ranked</th><th>Stars</th></tr>${a.top.map((t, i) => `<tr class="${i ? "" : "me"}"><td>#${i + 1}</td><td>${playerLink(src, t.p)}</td><td>${med(t.from)} → ${med(t.to)}</td><td>${t.wins}–${t.losses}</td><td class="${i ? "" : "wr-best"}">${up(t.climb)}</td></tr>`).join("")}</table>${line(`<span class="wr-hint">Start: the average medal of their first ranked lobbies this season. Now: their medal today. Main account only.</span>`)}` };
    }
    case "series": {
      const s = a.s, t = a.games[0];
      const title = s ? `${tn(s.home)} vs ${tn(s.away)}` : `${esc(t.team_a)} vs ${esc(t.team_b)}`;
      return { tone: 2, hero: null, kicker: "Series of the season", body: `${big(title)}${s ? line(`<b>${s.home_score}–${s.away_score}</b>`) : ""}${line(`${a.swings} lead changes · ${a.kills} kills over ${a.games.length} games`)}${a.notes?.length ? line(esc(a.notes.slice(0, 3).join(" · "))) : ""}${line(a.games.map((g, i) => `<a href="${src.root}/game/${esc(g.id)}">Game ${i + 1}</a>`).join(" · "))}${seriesRunnerUp(src, a.runnerUp, tn)}` };
    }
    case "upset": return { tone: 1, hero: null, kicker: "Biggest upset, per the model", body: `${big(teamLink(src, teamName?.get(a.team) ?? "?", a.team))}${line(`beat <b>${tn(a.loser)}</b> ${seriesScore(a.s)}`)}${line(`The model gave that <b>${pct(a.chance)}</b>`)}` };
    case "overachiever": return { tone: 6, hero: null, kicker: "Biggest overachiever", body: `${big(teamLink(src, teamName?.get(a.team) ?? "?", a.team))}${line(`Won <b>${a.upsets}</b> series the model had them losing`)}${a.best ? line(`Longest odds: beat <b>${tn(a.best.opp)}</b> at <b>${pct(a.best.chance)}</b>`) : ""}` };
  }
  return null;
}

// The card, styled like its link-preview image (scripts/gen/wrapped-og.py): near black with the
// league's colour glowing in, the hero's full render on the right fading out behind the words,
// stencil caps. A slide with the player's Fantasy card has the card there instead of the render.
const RENDERS = "https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders";
const heroRender = (name) => { const slug = HERO_META.find(([, n]) => n === name)?.[2]; return slug ? `${RENDERS}/${slug}.png` : null; };
// The render moves: Valve's animated renders (transparent video) loop behind the words, the still
// as the poster until it plays. Safari gets the HEVC .mov (its WebM has no transparency), every
// other browser the WebM. Stills where motion is turned down, on a pinned card (still: true), and
// where the browser asks to save data or the connection is 2G/3G (lib/story-player.js lowData).
const SAFARI = typeof navigator !== "undefined" && /^((?!chrome|chromium|crios|android).)*safari/i.test(navigator.userAgent);
const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const artHtml = (png, still) => (still || calm() || lowData(typeof navigator !== "undefined" && navigator.connection)
  ? `<img src="${esc(png)}" alt="" decoding="async">`
  : `<video autoplay muted loop playsinline disablepictureinpicture preload="auto" poster="${esc(png)}" aria-hidden="true"><source src="${esc(png.replace(/\.png$/, SAFARI ? ".mov" : ".webm"))}" type="${SAFARI ? "video/quicktime" : "video/webm"}"></video>`);
// Every slide sits on a hero wallpaper (the site's hero art, img/hero-art/): the slide's hero, else
// its Fantasy card's hero, else the story's own (c.wall: in a player's Wrapped, one of their heroes),
// else one picked from the slide's name so the opening, parts, ending and team awards are never
// plain and always get the same one.
const WALL_HEROES = HERO_META.map(([, name]) => name).filter((n) => heroArt(n));
const pickHero = (key) => WALL_HEROES[[...String(key)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % WALL_HEROES.length];
// The new version, live for everyone (?wrapWalls=now shows the old one, as the left side of
// _dev/wrapped-compare.html does): every background is the art of one of Fav's picked card designs
// (lib/fav-showcase-picks.js) in place of the hero wallpaper and loading screens. Same motion: the
// wall zooms in, a return pans.
const FAV_WALLS = typeof location !== "undefined" && new URLSearchParams(location.search).get("wrapWalls") !== "now";
let favWalls = null;
const favFinish = new Map(); // picked art src -> that pick's equipment, for its finish (favFinishHtml)
const favHeroOf = new Map(); // picked art src -> its hero (lightning borders go to lightning heroes only)
// hero -> picked art, wallpapers and loading screens first, the site default next, cut-outs last.
async function loadFavWalls() {
  const { FAV_PICKS } = await import("../lib/fav-showcase-picks.js");
  const rank = (a) => (a == null ? 1 : /^(ls|scr):/.test(a) ? 0 : 2), by = new Map();
  for (const p of FAV_PICKS) {
    const base = p.equipment?.baseCard ?? {}, src = cardArtwork(p.hero, base)?.src;
    if (!src) continue;
    const list = by.get(p.hero) ?? []; by.set(p.hero, list);
    if (!list.some((x) => x.src === src)) { list.push({ src, rank: rank(base.art) }); favFinish.set(src, p.equipment); favHeroOf.set(src, p.hero); }
  }
  for (const [h, list] of by) by.set(h, list.sort((a, b) => a.rank - b.rank).map((x) => x.src));
  return by;
}
const plainWall = (c) => {
  const art = heroArt([c.hero, c.pc?.hero, c.wall].find((n) => n && heroArt(n)) ?? pickHero(c.key));
  return art && new URL(`../${art.src}`, import.meta.url).href;
};
const wallOf = (c) => {
  if (c.bg) return c.bg;
  if (favWalls) {
    const name = [c.hero, c.pc?.hero, c.wall].find((n) => n && favWalls.has(n)) ?? pickHero(c.key);
    const fav = favWalls.get(name)?.[0];
    if (fav) return fav;
  }
  return plainWall(c);
};
// New version (FAV_WALLS): a story's backgrounds, worked out in slide order so none shows twice
// (c.bg). A slide takes the first unused pick of its hero (c.wallHeroes, when given, first). A slide whose hero is only a choice
// (c.flex) and whose hero has no picks left turns to another hero with picks left, the player's own
// first (pool); a slide whose hero is its subject keeps it and takes one of its unused loading
// screens instead. Last resort: any unused pick. c.repeat is recounted from the heroes as shown.
function assignWalls(cards, pool = []) {
  const used = new Set(), seen = new Map();
  const free = (h) => favWalls.get(h)?.find((s) => !used.has(s)) ?? null;
  const hash = (key) => [...String(key)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const spare = (key) => {
    const own = pool.find((h) => free(h));
    if (own) return own;
    const open = [...favWalls.keys()].filter((h) => free(h));
    return open.length ? open[hash(key) % open.length] : null;
  };
  for (const c of cards) {
    let h = [...(c.wallHeroes ?? []), c.hero, c.pc?.hero, c.wall].find((x) => x && free(x));
    if (!h && c.flex && c.hero) {
      h = spare(c.key);
      if (h) { c.hero = h; if (c.pc?.hero != null) c.pc = { ...c.pc, hero: h }; }
    }
    if (h) c.bg = free(h);
    else if (c.hero) c.bg = screensOf(c.hero).find((s) => !used.has(s)) ?? null;
    if (!c.bg) { const o = spare(c.key); if (o) c.bg = free(o); }
    if (c.bg) used.add(c.bg);
    c.repeat = (c.hero && seen.get(c.hero)) || 0;
    if (c.hero) seen.set(c.hero, c.repeat + 1);
  }
}
// A hero's return (c.repeat) gets a backdrop of its own instead of the model: one of that hero's
// loading screens (pack screens and the Fantasy card art picks, the site's own copies first), the
// nth return the nth screen. A hero with none gets Valve's portrait of it; if that's missing too,
// the hero wallpaper (wireArt).
const screensOf = (hero) => {
  const local = (src) => (/^https?:/.test(src) ? src : new URL(`../${src}`, import.meta.url).href);
  const art = (CARD_ART[hero] ?? []).filter((x) => !/mini[\s_-]*heroes/i.test(x.label));
  return [
    ...ALL_SCREENS.filter((s) => s.hero === hero).map((s) => screenArt(s.id)?.src).filter(Boolean),
    ...art.filter((x) => !/^https?:/.test(x.src)).map((x) => local(x.src)),
    ...art.filter((x) => /^https?:/.test(x.src)).map((x) => x.src),
  ];
};
const backdropOf = (c) => {
  // Fav's picks: the nth return gets his (n+1)th pick, the first being the hero's wall.
  const fav = favWalls?.get(c.hero);
  if (fav?.length > 1) return fav[1 + (c.repeat - 1) % (fav.length - 1)];
  const all = screensOf(c.hero);
  if (all.length) return all[(c.repeat - 1) % all.length];
  const slug = HERO_META.find(([, n]) => n === c.hero)?.[2];
  return slug ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/${slug}_vert.jpg` : null;
};
// The pick's finish (and any stacked ones) over its background, at the pick's own pace. Its paint and
// particles come from the shared finish styles (cosmetics-effects.css and friends); canvas and smoke
// finishes start themselves (lib/card-fx.js, lib/smoke-fx.js). Still where motion is turned down.
function favFinishHtml(wall, still) {
  const e = favWalls && wall && favFinish.get(wall);
  if (!e || still || calm() || (!e.finish && !e.finishStack?.length)) return "";
  const pace = (k) => (e[k] ?? 100) / 100;
  return `<div class="wr-finish" data-finish="${esc(finishStackOf(e).length ? "stack" : e.finish)}" style="--particle-speed:${pace("particleSpeed")};--particle-speed-base:${pace("particleSpeed")}"><span class="cosmetic-overlay" aria-hidden="true"></span>${finishLayersHtml(e)}</div>`;
}
// The pick's signature style (autograph, size, tilt) over its background, written with the
// name of the player the slide is about (c.sig): each slide shows off a different style to them,
// one they could buy (Fav, 2026-11-25). A player's own story: their name on every slide. Team and
// season-review stories: only slides that feature one player (awards, leaderboard #1, ban magnet...).
// Drawn by lib/signatures.js like on a card, in a layer the size of the slide. No name, nothing.
// The style itself comes from SIG_STYLES, picked from the slide and the name, so a story runs
// through many of them; about one slide in five draws it in an elemental lettering (namefx).
// Always in English: language modifiers (Japanese, Greek, Runic...) are never used (Fav, 2026-11-26).
// Clean, professional hands only: no novelty styles (sticky note, balloons, ransom note, laser etch...).
const SIG_STYLES = ["silver-ink", "gold-ink", "brush-ink", "violet-ink", "gold-foil", "rose-foil", "spectral-script",
  "starlit-signature", "solar-signature", "ancient-signature", "kana-brush", "phoenix-stroke", "orbit-tag",
  "architect", "engraver", "afterimage", "draft", "contour", "continuous", "fountain-pen", "blackletter",
  "liquid-chrome", "enso-ink-sig", "lightning-script", "soulfire", "smoke-script"];
// Elemental letterings draw over a plain (non-expansion) style's lettering only (lib/signatures.js).
const SIG_PLAIN = SIG_STYLES.filter((id) => !itemByKey(`autograph:${id}`)?.expansion);
const SIG_ELEMENTS = ["inferno", "frost", "storm", "tidal", "arcs", "solar", "fireice", "void", "toxic", "spirit"];
const sigHash = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 2166136261);
function favSigHtml(wall, who, key, still) {
  const e = favWalls && who && wall && favFinish.get(wall);
  if (!e?.autograph || e.autograph === "none") return "";
  const h = sigHash(`${key}|${who}`), elemental = h % 5 === 0 && !still && !calm(); // living effects need motion
  const autograph = elemental ? SIG_PLAIN[(h >>> 3) % SIG_PLAIN.length] : SIG_STYLES[(h >>> 3) % SIG_STYLES.length];
  const namefx = elemental ? `smoke-${SIG_ELEMENTS[(h >>> 11) % SIG_ELEMENTS.length]}` : "none";
  // On a card it sits on the name plate (low); on a slide the words are low, so it goes top right.
  const eq = { ...DEFAULT_EQUIPMENT, ...e, autograph, namefx, translation: "none" };
  const html = signatureHtml({ ...eq, x: 72, y: 15, size: Math.round(eq.size * 0.6) }, who);
  return html ? `<div class="wr-sig" aria-hidden="true">${html}</div>` : "";
}
// Slide borders (local only, on by default with the new version; ?wrapBorders=0 turns them off): a shop border drawn round the whole slide. A classic
// border is its frame paint as a ring (cosmetics-effects.css [data-texture]); an animated one is its
// own frame layer (cosmeticBorder), stretched to the slide.
const FAV_BORDERS = FAV_WALLS && new URLSearchParams(location.search).get("wrapBorders") !== "0";
// c.border (matchBorders) is a shop border matched to the slide's colours; until it's worked out, the pick's own.
function favBorderHtml(wall, id) {
  const e = FAV_BORDERS && favWalls && wall && favFinish.get(wall);
  if (!e?.border) return "";
  // Not matched yet, and the pick's own isn't a slide border: a plain painted one stands in.
  const own = itemByKey(`border:${e.border}`);
  const eq = id ? { border: id } : own && slideBorderOk(own) ? e : { border: "platinum" };
  const item = itemByKey(`border:${eq.border}`), calm = BORDER_CALM[eq.border];
  let fx = cosmeticBorder(eq);
  if (calm && fx) fx = fx.replace("data-smoke=", `data-spd="${calm.spd}" data-amt="${calm.amt}" data-smoke=`);
  return `<div class="wr-border" data-border="${esc(eq.border)}" data-texture="${esc(item?.texture ?? "metal")}" style="--a:${item?.a ?? "#92969c"};--b:${item?.b ?? "#41454c"};--border-speed:${(eq.borderSpeed ?? 100) / 100}${calm ? `;filter:brightness(${calm.dim})` : ""}" aria-hidden="true">${fx || '<i class="wr-ring"></i>'}</div>`;
}
// Lightning borders only on a lightning hero's slide (Fav, 2026-11-25).
const LIGHTNING_BORDERS = new Set(["smoke-arcs", "smoke-arcane", "smoke-storm", "fx-bolt"]);
const LIGHTNING_HEROES = new Set(["Zeus", "Storm Spirit", "Razor", "Disruptor", "Arc Warden", "Leshrac"]);
// Borders too loud behind a slide's text, calmed here only: slower, thinner and dimmer (Fav, 2026-11-25).
const BORDER_CALM = { "smoke-arcs": { spd: 0.35, amt: 0.6, dim: 0.6 }, "smoke-arcane": { spd: 0.4, amt: 0.6, dim: 0.62 } };
// The shop's borders for slides, less the funny and meme ones (Fav, 2026-11-25) and personal items.
const BORDER_SKIP = new Set(["tape-measure", "knit-scarf", "bubble-wrap", "caution-tape", "film-reel", "chalkboard", "building-bricks",
  "coloured-pencils", "postage-stamp", "honeycomb", "piano-keys", "frosted-donut", "zipper", "crayon-box", "model-railway", "lava-lamp",
  "marquee-lights", "festival-bunting", "conveyor-belt", "ant-farm", "pinball", "domino-run", "equalizer", "manga-panel", "cork",
  "checker", "neon-sign", "lane-creeps", "roshan-pit", "courier-run", "jungle-stack", "ward-vision", "fireworks-show", "light-cycles", "smoke-heathaze",
  // and the ones that copy a real made thing: leather, wood, cloth, masonry, machined metal, glass, print (Fav, 2026-11-25)
  "stitched-leather", "oxblood", "cedar", "walnut", "denim", "naval", "terracotta", "sandstone", "brushed-tin", "charcoal", "olive",
  "carbon", "circuit", "parchment", "ochre", "hammered-bronze", "dusty-rose", "damascus", "cathedral-glass", "clockwork", "cog-train",
  "mirror", "malachite", "bamboo-grove", "lantern-festival", "gold-laurel", "enso-ink-border", "ouroboros", "koi-pond", "kraken",
  // the rain ones: close, not there yet (Fav, 2026-11-25)
  "fx-rain", "fx-storm", "smoke-rain",
  // and the many-colour ones: their two catalogue colours don't say what they look like, so they can't be matched to a slide
  "rainbow", "opalescent", "pearl", "aurora", "fx-refract", "smoke-prism", "smoke-oil", "smoke-fireice", "smoke-nebula",
  "smoke-emission", "smoke-galaxy", "smoke-venom", "smoke-aurora"]);
// Only simple borders (painted, gloss, fx-) and particle/smoke ones: no drawn scene frames (the expansion
// borders: magma plates, Radiant & Dire, lapis...), which Fav says don't look good on a slide (2026-11-25).
const slideBorderOk = (i) => !i.expansion && !BORDER_SKIP.has(i.id);
// Personal borders go to their owner: the first slide in a story about them (c.who, an account id).
const PERSONAL_OWNER = { "fx-brown-wisp": 75379546 }; // Brown
const shopBorders = () => CATALOG.filter((i) => i.type === "border" && i.a && i.b && slideBorderOk(i) && !PERSONAL_CATALOG.some((p) => p.key === i.key));
const hexRgb = (h) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const colorGap = ([r1, g1, b1], [r2, g2, b2]) => { const r = (r1 + r2) / 2; return Math.sqrt((2 + r / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - r) / 256) * (b1 - b2) ** 2); };
// A picture's mean colour and its accent: the strongest hue band's average, weighted by saturation.
async function paletteOf(src) {
  try {
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = src; await img.decode();
    const cv = document.createElement("canvas"); cv.width = cv.height = 32;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0, 32, 32);
    const px = cx.getImageData(0, 0, 32, 32).data, mean = [0, 0, 0], bands = Array.from({ length: 12 }, () => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
      mean[0] += r; mean[1] += g; mean[2] += b;
      if (sat < 0.25 || mx < 50) continue;
      const d = mx - mn, hue = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      const w = sat * (mx / 255), band = bands[Math.floor(hue * 2) % 12];
      band[0] += r * w; band[1] += g * w; band[2] += b * w; band[3] += w;
    }
    const n = px.length / 4, top = bands.reduce((a, b) => (b[3] > a[3] ? b : a));
    const avg = mean.map((v) => v / n);
    return { mean: avg, accent: top[3] ? top.slice(0, 3).map((v) => v / top[3]) : avg };
  } catch { return null; }
}
// How strongly coloured a colour is: saturation times brightness, 0 for grey, white or black.
const vividOf = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? ((mx - mn) / mx) * (mx / 255) : 0; };
const satOf = ([r, g, b]) => { const mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };
const hueOf = ([r, g, b]) => { const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return null; return 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4); };
// Degrees apart on the colour wheel; a colour too grey to have a hue counts as 90 off.
const hueGap = (x, y) => { const h1 = hueOf(x), h2 = hueOf(y); if (h1 == null || h2 == null || satOf(x) < 0.15) return 90; const d = Math.abs(h1 - h2) % 360; return Math.min(d, 360 - d); };
// In slide order, each slide takes the border whose main colour (its more colourful one) is nearest the
// picture's accent in hue and in saturation. Brightness doesn't count: a border is lit, the art is dark,
// and matching on plain distance let pale khaki pass on a fiery orange slide (Fav, 2026-11-25). Epic and
// legendary borders get an edge. A border can come back 8+ slides later, at a small cost, so warm-heavy
// stories don't run out of warm borders. A picture that can't be read keeps its pick's border.
const REUSE_GAP = 8, REUSE_COST = 12;
async function matchBorders(cards) {
  const lift = { common: 1.3, rare: 1.12, epic: 1, legendary: 0.9 }; // showier borders win close calls
  const pool = shopBorders().map((i) => ({ id: i.id, a: hexRgb(i.a), b: hexRgb(i.b), w: lift[i.rarity] ?? 1 })), last = new Map();
  const pals = await Promise.all(cards.map((c) => (c.bg ? paletteOf(c.bg) : null)));
  const mine = new Set();
  cards.forEach((c, k) => {
    const own = Object.keys(PERSONAL_OWNER).find((id) => PERSONAL_OWNER[id] === Number(c.who) && !mine.has(id) && itemByKey(`border:${id}`));
    if (own) { c.border = own; mine.add(own); return; }
    const p = pals[k];
    if (!p) return;
    let best = null, bestScore = Infinity;
    const zappy = LIGHTNING_HEROES.has(favHeroOf.get(c.bg));
    for (const x of pool) {
      if (LIGHTNING_BORDERS.has(x.id) && !zappy) continue;
      const at = last.get(x.id);
      if (at != null && k - at < REUSE_GAP) continue;
      const main = vividOf(x.a) >= vividOf(x.b) ? x.a : x.b;
      const s = x.w * (2.5 * hueGap(main, p.accent) + 250 * Math.abs(satOf(main) - satOf(p.accent))) + (at != null ? REUSE_COST : 0);
      if (s < bestScore) { bestScore = s; best = x; }
    }
    if (best) { c.border = best.id; last.set(best.id, k); }
  });
}
function cardHtml(c, { pin = null, index = null, still = false } = {}) {
  // A background chosen up front (assignWalls) is the wall; a hero's return still drops the model.
  const backdrop = c.repeat && c.hero ? (c.bg ?? backdropOf(c)) : null;
  // "Season in one line" (the rating chart) keeps the hero for its wall but shows no model.
  const render = !backdrop && !c.pc && c.key !== "rating" && c.key !== "clip" && c.hero && heroRender(c.hero);
  const wall = c.bg ?? backdrop ?? wallOf(c), fallback = c.bg ? plainWall(c) : backdrop && wallOf(c);
  return `<article class="wr-card wr-tone-${c.tone}${c.pc ? " wr-has-pc" : ""}${render ? " wr-has-art" : ""}${wall ? " wr-has-wall" : ""}${backdrop ? " wr-has-backdrop" : ""}" data-card="${esc(c.key)}"${index != null ? ` data-index="${index}"` : ""}>
    <div class="wr-bg"></div>
    ${wall ? `<div class="wr-wall"><img src="${esc(wall)}" alt="" decoding="async"${fallback ? ` data-fallback="${esc(fallback)}"` : ""}></div>` : ""}
    ${favFinishHtml(wall, still)}
    ${favSigHtml(wall, c.sig, c.key, still)}
    ${render ? `<div class="wr-art">${artHtml(render, still)}</div>` : ""}
    <div class="wr-shade"></div>
    <div class="wr-inner">
      <p class="wr-kicker">${c.kicker}</p>
      ${c.pc ? `<div class="wr-pc"></div>` : ""}
      <div class="wr-body">${c.views ? viewsHtml(c, still) : `${c.body ?? ""}${c.after ?? ""}`}</div>
      <footer class="wr-foot"><span>AD2L ${esc(SEASON.name)} Wrapped</span>${pin ?? ""}</footer>
    </div>
    ${favBorderHtml(wall, c.border)}
  </article>`;
}
// Switch cards: c.views ([{ id, label, body }]) shows one view at a time behind a switch (Fav,
// 2026-11-26: "a switcher to show a game vs a minute. semi interactive cards"). c.body, when set,
// sits above the switch and c.after below the views; both stay put. The pick carries to the next card with the same switch, so
// someone reading "a minute" keeps reading it. c.view: the view a card opens on. Pinned and preview cards (still) show the first view
// (or c.view) with no switch. The image (Share → Image) keeps the view on screen and leaves the switch out.
const viewPick = new Map();
const switchOf = (c) => c.views.map((v) => v.id).join("|");
function viewsHtml(c, still) {
  const want = (!still && viewPick.get(switchOf(c))) || c.view, at = Math.max(0, c.views.findIndex((v) => v.id === want));
  const sw = still ? "" : `<div class="wr-switch" role="group" aria-label="Show">${c.views.map((v, i) => `<button type="button" data-view="${i}" aria-pressed="${i === at}">${v.label}</button>`).join("")}</div>`;
  return `${c.body ?? ""}${sw}${c.views.map((v, i) => `<div class="wr-view" data-view-body="${i}"${i === at ? "" : " hidden"}>${v.body}</div>`).join("")}${c.after ?? ""}`;
}
function wireSwitch(stage, cardOf) {
  stage.addEventListener("click", (e) => {
    const b = e.target.closest(".wr-switch [data-view]");
    if (!b) return;
    e.stopPropagation();
    const card = b.closest(".wr-card"), c = cardOf(), i = Number(b.dataset.view);
    if (!c?.views || b.getAttribute("aria-pressed") === "true") return;
    viewPick.set(switchOf(c), c.views[i].id);
    card.querySelectorAll(".wr-switch [data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    card.querySelectorAll("[data-view-body]").forEach((v) => { v.hidden = v.dataset.viewBody !== String(i); });
    card.classList.add("wr-swapped");
    countUp(card, card.querySelector(`[data-view-body="${i}"]`));
  });
}
// The card's numbers count up from 0 as they land: the big line, stats, summary tiles and hero
// records, each starting when its line's rise starts (wrapped.css --d/--k). Left alone: the
// opening, ending, part and locked cards (a season's year isn't a stat), numbers in links (names),
// ranks (#6), ordinals (3rd) and signed or suffixed figures (+1.2k). Off where motion is turned down.
const COUNTED = ".wr-big, .wr-stats dd, .wr-summary dd, .wr-hrec, .wr-hname small";
const NUMBER = /(?<![\w#.+-])\d[\d,]*(?:\.\d+)?(?!\w)/g;
const STILL_CARDS = /^(open|end|locked|part\d+)$/;
const COUNT_MS = 900;
function countUp(card, root = card) {
  if (!card || !root || calm() || STILL_CARDS.test(card.dataset.card)) return;
  const runs = [], now = performance.now();
  for (const el of root.querySelectorAll(COUNTED)) {
    if (el.closest("[hidden]")) continue;
    const anchor = el.closest(".wr-stats > div, .wr-summary > div, .wr-heroes > li, .wr-view > *, .wr-body > *") ?? el;
    const delay = (parseFloat(getComputedStyle(anchor).animationDelay) || 0) * 1000;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t; (t = walk.nextNode());) {
      if (t.parentElement.closest("a") || !t.data.match(NUMBER)) continue;
      runs.push({ node: t, text: t.data, start: now + delay + 60 });
    }
  }
  if (!runs.length) return;
  const at = (s, e) => {
    const dec = s.split(".")[1]?.length ?? 0, v = parseFloat(s.replace(/,/g, "")) * e;
    return s.includes(",") ? v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
  };
  const frame = (time) => {
    if (!card.isConnected) return;
    let live = false;
    for (const r of runs) {
      const p = Math.min(1, Math.max(0, (time - r.start) / COUNT_MS)), e = 1 - (1 - p) ** 3;
      r.node.data = p === 1 ? r.text : r.text.replace(NUMBER, (s) => at(s, e));
      if (p < 1) live = true;
    }
    if (live) requestAnimationFrame(frame);
  };
  frame(now);
}

// A render Valve's CDN doesn't have (a brand-new hero) leaves the glow alone.
function wireArt(host) {
  host.addEventListener("error", (e) => {
    // A backdrop that won't load falls back to the hero wallpaper.
    const fb = e.target.dataset?.fallback;
    if (fb) { delete e.target.dataset.fallback; e.target.src = fb; return; }
    // A video that won't play keeps its poster (the still); only a missing still goes.
    const art = e.target.tagName === "IMG" && e.target.closest?.(".wr-art");
    if (art) { art.closest(".wr-card")?.classList.remove("wr-has-art"); art.remove(); }
  }, true);
}

// ---------- Player cards ----------
// Some slides (a player and a hero: intro, heroes, bans, best game, player awards) carry the
// player's Fantasy card (parts/player-card.js) in their own saved design, turned to that slide's
// hero. c.pc: { src, key, hero (null: the card as they saved it) }. Drawn after the slide shows,
// since it needs everyone's saved cards (lib/store.js listCards, fetched once).
let savedCards = null, cardTiers = null, cardKit = null;
// Each card's tier (account id -> { tier, rating }), the one on their profile: the same lists as
// parts/tiers.js divisionTiers, made from Wrapped's own copies of the divisions instead of every
// full division file (about 5 MB more to download). Same models (see ratingsOf), same tiers.
// A division's detailed games and its rating model, made once per division file.
const tierMemo = new WeakMap();
function tiersOf(src, d) {
  let m = tierMemo.get(d);
  if (!m) { const detailed = d.games.filter(hasDetails); m = { detailed, model: tierModel(detailed, { minGames: floorOf(src) }) }; tierMemo.set(d, m); }
  return m;
}
// From each division's file as loaded (not wrappedData), so a card's tier doesn't wait on every division's awards.
const wrappedTiers = () => (cardTiers ??= Promise.all(Object.keys(DIVISIONS).filter((k) => SOURCES[k]).map(async (k) => {
  const src = SOURCES[k], { detailed, model } = tiersOf(src, await wrappedSrcData(src));
  return tierList(detailed, { model, minGames: floorOf(src) });
})).then((lists) => new Map(lists.flatMap((l) => l.tiers.flatMap(({ tier, players }) => players.map((p) => [p.key, { tier, rating: p.rating }])))))
  .catch(() => new Map()));
const heroId = (name) => HERO_META.find(([, n]) => n === name)?.[0] ?? null;
// A player's saved designs (lib/cosmetics-engine.js cardAppearance): their main one first, then the
// rest in their profile's order. [] with none saved.
function designsOf(look) {
  if (!look) return [];
  if (!Array.isArray(look.cardDesigns)) return [look];
  const main = look.primaryCard ?? 0, order = Array.isArray(look.cardOrder) ? look.cardOrder : look.cardDesigns.map((_, i) => i);
  return [main, ...order.filter((i) => i !== main)].map((i) => look.cardDesigns[i]).filter(Boolean);
}
// n: the slide's number among the player's card slides: design n (looping round their designs).
// Fallbacks: no saved designs, their Fantasy card choices (hero, art, filter); none of those either,
// the site's default card for them.
async function playerCardHtml({ src, key, hero, n = 0, design: claimed = null }) {
  if (!/^\d+$/.test(String(key))) return "";
  cardKit ??= import("../parts/player-card.js");
  savedCards ??= listCards().catch(() => new Map());
  const own = knownTiers.get(String(key)), tierMap = own !== undefined ? Promise.resolve(new Map(own ? [[String(key), own]] : [])) : wrappedTiers();
  const [{ createPlayerCards, PAINT_FILTER }, { d, games }, saved, tiers] = await Promise.all([cardKit, wrappedData(src), savedCards, tierMap]);
  const account = Number(key), ov = saved.get(account) ?? {};
  // New version (FAV_WALLS): only a card the player made, exactly as they made it. The opening slide
  // (no hero) shows their main design; a hero's slide shows the design they made for that hero, and
  // no card if they have none (never another hero's design or the site's default card).
  if (FAV_WALLS) {
    const own = ov.cosmetics ? designsOf(ov.cosmetics).filter((x) => x?.baseCard) : [];
    const id = hero ? heroId(hero) : null;
    const mine = claimed != null ? own[claimed] : id == null ? own[0] : own.find((x) => x.baseCard.hero === id);
    if (!mine) return "";
    const row = games.flatMap((m) => m.players).find((q) => playerKey(q) === key);
    const team = d.teams.find((t) => t.players.some((q) => String(q.account_id) === String(key)))?.name ?? "AD2L";
    const draw = createPlayerCards(games, { cards: new Map([[account, { ...ov, ...mine.baseCard }]]), teams: d.teams, tiers });
    return (document.getElementById("ft-paint") ? "" : PAINT_FILTER) + draw.card({ account, name: row?.name ?? "?", team }, null, { own: true, pickButtons: false, equipmentOverride: mine });
  }
  // That design, its hero swapped for the slide's: that hero's default
  // art, since a picked art or crop belongs to the hero it was picked for.
  const designs = designsOf(ov.cosmetics), design = designs.length ? designs[n % designs.length] : null;
  const base = design?.baseCard ?? { hero: ov.hero ?? null, pos: ov.pos ?? null, art: ov.art ?? null, style: ov.style ?? null, crop: ov.crop ?? null };
  const id = hero ? heroId(hero) : null;
  const baseCard = id == null || base.hero === id ? base : { ...base, hero: id, art: null, crop: null };
  const row = games.flatMap((m) => m.players).find((q) => playerKey(q) === key);
  const team = d.teams.find((t) => t.players.some((q) => String(q.account_id) === String(key)))?.name ?? (row ? (row.team === "a" ? games.find((m) => m.players.includes(row)).team_a : games.find((m) => m.players.includes(row)).team_b) : "AD2L");
  const draw = createPlayerCards(games, { cards: new Map([[account, { ...ov, ...baseCard }]]), teams: d.teams, tiers });
  return (document.getElementById("ft-paint") ? "" : PAINT_FILTER) + draw.card({ account, name: row?.name ?? "?", team }, null, { own: true, pickButtons: false, equipmentOverride: design ? { ...design, baseCard } : null });
}
// New version: each of the player's designs shows once a story. The opening takes their main design;
// a hero's slide takes their next unshown design for that hero (c.pc.design, its index), or no card.
async function claimDesigns(cards, key) {
  savedCards ??= listCards().catch(() => new Map());
  const ov = (await savedCards).get(Number(key)) ?? {};
  const own = ov.cosmetics ? designsOf(ov.cosmetics).filter((x) => x?.baseCard) : [];
  const used = new Set();
  for (const c of cards) {
    if (!c.pc || c.pc.entry || String(c.pc.key) !== String(key)) continue;
    const id = c.pc.hero ? heroId(c.pc.hero) : null;
    const i = own.findIndex((x, j) => !used.has(j) && (id == null ? j === 0 : x.baseCard.hero === id));
    if (i < 0) { c.pc = null; continue; }
    used.add(i); c.pc = { ...c.pc, design: i };
  }
}
// An Arcana Cup entry: the frozen design as it was entered (parts/arcana-cup.js draws it the same way).
async function cupCardHtml({ entry, name }) {
  cardKit ??= import("../parts/player-card.js");
  const [{ createPlayerCards, PAINT_FILTER }, d, tiers] = await Promise.all([cardKit, wrappedSrcData(SOURCES.all), wrappedTiers()]);
  const games = seasonGames(d.games);
  const team = d.teams.find((t) => t.players.some((q) => String(q.account_id) === String(entry.account)))?.name ?? "AD2L";
  const draw = createPlayerCards(games, { cards: new Map(), teams: d.teams, tiers });
  return (document.getElementById("ft-paint") ? "" : PAINT_FILTER) + draw.card({ account: Number(entry.account), name, team }, null, { own: true, pickButtons: false, equipmentOverride: entry.design }).replace("data-pick=", "data-cup-entry=");
}
function fillPlayerCard(stage, c) {
  const box = c.pc && stage.querySelector(".wr-pc");
  if (!box) return;
  (c.pc.entry ? cupCardHtml(c.pc) : playerCardHtml(c.pc)).then(async (html) => {
    if (!box.isConnected) return;
    if (!html) { box.closest(".wr-card")?.classList.remove("wr-has-pc"); box.remove(); return; }
    box.innerHTML = html;
    box.querySelectorAll(".ft-pickbtn").forEach((b) => b.remove());
    const kit = await cardKit;
    kit.fitDesignCards(box);
    // It flips for its stats and opens full size (its own buttons), like a card anywhere else.
    kit.wirePlayerCards(box);
    box.classList.add("in");
  }).catch(() => box.remove());
}

// ---------- Profile pin and Feed posts ----------
// The card a player pinned or posted ({ season, div, card }), drawn small, or "" when it can't be
// (another season, a league that's gone, or a card they no longer have). card "story" is their
// whole Wrapped (posted from its first slide): the intro card with a button to watch it all.
// The first cards (lib/wrapped-cards.js PLAYER_CARDS, awards) draw from their league alone; any
// other slide of their story (performance, More and record cards) builds the story as the page does.
export async function pinnedCardHtml(pin, account) {
  const src = pin && SOURCES[pin.div] && whole(SOURCES[pin.div]);
  if (!src || pin.season !== SEASON.name) return "";
  addStyles();
  const data = await wrappedData(src), { games, cuts, awards, results, open } = data;
  if (!open && !isLocal()) return "";
  const story = pin.card === "story", want = story ? "intro" : pin.card;
  let key = keyFor(games, account), c = null, sig = null;
  if (key && (PLAYER_CARDS.includes(want) || want.startsWith("award:"))) {
    const w = playerWrapped(games, key, { cuts, awards, results });
    if (w && want === "rating") w.ratings = await ratingsOf(src, data, key).catch(() => null);
    if (w && (want === "personality" || want === "summary") && !src.all) w.personality = (await sharedPersonality(src, key)) ?? w.personality;
    c = w && playerCards(src, w, scopeOf(src)).find((x) => x.key === want);
    sig = w?.p?.name;
  }
  if (!c) {
    key ??= keyFor((await wrappedData(SOURCES.all)).games, account);
    const s = key && await playerStory(key).catch(() => null);
    const list = s ? storyCardList(s) : [];
    c = list.find((x) => x.key === want && x.div === pin.div) ?? list.find((x) => x.key === want) ?? null;
    sig = s?.p?.name;
  }
  if (!c) return "";
  c.sig = sig;
  const href = recapHref(src.all ? SOURCES.all : src, key);
  const watch = story ? `<a class="wr-watch" href="${href}">▶ Watch ${esc(sig ?? "their")}${sig ? "’s" : ""} whole Wrapped</a>` : "";
  return `<div class="wr-pinned${story ? " wr-pinned-story" : ""}"><a class="wr-pinned-link" href="${href}">${esc(SEASON.name)} Wrapped ›</a>${cardHtml(c, { still: true })}${watch}</div>`;
}
// Every slide of a player's story that is theirs (no part, locked or ending slides), each with the
// league id (div) it belongs to: their division's, or AD2L's for the league-wide ones.
function storyCardList(s) {
  const { home, leagueShown, wDiv, wAll, p } = s, homeDiv = srcId(home ?? SOURCES.all);
  const perf = FAV_WALLS ? performanceCards(home, wDiv, leagueShown ? wAll : null, name(p)) : [];
  const across = !FAV_WALLS && leagueShown && wAll ? playerCards(SOURCES.all, wAll, scopeOf(SOURCES.all)) : [];
  return [...(wDiv ? playerCards(home, wDiv) : []), ...perf, ...across].map((c) => (c.div ? c : { ...c, div: homeDiv }));
}
// A Steam account's playerKey in these games (player_key is the main account; else account_id).
function keyFor(games, account) {
  const a = String(account);
  for (const m of games) for (const p of m.players) if (String(p.player_key) === a || String(p.account_id) === a) return playerKey(p);
  return null;
}

// ---------- Pages ----------
// The division a player's games are in, or null. Heroic/Aegis is one league here (its A and B
// views aren't split out).
async function homeOf(key) {
  for (const k of Object.keys(DIVISIONS)) {
    const src = SOURCES[k];
    if (!src) continue;
    const { games } = await wrappedData(src).catch(() => ({ games: [] }));
    if (games.some((m) => m.players.some((p) => playerKey(p) === key))) return src;
  }
  return null;
}
// A view (Heroic/Aegis A or B) reads as its whole league.
const whole = (src) => (src.view ? SOURCES[src.key] ?? src : src);
// A player's Wrapped on their profile (the Wrapped tab): the address for it.
export const recapHref = (src, key) => `${src.root}/wrapped/${encodeURIComponent(key)}`;
// A player's Wrapped to share: /<league>/wrapped/<player>/, whose page carries their own preview
// image and words (scripts/deploy/wrapped-pages.js writes it once the league's season is over).
// A slide as a PNG (Share → Image), drawn by the library the feedback screenshots use
// (lib/feedback.js), loaded on first use. The card's own buttons are left out.
const SHOT_LIB = "https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.mjs";
let shotLib;
async function slideImage(card) {
  shotLib ??= import(SHOT_LIB);
  const { domToBlob } = await shotLib;
  return domToBlob(card, { scale: 2, type: "image/png", timeout: 3000, filter: (n) => !(n instanceof Element && n.matches(".wr-pin, .wr-share, .wr-switch, .wr-resume")) });
}
// The page this one was opened from on the site (core.js navigate keeps its title): the title's
// first part ("Cev", "Wrapped"), or null when it was opened from outside.
const cameFrom = () => {
  const [name, kind] = (history.state?.from ?? "").split(" · ").map((s) => s.trim());
  return !name ? null : kind === "Players" ? `${name}'s profile` : name;
};
// A Wrapped page's link: its /path/ form where it has a preview page (lib/share.js), else /#/... .
const pageUrl = (route) => location.origin + addressOf(route);
const shareUrl = (src, key) => `${location.origin}/${slugOf(DIVISIONS_LIST.find((d) => d.key === src.key) ?? { key: src.key })}/wrapped/${key}/`;
const partCard = (n, label, sub) => ({ key: `part${n}`, tone: [3, 5, 6, 1][n - 1] ?? 4, hero: null, kicker: `Part ${n}`, body: `${big(label)}${sub ? line(sub) : ""}` });
const lockedCard = (what) => ({ key: "locked", tone: 4, hero: null, kicker: "Coming soon", body: `${big("Not yet")}${line(`${what} unlock once every division's grand final is played.`)}` });
const awardsOf = (s, d) => d.awards.map((a) => {
  const c = awardCard(s, a, d.teamName);
  if (!c?.body) return null;
  return { ...c, ...(FAV_WALLS ? { pc: null } : {}), body: c.body + runnersUp(s, a), key: `award-${srcId(s)}:${a.key}${a.key === "champions" ? `-${a.team}` : ""}` };
}).filter(Boolean);
// Under MVP and Playoff MVP: the next 3 by game MVPs, on the winner's own slide (Fav, 2026-11-25:
// "show a top 5 since there are so many players", then "one page each ... highlight the top and
// then show the next 3. so its really top 4").
// Best support, Best laner and Strongest player + hero get one too (Fav: "more of these slides
// should have top 3 or top 5 so more people can be highlighted").
const RACES = {
  mvp: { tone: 5, title: "The MVP race", blurb: "Most game MVPs.", right: (t) => `${t.value}`, note: (t) => `${t.games} games` },
  playoffMvp: { tone: 2, title: "The playoff MVP race", blurb: "Most game MVPs in playoff games.", right: (t) => `${t.value}`, note: (t) => `${t.games} playoff games` },
  support: { tone: 3, title: "The support race", blurb: "Score = how far above the average support in KP, wards, dewards, stacks and wins", right: (t) => `${t.score >= 0 ? "+" : ""}${t.score.toFixed(1)}`, note: (t) => `${pct(t.kp)} KP · ${t.wards.toFixed(1)} wards a game · ${pct(t.winRate)} wins` },
  laner: { tone: 6, title: "The laning race", blurb: "Best average lane score.", right: (t) => `${t.won}/${t.lanes}`, note: (t) => `${esc(lane(t.group))}${t.margin != null ? ` · ${signedK(t.margin)} at 10` : ""}` },
  duo: { tone: 4, title: "The duo race", blurb: "Best record on one hero, 3+ games.", right: (t) => recW({ n: t.games, w: t.wins }), note: (t) => `${esc(HERO_META.find(([n]) => n === t.hero)?.[1] ?? t.hero)} · ${t.kda.toFixed(1)} KDA` },
};
// Series of the season's second place, under the winner: teams, score, why, game links.
function seriesRunnerUp(src, r, tn) {
  if (!r) return "";
  const t = r.games[0];
  const title = r.s ? `${tn(r.s.home)} vs ${tn(r.s.away)} <b>${r.s.home_score}–${r.s.away_score}</b>` : `${esc(t.team_a)} vs ${esc(t.team_b)}`;
  const why = [`${r.swings} lead changes`, `${r.kills} kills`, ...(r.notes ?? []).slice(0, 2)].map(esc).join(" · ");
  return `<p class="wr-next">Runner-up · ${title}</p>${line(why)}${line(r.games.map((g, i) => `<a href="${src.root}/game/${esc(g.id)}">Game ${i + 1}</a>`).join(" · "))}`;
}
function runnersUp(src, a) {
  const r = RACES[a.key], rest = a.top?.slice(1, 4) ?? [];
  if (!r || !rest.length) return "";
  return `<p class="wr-next">Next up · ${esc(r.blurb)}</p>${heroRows(src, rest, r.right, (t) => [r.note(t), t.p?.team_name && esc(t.p.team_name)].filter(Boolean).join(" · "), (t) => `#${a.top.indexOf(t) + 1} ${playerLink(src, t.p)}`)}`;
}
// New version (FAV_WALLS): the Arcana Cup's results, one slide per bracket, the only cards in the
// season review: the winning card as it was entered, the podium under it. [] until a bracket settles.
async function cupCards(src) {
  const view = await cupView();
  // A podium player without a nickname takes their roster name: from All's file in its review (loaded
  // already), else the deploy's name list (data/wrapped-reads.json names), else every division's lite
  // copy (npm start has no file). Looked up only when one is needed.
  const podiums = Object.keys(CUP_CATEGORIES).flatMap((cat) => { const c = view.categories?.[cat]; return c?.phase === "done" ? cupPodium(c.order, c.entries) : []; });
  const needRoster = podiums.some((e) => view.nicknames?.[e.account] == null);
  const listed = needRoster && !src.all ? (await prebuiltFile(src.key))?.names : null;
  const teams = !needRoster || listed ? [] : src.all ? (await wrappedSrcData(SOURCES.all)).teams
    : (await Promise.all(Object.keys(DIVISIONS).filter((k) => SOURCES[k]).map((k) => divLite(k).catch(() => ({ teams: [] }))))).flatMap((d) => d.teams);
  const roster = listed ? new Map(Object.entries(listed)) : new Map(teams.flatMap((t) => t.players.map((q) => [String(q.account_id), q.name])));
  const nameOf = (e) => view.nicknames?.[e.account] ?? roster.get(String(e.account)) ?? `Player ${e.account}`;
  const heroName = (id) => HERO_META.find(([n]) => n === id)?.[1] ?? null;
  return Object.entries(CUP_CATEGORIES).map(([cat, info], i) => {
    const c = view.categories?.[cat], top = c?.phase === "done" ? cupPodium(c.order, c.entries) : [];
    if (!top.length) return null;
    const [first, ...rest] = top, tag = (e) => `${esc(nameOf(e))}${e.name ? ` <small>· ${esc(e.name)}</small>` : ""}`;
    return { key: `cup-${cat}`, tone: [4, 6][i] ?? 3, hero: heroName(first.design?.baseCard?.hero), pc: { entry: first, name: nameOf(first) },
      kicker: `Arcana Cup · ${esc(info.name)}`,
      body: `${big(tag(first))}${line(`Won the ${esc(info.name)} bracket of ${c.count} cards`)}${rest.length ? stats(rest.map((e, k) => [["2nd", "3rd"][k], tag(e)])) : ""}${line(`The top ${top.length} are Arcana player cards in the next packs.`)}` };
  }).filter(Boolean);
}
// The note over a story shown on the dev server that the live site would still lock.
const localNote = (names) => (names.length ? `<p class="wr-local-note">Local preview. On the live site ${names.join(" and ")} ${names.length > 1 ? "stay" : "stays"} locked until ${names.length > 1 || names[0] === "AD2L" ? "the grand finals are" : "the grand final is"} played.</p>` : "");

// A player's story by category (the new version's rail, Fav 2026-11-24): each slide's category,
// the order they come in, and each slide's name in the rail.
const CATEGORY_OF = {
  intro: "Season", finish: "Season",
  heroes: "Heroes", bans: "Heroes", "m-items": "Heroes", nemesis: "Heroes",
  signature: "Fighting", best: "Fighting", highlights: "Fighting", "m-early": "Fighting", "m-fight": "Fighting", hit: "Fighting", clip: "Fighting",
  rating: "Form", playoffs: "Form", "m-clutch": "Form", lane: "Form", "m-farm": "Form", "m-assists": "Form", mvps: "Form",
  "m-vision": "Around the map", "m-map": "Around the map", "m-siege": "Around the map",
  dead: "Personality", "m-hands": "Personality", personality: "Personality",
  "perf-team": "Performance", "perf-division": "Performance", "perf-league": "Performance",
  summary: "Summary",
};
const CATEGORIES = ["Season", "Heroes", "Fighting", "Form", "Around the map", "Personality", "Performance", "Summary"];
const RAIL_LABEL = { intro: "Their season", finish: "Team result", heroes: "Top heroes", bans: "Banned against", "m-items": "Item race", nemesis: "Nemesis",
  signature: "Signature", best: "Best game", highlights: "Highlight reel", "m-early": "Most active time", "m-fight": "In the fight", hit: "Biggest hit", clip: "Top play",
  rating: "Season in one line", playoffs: "Playoffs", "m-clutch": "Comeback", lane: "Laning", "m-farm": "Last hits", "m-assists": "Assists", mvps: "MVPs",
  "m-vision": "Vision", "m-map": "The work nobody sees", "m-siege": "Siege mode",
  dead: "Time in the grey", "m-hands": "Hands and mouth", personality: "Personality",
  "perf-team": "In the team", "perf-division": "In the division", "perf-league": "Across AD2L", summary: "Summary", end: "That's a wrap",
  "t-record": "The record", "t-heroes": "Heroes", "t-map": "The work nobody sees", showdown: "Division showdown" };
const plainText = (s) => String(s).replace(/<[^>]*>/g, "");
// Leaderboards and cup slides sit under a part already named for their scope: drop "AD2L · ".
const railLabel = (c) => RAIL_LABEL[c.key] ?? c.rail ?? (c.key.startsWith("award:") ? plainText(c.kicker).replace(/^.* won /, "") : /^(board-|cup-)/.test(c.key) ? plainText(c.kicker).replace(/^.*? · /, "") : plainText(c.kicker));
function byCategory(cards) {
  const groups = new Map(CATEGORIES.map((k) => [k, []]));
  for (const c of cards) {
    if (/^part\d+$/.test(c.key)) continue;
    const k = CATEGORY_OF[c.key] ?? (c.key.startsWith("award:") || c.key.startsWith("m-rec-") ? "Form" : "Summary");
    groups.get(k).push(c);
  }
  return [...groups].filter(([, cs]) => cs.length).map(([label, cs]) => ({ n: null, label, cards: cs, slides: true }));
}
// The same rail for a team's story and the season review: each part keeps its name, loses its
// "Part N" slide, and lists every slide under it.
const slideParts = (parts) => parts.map((x) => ({ ...x, n: null, slides: true, cards: x.cards.filter((c) => !/^part\d+$/.test(c.key)) })).filter((x) => x.cards.length);
// A story of cards in root: the parts rail (desktop), the card with tap zones, arrows and swipes.
// parts: [{ n, label, cards }]; opening and ending cards go around them. pins: { own, viewer,
// pinned, profile } lets the owner pin their cards (cards with a div).
// share: { url, title } adds a Share button (the player's link, with its own preview image).
// heroes: the story's own heroes (a player's most played). Slides with no hero of their own take
// them in turn as their wallpaper instead of a hero picked at random.
// short: the highlights cut of a player's story (?short=1), remembered apart from the full story.
// mode: { label, go } a small button in every card's footer that switches between the two.
function mountStory(root, { title, railTitle, opening, parts, ending, pins = null, share = null, extra = "", heroes = [], pool = [], short = false, mode = null }) {
  let spare = 0;
  // opening: null starts the story at part 1 (a player's page, opened from that same slide).
  const cards = [opening, ...parts.flatMap((x) => x.cards), ending].filter(Boolean).map((c) => (c.hero || c.pc?.hero || !heroes.length ? c : { ...c, wall: heroes[spare++ % heroes.length] }));
  if (FAV_WALLS && favWalls) assignWalls(cards, pool);
  // Slide borders: matched once the backgrounds are read; the slide on screen swaps to its match.
  if (FAV_BORDERS && favWalls) matchBorders(cards).then(() => {
    const c = cards[at], el = stage?.querySelector(".wr-border");
    if (el && c?.border && el.dataset.border !== c.border) el.outerHTML = favBorderHtml(c.bg, c.border);
  });
  let n = opening ? 1 : 0;
  for (const x of parts) { x.at = n; n += x.cards.length; }
  // The rail's list of parts and slides; phones, where the rail is hidden, get it as a sheet over
  // the card (tap the progress bar or the card count).
  const railList = `<ol>${parts.map((x) => `<li><button type="button" data-jump="${x.at}" data-part>${x.n != null ? `<span>Part ${x.n}</span>` : ""}${x.label}</button>${x.slides ? `<ol class="wr-rail-slides">${x.cards.map((c, i) => `<li><button type="button" data-jump="${x.at + i}" data-slide>${esc(railLabel(c))}</button></li>`).join("")}</ol>` : ""}</li>`).join("")}</ol>`;
  root.innerHTML = `<div class="wr-page${FAV_WALLS ? " wr-new" : ""}">
      ${extra}
      <div class="wr-layout">
        <nav class="wr-rail" aria-label="Parts">
          <p class="wr-rail-title">${railTitle}</p>
          ${railList}
          <div class="wr-rail-keys"><button type="button" class="wr-arrow" data-step="-1" aria-label="Previous card">←</button><span class="wr-count"></span><button type="button" class="wr-arrow" data-step="1" aria-label="Next card">→</button></div>
        </nav>
        <div class="wr-story" tabindex="0" aria-roledescription="story" aria-label="${esc(title)}">
          <div class="wr-progress">${cards.map((_, i) => `<span data-seg="${i}"><i></i></span>`).join("")}</div>
          <div class="wr-top">
            <button type="button" class="wr-count-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="All cards"><span class="wr-count-m"></span> <span aria-hidden="true">▾</span></button>
            <button type="button" class="wr-play" aria-pressed="false" hidden></button>
          </div>
          <div class="wr-stage"></div>
          <p class="sr-only" aria-live="polite" aria-atomic="true" data-say></p>
          <button type="button" class="wr-tap wr-prev" aria-label="Previous card"></button>
          <button type="button" class="wr-tap wr-next" aria-label="Next card"></button>
          <div class="wr-list" role="dialog" aria-label="All cards" hidden>
            <div class="wr-list-head"><b>${railTitle}</b><button type="button" data-close aria-label="Close">✕</button></div>
            ${railList}
          </div>
        </div>
      </div>
      <p class="wr-pin-msg" role="status"></p>
    </div>`;
  let pinned = pins?.pinned ?? null;
  const pinnable = (c) => !!pins?.own && !!c.div && (PLAYER_CARDS.includes(c.key) || c.key.startsWith("award:"));
  const isPinned = (c) => pinned?.season === SEASON.name && pinned.div === c.div && pinned.card === c.key;
  // Post: hands the card to the Feed's post box (parts/feed-compose.js reads the same key) and opens
  // the Feed, where the player adds their own words before posting.
  // The first slide posts the whole Wrapped; any other slide of the player's own story posts that card.
  const postable = (c) => !!pins?.own && (at === 0 || (!/^part\d+$/.test(c.key) && !["locked", "end"].includes(c.key)));
  const postBtn = (c) => (postable(c) ? `<button type="button" class="wr-share" data-post-feed>${at === 0 ? "Post my Wrapped" : "Post this card"}</button>` : "");
  const pinBtn = (c) => (pinnable(c) ? `<button type="button" class="wr-pin" data-pin="${esc(c.key)}" aria-pressed="${isPinned(c)}">${isPinned(c) ? "📌 Pinned to profile" : "📌 Pin to profile"}</button>` : "");
  const story = root.querySelector(".wr-story"), stage = story.querySelector(".wr-stage"), msg = root.querySelector(".wr-pin-msg"), rail = root.querySelector(".wr-rail");
  wireArt(stage);
  let at = 0;
  wireSwitch(stage, () => cards[at]);
  const list = story.querySelector(".wr-list"), countBtn = story.querySelector(".wr-count-btn"), playBtn = story.querySelector(".wr-play");
  const say = story.querySelector("[data-say]");
  const local = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } } };
  // Where this story was left (lib/story-player.js): saved on every move after it opens.
  const rKey = resumeKey(location.pathname, short), saved = local.get(rKey);
  // offer: the card "Continue from" points at, shown in the first card's footer until they move.
  let opened = false, offer = null;
  // Auto-play (off until turned on, the choice remembered): each card moves on after slideMs, its
  // progress segment filling as it goes. Held while pressed, while the tab is hidden, while Share
  // or Image is working and while the card list is open; it stops on the last card. Never where
  // motion is turned down.
  const AUTO_KEY = "wr-autoplay", holds = new Set();
  let auto = !calm() && local.get(AUTO_KEY) === "1", spent = 0, dur = slideMs(null), last = 0, frame = 0;
  const running = () => auto && !holds.size && at < cards.length - 1;
  const paintPlay = () => {
    story.classList.toggle("wr-auto", auto);
    playBtn.hidden = calm();
    playBtn.setAttribute("aria-pressed", String(auto));
    playBtn.setAttribute("aria-label", auto ? "Pause auto-play" : "Play cards automatically");
    playBtn.textContent = auto ? "❚❚" : "▶";
    const s = story.querySelector(`[data-seg="${at}"] i`);
    if (s) s.style.width = auto && at < cards.length - 1 ? `${Math.min(100, (spent / dur) * 100)}%` : "";
  };
  const tick = (t) => {
    frame = 0;
    if (!story.isConnected || !auto) return;
    // A long gap (the tab was in the background) counts as one frame.
    const dt = Math.min(100, t - last); last = t;
    if (running()) { spent += dt; if (spent >= dur) show(at + 1); }
    paintPlay();
    frame = requestAnimationFrame(tick);
  };
  const loop = () => { if (!frame && auto) { last = performance.now(); frame = requestAnimationFrame(tick); } };
  const show = (i) => {
    at = Math.max(0, Math.min(cards.length - 1, i));
    if (opened) offer = null;
    const resumeBtn = offer != null && at === 0 ? `<button type="button" class="wr-resume" data-resume>Continue from card ${offer + 1} ›</button>` : "";
    const modeBtn = mode ? `<button type="button" class="wr-share wr-modebtn" data-mode>${mode.label}</button>` : "";
    stage.innerHTML = cardHtml(cards[at], { pin: resumeBtn + modeBtn + (share ? '<button type="button" class="wr-share" data-share>Share</button>' : "") + '<button type="button" class="wr-share wr-shot" data-shot>Image</button>' + postBtn(cards[at]) + pinBtn(cards[at]), index: at });
    fillPlayerCard(stage, cards[at]);
    // Screen readers hear the kicker and the big line, not the whole card (the stage isn't live).
    // Read before countUp, which starts the numbers at 0.
    const bigEl = stage.querySelector(".wr-big");
    say.textContent = [stage.querySelector(".wr-kicker")?.textContent.trim(), bigEl && [...bigEl.childNodes].map((x) => x.textContent.trim()).filter(Boolean).join(" "), `Card ${at + 1} of ${cards.length}`].filter(Boolean).join(". ");
    countUp(stage.querySelector(".wr-card"));
    // The next two slides' renders, fetched ahead so they're there when you tap.
    for (const next of cards.slice(at + 1, at + 3)) {
      const ahead = next.hero && (next.repeat ? (next.bg ?? backdropOf(next)) : !next.pc && heroRender(next.hero));
      if (ahead) new Image().src = ahead;
      const aheadWall = wallOf(next);
      if (aheadWall) new Image().src = aheadWall;
    }
    story.querySelectorAll("[data-seg]").forEach((s, j) => { s.classList.toggle("done", j < at); s.classList.toggle("now", j === at); s.firstElementChild.style.width = ""; });
    spent = 0; dur = slideMs(cards[at]); paintPlay();
    if (opened) local.set(rKey, String(at));
    story.querySelector(".wr-prev").disabled = at === 0;
    story.querySelector(".wr-next").disabled = at === cards.length - 1;
    rail.querySelectorAll("[data-step]").forEach((b) => { b.disabled = b.dataset.step === "-1" ? at === 0 : at === cards.length - 1; });
    rail.querySelector(".wr-count").textContent = story.querySelector(".wr-count-m").textContent = `${at + 1} / ${cards.length}`;
    // The slide rides in the address (?slide=N, from 1), so back/forward and a copied link come
    // back to it. replaceState: moving through slides adds no history entries.
    const u = new URL(location.href);
    if (at) u.searchParams.set("slide", at + 1); else u.searchParams.delete("slide");
    if (u.href !== location.href) { history.replaceState(history.state, "", u.pathname + u.search + u.hash); setRoutedAt(location.href); }
    const part = parts.findLastIndex((x) => x.at <= at);
    for (const box of [rail, list]) box.querySelectorAll("[data-part]").forEach((b, j) => b.setAttribute("aria-current", String(j === part)));
    list.querySelectorAll("[data-slide]").forEach((b) => b.setAttribute("aria-current", String(Number(b.dataset.jump) === at)));
    // A category rail lists every slide: the current one lit, kept in view as the story moves.
    rail.querySelectorAll("[data-slide]").forEach((b) => {
      const on = Number(b.dataset.jump) === at;
      b.setAttribute("aria-current", String(on));
      if (on) b.scrollIntoView({ block: "nearest" });
    });
  };
  // A press held on the card pauses auto-play; letting go doesn't also turn the card.
  let downAt = 0, heldLong = false;
  const tapped = (step) => () => { if (heldLong) { heldLong = false; return; } show(at + step); };
  story.querySelector(".wr-prev").onclick = tapped(-1);
  story.querySelector(".wr-next").onclick = tapped(1);
  story.addEventListener("pointerdown", (e) => {
    heldLong = false;
    if (e.button > 0 || e.target.closest("a, button:not(.wr-tap), input, iframe, video, .wr-pc, .wr-list")) return;
    downAt = performance.now(); holds.add("press");
  });
  const release = () => { if (holds.delete("press")) heldLong = auto && performance.now() - downAt > 350; };
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) story.addEventListener(ev, release);
  // No long-press menu on the tap zones (it would cover the card on phones).
  story.addEventListener("contextmenu", (e) => { if (e.target.closest(".wr-tap")) e.preventDefault(); });
  const onVis = () => {
    if (!story.isConnected) return document.removeEventListener("visibilitychange", onVis);
    if (document.hidden) holds.add("hidden"); else holds.delete("hidden");
  };
  document.addEventListener("visibilitychange", onVis);
  playBtn.addEventListener("click", () => {
    auto = !auto; local.set(AUTO_KEY, auto ? "1" : "0");
    paintPlay(); loop();
  });
  // The card list (phones): the card count or the progress bar opens it.
  const openList = (open) => {
    list.hidden = !open; countBtn.setAttribute("aria-expanded", String(open));
    if (open) holds.add("list"); else holds.delete("list");
    if (!open) return;
    const now = list.querySelector('[data-slide][aria-current="true"]') ?? list.querySelector('[data-part][aria-current="true"]') ?? list.querySelector("[data-jump]");
    now?.scrollIntoView({ block: "center" });
    now?.focus({ preventScroll: true });
  };
  countBtn.addEventListener("click", () => openList(list.hidden));
  story.querySelector(".wr-progress").addEventListener("click", () => { if (!matchMedia("(min-width: 900px)").matches) openList(true); });
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-jump], [data-close]");
    if (!b) return;
    openList(false);
    if (b.dataset.jump != null) show(Number(b.dataset.jump));
    story.focus({ preventScroll: true });
  });
  rail.addEventListener("click", (e) => {
    const b = e.target.closest("[data-jump], [data-step]");
    if (!b) return;
    show(b.dataset.jump != null ? Number(b.dataset.jump) : at + Number(b.dataset.step));
    story.focus({ preventScroll: true });
  });
  story.addEventListener("keydown", (e) => {
    // Esc closes the card list, else does what the full page's back link does.
    if (e.key === "Escape") {
      if (!list.hidden) { openList(false); story.focus({ preventScroll: true }); }
      else root.closest(".wr-full")?.querySelector(".wr-close")?.click();
      return;
    }
    // Keys on the list's or the card's own buttons and links work those, not the story.
    if (e.target.closest(".wr-list") || (e.key === " " && e.target !== story && e.target.closest("a, button"))) return;
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); show(at + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    else if (e.key === "Home") { e.preventDefault(); show(0); }
    else if (e.key === "End") { e.preventDefault(); show(cards.length - 1); }
  });
  // Swipe on touch screens.
  let x0 = null;
  // Not from a clip's player, where a sideways drag scrubs the video.
  story.addEventListener("touchstart", (e) => { x0 = e.target.closest("video") ? null : e.touches[0].clientX; }, { passive: true });
  story.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1));
  });
  // Share: the phone's share sheet where there is one, else the link copied. The link opens on
  // the slide on screen (and the highlights cut, when that's what's open).
  const shareLink = () => {
    if (!short && !at) return share.url;
    const u = new URL(share.url, location.href);
    if (short) u.searchParams.set("short", "1");
    if (at) u.searchParams.set("slide", at + 1);
    return u.href;
  };
  stage.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-share]")) return;
    e.stopPropagation();
    const url = shareLink();
    holds.add("busy");
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: share.title, url });
      else { await navigator.clipboard.writeText(url); msg.textContent = "Link to this slide copied. It shows this Wrapped's card when you post it."; }
    } catch (err) { if (err?.name !== "AbortError") msg.textContent = `Copy this link: ${url}`; }
    holds.delete("busy");
  });
  // Image: the slide on screen as a picture. Phones: the share sheet with the picture attached.
  // Elsewhere: copied, to paste straight into Discord (else downloaded).
  stage.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-shot]");
    if (!b) return;
    e.stopPropagation();
    const card = stage.querySelector(".wr-card"), name = `wrapped-slide-${at + 1}.png`;
    b.disabled = true; msg.textContent = "Making the image…"; holds.add("busy");
    const blob = slideImage(card);
    try {
      if (matchMedia("(pointer: coarse)").matches && navigator.canShare) {
        const file = new File([await blob], name, { type: "image/png" });
        if (!navigator.canShare({ files: [file] })) throw new Error("no file share");
        await navigator.share({ files: [file], title: share?.title ?? title, ...(share ? { text: shareLink() } : {}) });
        msg.textContent = "";
      } else if (navigator.clipboard?.write && window.ClipboardItem) {
        // The blob as a promise: Safari only allows the write straight from the tap.
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        msg.textContent = "Slide image copied. Paste it into Discord.";
      } else throw new Error("no clipboard");
    } catch (err) {
      if (err?.name === "AbortError") msg.textContent = "";
      else {
        try {
          const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await blob), download: name });
          a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
          msg.textContent = "Slide image downloaded.";
        } catch (e2) { msg.textContent = `Couldn't make the image (${e2.message}).`; }
      }
    }
    b.disabled = false; holds.delete("busy");
  });
  stage.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pin]");
    if (!b) return;
    e.stopPropagation();
    const c = cards[at], unpin = b.getAttribute("aria-pressed") === "true";
    b.disabled = true; msg.textContent = unpin ? "Unpinning…" : "Pinning…";
    try {
      const pin = unpin ? null : { season: SEASON.name, div: c.div, card: c.key };
      const res = await collectionAction("wrapped-pin", { pin });
      pinned = res?.state?.wrappedPin ?? pin;
      msg.textContent = unpin ? "Unpinned." : "Pinned. It shows under your name on this profile.";
      // The profile's pinned card follows (parts/collection.js draws it on load).
      document.querySelector(".wr-pinned")?.remove();
      if (pinned) pinnedCardHtml(pinned, pins.viewer).then((html) => { if (html) document.querySelector(".pp-head")?.insertAdjacentHTML("afterend", html); });
    } catch (err) { msg.textContent = err.message; }
    show(at);
  });
  stage.addEventListener("click", (e) => {
    if (!e.target.closest("[data-post-feed]")) return;
    e.stopPropagation();
    const c = cards[at], whole = at === 0, label = whole ? `My whole ${SEASON.name} Wrapped` : String(c.kicker ?? c.key).replace(/<[^>]*>/g, "").slice(0, 60);
    const ref = { season: SEASON.name, div: whole ? pins.storyDiv : c.div ?? pins.storyDiv, card: whole ? "story" : c.key, label };
    try { sessionStorage.setItem("feed-wrapped-draft", JSON.stringify(ref)); }
    catch { msg.textContent = "This browser blocked the hand-off. Allow site storage and try again."; return; }
    location.hash = "#/gallery/feed";
  });
  // ?slide=N opens on that slide (back from another page, or a shared link). Without it, a story
  // left part way offers to continue there; it doesn't jump on its own.
  const start = Number(new URLSearchParams(location.search).get("slide"));
  const fromSlide = Number.isInteger(start) && start > 0;
  offer = fromSlide ? null : resumeAt(saved, cards.length);
  show(fromSlide ? start - 1 : 0);
  opened = true;
  stage.addEventListener("click", (e) => {
    if (!e.target.closest("[data-mode]")) return;
    e.stopPropagation();
    mode.go();
  });
  stage.addEventListener("click", (e) => {
    if (!e.target.closest("[data-resume]")) return;
    e.stopPropagation();
    show(offer ?? at);
    story.focus({ preventScroll: true });
  });
  loop();
}

// A player's own Wrapped: part 1 them in their division, part 2 them across AD2L. It has a page of
// its own (#/<division>/wrapped/<player>, full screen); their profile's Wrapped tab opens it. There
// is something to show once their division's grand final is played (part 1), every division's
// (part 2); the dev server shows both. Null when there's nothing yet.
// Every division's season games, for the cards that compare divisions: [{ key, name, games, players }].
let allDivs;
const allDivisions = () => (allDivs ??= Promise.all(DIVISIONS_LIST.filter((d) => SOURCES[d.key]).map(async (d) => {
  const x = await wrappedData(SOURCES[d.key]);
  return { key: d.key, name: d.name, games: x.games, players: (x.parsed ??= parsedPlayers(x.games)) };
})).catch((e) => { allDivs = null; throw e; }));
const everyDivOf = async (home, key) => everyDivision(await allDivisions(), home.key, key);

// A player's league-wide parts, worked out at deploy (scripts/deploy/wrapped-reads.js writes
// data/wrapped/<account>.json): with it, their Wrapped loads their own division only. Null on
// npm start, for the old version (?wrapWalls=now) and for players without an account id.
const playerFiles = {};
const playerFile = (key) => (playerFiles[key] ??= !FAV_WALLS || !/^\d+$/.test(String(key)) ? Promise.resolve(null)
  : fetch(`data/wrapped/${key}.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null))
    .then((f) => (f?.season === SEASON.name && SOURCES[f.home] ? f : null)).catch(() => null));
// Card tiers the player files gave (account -> { tier, rating } or null), so their card needn't load every division.
const knownTiers = new Map();
async function playerStory(key) {
  const pre = await playerFile(key);
  if (pre) {
    const home = SOURCES[pre.home], div = await wrappedData(home);
    const divShown = div.open || isLocal(), leagueShown = pre.allOpen || isLocal();
    const wDiv = divShown && div.d.updated === pre.updated ? playerWrapped(div.games, key, { cuts: div.cuts, awards: div.awards, results: div.results }) : null;
    if (wDiv) {
      knownTiers.set(String(key), pre.tier ?? null);
      wDiv.ratings = await ratingsOf(home, div, key).catch(() => null);
      wDiv.personality = pre.personality ?? wDiv.personality;
      wDiv.more = moreOf(div.parsed ??= parsedPlayers(div.games), key); wDiv.perf = performanceOf(div.parsed, key);
      const clip = clipOf(key), cm = clip && div.games.find((m) => String(m.id) === String(clip.match));
      wDiv.clipHero = cm?.players.find((q) => playerKey(q) === key)?.hero ?? null;
      const wAll = leagueShown ? { ...pre.league, everyDiv: pre.everyDiv, p: wDiv.p, heroes: wDiv.heroes, played: wDiv.played } : null;
      return { all: { open: pre.allOpen }, home, div, divShown, leagueShown, wDiv, wAll, p: wDiv.p };
    }
  }
  const [all, home] = await Promise.all([wrappedData(SOURCES.all), homeOf(key)]);
  const div = home ? await wrappedData(home) : null;
  const divShown = !!div && (div.open || isLocal()), leagueShown = all.open || isLocal();
  const wDiv = divShown ? playerWrapped(div.games, key, { cuts: div.cuts, awards: div.awards, results: div.results }) : null;
  const wAll = playerWrapped(all.games, key, { cuts: all.cuts, awards: all.awards, results: all.results });
  if (!wDiv && !(leagueShown && wAll)) return null;
  if (wDiv) {
    wDiv.ratings = await ratingsOf(home, div, key).catch(() => null);
    wDiv.personality = (await sharedPersonality(home, key)) ?? wDiv.personality;
    if (FAV_WALLS) {
      wDiv.more = moreOf(div.parsed ??= parsedPlayers(div.games), key); wDiv.perf = performanceOf(div.parsed, key);
      // Record boards they're top 5 on: AD2L's (when it's shown) and their division's.
      wDiv.records = playerRecords([leagueShown && { name: "AD2L", records: (all.records ??= gameRecords(all.games)) }, { name: leagueName(home), records: (div.records ??= gameRecords(div.games)) }].filter(Boolean), key, wDiv.more);
    }
    const clip = clipOf(key), cm = clip && div.games.find((m) => String(m.id) === String(clip.match));
    wDiv.clipHero = cm?.players.find((q) => playerKey(q) === key)?.hero ?? null;
  }
  if (FAV_WALLS && wAll && leagueShown && home) wAll.everyDiv = await everyDivOf(home, key).catch((e) => (console.warn("every division unavailable", e), null));
  return { all, home, div, divShown, leagueShown, wDiv, wAll, p: (wDiv ?? wAll).p };
}

// What a profile's Wrapped tab shows, or null when there's no Wrapped for them. From the deploy's
// data/wrapped-players.json (scripts/deploy/wrapped-pages.js), so a profile doesn't load every
// division; worked out from the games when there's no file (npm start, which also shows locked ones).
let playerIndex;
const wrappedPlayers = () => (playerIndex ??= fetch("data/wrapped-players.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : null)).then((f) => (f?.season === SEASON.name ? f.players : null)).catch(() => null));
async function profileTab(key) {
  const index = await wrappedPlayers();
  if (index) {
    const e = index[key], home = e && SOURCES[e.home];
    if (!home) return null;
    // Their chosen name now (lib/nicknames.js), not the one at deploy.
    await loadNicknames();
    return { home, p: { name: nicknameOf(key) ?? e.name }, heroes: e.heroes ?? [], team: e.team, teamId: e.teamId, divShown: true };
  }
  const s = await playerStory(key);
  if (!s) return null;
  const w = s.wDiv ?? s.wAll;
  // Their team: the one they played the most division games for (not a team they subbed for once).
  const teamId = mainTeamOf((s.div?.games ?? []).flatMap((m) => m.players.filter((x) => playerKey(x) === key).map((q) => ({ m, p: q })))).id;
  return { home: s.home, p: s.p, heroes: w.heroes.map((h) => h.hero), team: w.team ?? null, teamId, divShown: s.divShown };
}

// The profile's Wrapped tab: the opening slide, which opens the full page. The tab
// (#pp-tab-wrapped) stays hidden until there's a Wrapped to open.
export async function mountPlayerWrapped(host, key) {
  const box = host.querySelector(".profile-wrapped-box"), tab = host.querySelector("#pp-tab-wrapped");
  if (!box) return;
  addStyles();
  const t = await profileTab(key);
  if (!box.isConnected || !t) return;
  const { home, p, heroes, team, teamId, divShown } = t;
  const href = recapHref(home ?? SOURCES.all, key);
  const dname = home ? leagueName(home).replace(/<[^>]*>/g, "") : null;
  const teamHref = home && teamId != null && divShown ? teamRecapHref(home, teamId) : null;
  const s = { home, p };
  // Four Wrappeds side by side: the player's, their team's, their division's season review and
  // AD2L's. href null: not openable yet.
  const cards = [
    { href, label: `Open ${name(s.p)}'s Wrapped`, c: { key: "open", tone: 1, wall: heroes[0], kicker: "Player", body: `${big("Wrapped")}${line(`${name(s.p)}'s season in review`)}` } },
    { href: teamHref, label: team ? `Open ${esc(team)} Wrapped` : "Team Wrapped", c: { key: "launch-team", tone: 3, wall: heroes[1] ?? null, kicker: "Team", body: `${big("Team")}${line(team ? esc(team) : "Their team's season")}${teamHref ? "" : line('<span class="wr-hint">Coming soon</span>')}` } },
    { href: dname ? `${s.home.root}/wrapped/review` : null, label: `Open ${esc(dname ?? "division")} Wrapped`, c: { key: "launch-division", tone: 5, wall: null, kicker: "Division", body: `${big(esc(dname ?? "Division"))}${line(`${esc(SEASON.name)} season review`)}` } },
    { href: "#/wrapped", label: "Open AD2L Wrapped", c: { key: "launch-ad2l", tone: 6, wall: null, kicker: "AD2L", body: `${big("AD2L")}${line("Every division's awards")}` } },
  ];
  for (const { c } of cards) { const word = c.body.match(/^<[^>]*>([^<]*)</)?.[1] ?? "Wrapped"; c.body = `<div style="--len:${Math.max(7, word.length)}">${c.body}</div>`; }
  box.innerHTML = `<div class="wr-launch wr-launch-four">${cards.map(({ href: h, label, c }) => `<div class="wr-launch-one${h ? "" : " wr-launch-soon"}">
      ${h ? `<a class="wr-launch-card" href="${h}" aria-label="${label}">` : `<div class="wr-launch-card" aria-label="${label}, coming soon">`}${cardHtml({ hero: null, ...c, kicker: `${c.kicker} · ${esc(SEASON.name)}` }, { still: true })}${h ? "</a>" : "</div>"}
      ${h ? `<a class="wr-launch-go" href="${h}">Open ›</a>` : `<span class="wr-launch-go">Coming soon</span>`}
    </div>`).join("")}</div>`;
  if (tab) tab.hidden = false;
}

// ---------- Team Wrapped ----------
// A team's season (#/<division>/wrapped/team/<team id>): record and heroes, then vision, where
// they died, when they killed, their comeback and throw, objectives; the draft; and the team's
// style against its division. Numbers from lib/team-wrapped.js.
export const teamRecapHref = (src, id) => `${src.root}/wrapped/team/${encodeURIComponent(id)}`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const kShort = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : fmt(n));
const mapHtml = (inner) => `<div class="wr-map"><svg viewBox="${MAP_VB.x} ${MAP_VB.y} ${MAP_VB.w} ${MAP_VB.h}" aria-hidden="true"><image href="img/minimap.webp" x="${MAP_VB.x}" y="${MAP_VB.y}" width="${MAP_VB.w}" height="${MAP_VB.h}" preserveAspectRatio="none" opacity=".85"/>${inner}</svg></div>`;
const ring = (s, r, fill) => `<circle cx="${s.x}" cy="${mapY(s.y)}" r="${r}" fill="${fill}" opacity=".25"/><circle cx="${s.x}" cy="${mapY(s.y)}" r="${r}" fill="none" stroke="#fff" stroke-width=".9"/>`;
const leadGraph = (lead) => {
  const W = 300, H = 80, mx = Math.max(...lead.map(Math.abs), 1);
  const pts = lead.map((v, i) => `${((i / Math.max(1, lead.length - 1)) * W).toFixed(1)},${(H / 2 - (v / mx) * (H / 2 - 4)).toFixed(1)}`).join(" ");
  return `<svg class="wr-graph" viewBox="0 0 ${W} ${H}" aria-hidden="true"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="rgba(255,255,255,.25)"/><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`;
};

function teamCards(src, t) {
  const cards = [], tn = esc(t.name), hours = Math.max(1, Math.round(t.minutes / 60));
  const core = t.roster.filter((r) => r.games > r.standin);
  cards.push({ key: "t-record", tone: 1, hero: null, kicker: `${tn}'s ${esc(SEASON.name)}`,
    body: `${big(`${t.wins}–${t.losses}`)}${line(`${plural(t.games, "game")} · ${plural(hours, "hour")} together`)}${stats([["Kills", fmt(t.kills)], ["Deaths", fmt(t.deaths)], ["Win rate", pct(t.wins / t.games)]])}${line(core.slice(0, 7).map((r) => `${esc(r.name)} <small>${r.games}</small>`).join(" · "))}` });
  if (t.heroes.length) cards.push({ key: "t-heroes", tone: 2, hero: t.heroes[0].hero, kicker: `${tn}'s heroes`,
    body: `<ol class="wr-heroes">${t.heroes.slice(0, 5).map((h) => `<li>${heroImg(h.hero) ? `<img src="${esc(heroImg(h.hero))}" alt="" loading="lazy">` : "<span></span>"}<span class="wr-hname">${heroLink(src, h.hero)}<small>${plural(h.n, "game")}</small></span><b class="wr-hrec">${recW(h)}</b></li>`).join("")}</ol>${line(`${plural(t.heroes.length, "hero")} played as a team`)}` });
  const v = t.vision;
  if (v) cards.push({ key: "t-vision", tone: 6, hero: null, kicker: "Your vision",
    body: `${big(fmt(v.total), "observers")}${line(`${gold(pct(v.unfound))} never found · ${fmt(v.dewards)} enemy wards killed`)}${mapHtml(v.wards.map((w) => `<circle cx="${w.x}" cy="${mapY(w.y)}" r="${w.killed ? 0.9 : 1.1}" fill="${w.killed ? "#ff4f6b" : "#1ed760"}" opacity="${w.killed ? 0.5 : 0.6}"/>`).join("") + ring(v.spot, 6, "#2fd4ff"))}${line(`Circle: your spot, ${v.spot.n} wards.${v.topPlacer ? ` Most placed by ${esc(v.topPlacer[0])} (${v.topPlacer[1]}).` : ""}`)}` });
  const d = t.danger;
  if (d) cards.push({ key: "t-danger", tone: 1, hero: null, kicker: "Danger zone",
    body: `${big(fmt(d.spot.n), "deaths, one spot")}${line(`${d.spot.n} of your ${fmt(d.pts.length)} teamfight deaths happened in the same patch of map.`)}${mapHtml(d.pts.map(([x, y]) => `<g transform="translate(${x} ${mapY(y)})" stroke="#ff4f6b" stroke-width=".6" opacity=".75"><line x1="-1.2" y1="-1.2" x2="1.2" y2="1.2"/><line x1="1.2" y1="-1.2" x2="-1.2" y2="1.2"/></g>`).join("") + `<circle cx="${d.spot.x}" cy="${mapY(d.spot.y)}" r="9" fill="none" stroke="#fff" stroke-width=".8" stroke-dasharray="1.6 1.2"/>`)}${line("Teamfight deaths only. Dire games mirrored: your base is bottom left.")}` });
  const c = t.clock;
  if (c) {
    const lbl = (i) => (i === 8 ? "40+" : `${i * 5}`), span = (i) => (i === 8 ? "40+" : `${i * 5}–${i * 5 + 5}`);
    const bars = (v, peak) => { const mx = Math.max(...v) || 1; return `<div class="wr-bars">${v.map((n, i) => `<i class="${i === peak ? "hi" : ""}" style="height:${(n / mx) * 100}%"><span>${lbl(i)}</span></i>`).join("")}</div>`; };
    const fb = c.fbGames ? line(`First blood in ${gold(`${c.fbWins} of ${c.fbGames}`)} games${c.fbWinRate != null ? `, and won ${pct(c.fbWinRate)} of those` : ""}.`) : "";
    cards.push({ key: "t-clock", tone: 5, hero: null, kicker: "Your kill clock", view: "min",
      views: [c.perGame && { id: "game", label: "A game", body: `${big(span(c.peakGame), "min")}${line(`Where your kills land: ${c.perGame[c.peakGame].toFixed(1)} team kills a game in that stretch (${fmt(c.bins[c.peakGame])} of ${fmt(c.total)}).`)}${bars(c.perGame.slice(0, 8), c.peakGame)}${line(`<span class="wr-hint">Then ${c.perGame[8].toFixed(1)} a game after 40:00. Every game counts in every stretch.</span>`)}${fb}` },
        { id: "min", label: "A minute", body: `${big(span(c.peak), "min")}${line(`Your deadliest stretch: ${perMin(c.rate[c.peak] * 5)} team kills a minute (${fmt(c.bins[c.peak])} of ${fmt(c.total)} kills).`)}${bars(c.rate, c.peak)}${fb}` }].filter(Boolean) });
  }
  const k = t.clutch;
  if (k) {
    const main = k.comeback ?? k.thrown;
    cards.push({ key: "t-clutch", tone: 3, hero: null, kicker: k.comeback ? "Never out" : "The one that hurt",
      body: `${big(`${(main.d / 1000).toFixed(1)}k`, k.comeback ? "down. Won." : "up. Lost.")}${line(`${k.comeback ? "Your best comeback" : "Your biggest throw"}: vs ${esc(main.vs)}, ${mmss(main.m.duration_sec)}.`)}<div class="wr-graphbox ${k.comeback ? "up" : "down"}">${leadGraph(main.lead)}</div>${k.comeback && k.thrown ? line(`The one that hurt: up ${(k.thrown.d / 1000).toFixed(1)}k against ${esc(k.thrown.vs)}, and lost.`) : ""}${k.behind ? line(`Won ${gold(`${k.behindWins} of ${k.behind}`)} games after falling 5k behind.`) : ""}` });
  }
  const s = t.siege;
  if (s) cards.push({ key: "t-siege", tone: 2, hero: null, kicker: "Siege mode",
    body: `${big(fmt(s.roshans), s.roshans === 1 ? "Roshan" : "Roshans")}${line(`${s.perGame.toFixed(2)} a game`)}${stats([["Tormentors", fmt(s.tormentors)], ["Towers", fmt(s.towers)], ["Barracks", fmt(s.rax)], ["Building dmg", kShort(s.damage)]])}` });
  return cards;
}
// A hero or player name as the big word, on one line, sized to fit the card.
const bigName = (t, unit = "") => `<div class="wr-fitbox"><div class="wr-big wr-fit" style="--len:${Math.max(6, String(t).length)}">${esc(t)}${unit ? `<small>${unit}</small>` : ""}</div></div>`;
const rec = (r) => `${r.w}–${r.n - r.w}`;
// A small win % under a record: supporting, never the headline. recW: the record with it.
const winPct = (r) => (r.n ? `${Math.round((r.w / r.n) * 100)}%` : "");
const recW = (r) => `${rec(r)}${r.n ? `<small class="wr-wr ${r.w / r.n > 0.5 ? "up" : r.w / r.n < 0.5 ? "down" : ""}">${winPct(r)} won</small>` : ""}`;
const recP = (r) => `${rec(r)} (${winPct(r)})`;
const teamRankChip = (r, what) => (r ? chips([`#${r.rank} of ${r.of} ${what}`]) : "");
// Hero rows like the heroes card: portrait, name (the hero unless label says otherwise), a note
// under it, a number on the right.
const heroRows = (src, list, right, note, label = (e) => heroLink(src, e.hero)) => `<ol class="wr-heroes">${list.map((e) => `<li>${heroImg(e.hero) ? `<img src="${esc(heroImg(e.hero))}" alt="" loading="lazy">` : "<span></span>"}<span class="wr-hname">${label(e)}${note ? `<small>${note(e)}</small>` : ""}</span><b class="wr-hrec">${right(e)}</b></li>`).join("")}</ol>`;

// Part: the draft. Bans against the team and whose heroes they hit, its own bans, first and last
// picks, pick order, pool, a hero it got past the division's bans, and its nemesis hero.
function draftCards(src, t) {
  const d = t.draft; if (!d) return [];
  const cards = [];
  const a = d.against.slice(0, 4);
  if (a.length) cards.push({ key: "t-feared", tone: 1, hero: a[0].hero, sig: a[0].who || null, kicker: "They feared you",
    body: `${big(fmt(a[0].n), "bans")}${line(`${esc(a[0].hero)} was banned against you ${plural(a[0].n, "time")}${a[0].who ? `. That's ${gold(esc(a[0].who))}'s hero.` : "."}`)}${heroRows(src, a, (e) => fmt(e.n), (e) => [e.who ? `${esc(e.who)}'s hero` : "", `you won ${winPct(e)}`].filter(Boolean).join(" · "))}` });
  const m = d.magnets.slice(0, 3);
  if (m.length) cards.push({ key: "t-magnet", tone: 1, hero: m[0].heroes[0][0], sig: m[0].name, kicker: "Ban magnet",
    body: `${bigName(m[0].name)}${line(`${gold(`${m[0].n} of the ${d.againstTotal}`)} bans against you (${pct(m[0].n / d.againstTotal)}) went at ${esc(m[0].name)}'s heroes.`)}${heroRows(src, m.map((e) => ({ ...e, hero: e.heroes[0][0] })), (e) => fmt(e.n), (e) => e.heroes.slice(0, 3).map(([h, n]) => `${esc(h)} ${n}`).join(", "), (e) => esc(e.name))}` });
  const o = d.ours.slice(0, 4);
  if (o.length) cards.push({ key: "t-bans", tone: 2, hero: o[0].hero, kicker: "Your ban list",
    body: `${bigName(o[0].hero)}${line(`Your go-to ban: ${plural(o[0].n, "time")} in ${d.games} drafts, ${o[0].p1} in the first phase.`)}${heroRows(src, o, (e) => fmt(e.n), (e) => `${e.p1} in phase 1 · you won ${winPct(e)}`)}` });
  const f = d.first;
  if (f.length) {
    const c = d.firstCore;
    cards.push({ key: "t-first", tone: 3, hero: f[0].hero, kicker: "Opening pick",
      body: `${bigName(f[0].hero)}${line(`First-picked ${plural(f[0].n, "time")}, ${recP(f[0])}.`)}${c == null ? "" : line(c < 0.4 ? `You open with supports: only ${gold(pct(c))} of your first picks were cores.` : c > 0.6 ? `You open with cores: ${gold(pct(c))} of your first picks.` : `Your first picks split between cores (${pct(c)}) and supports.`)}${heroRows(src, f.slice(0, 4), recW)}` });
  }
  const l = d.last;
  if (l.length && d.lastCore != null) cards.push({ key: "t-last", tone: 4, hero: l[0].hero, kicker: "The last word",
    body: `${big(pct(d.lastCore))}${line(`of your last picks were cores. ${d.lastCore > 0.6 ? "You hide the carry or mid until the end." : d.lastCore < 0.4 ? "You close drafts with supports." : "Sometimes the core, sometimes the support."}`)}${line(`Most common last pick: ${esc(l[0].hero)} (${l[0].n}×, ${rec(l[0])}, ${winPct(l[0])} won).`)}${heroRows(src, l.slice(0, 4), recW)}` });
  const { first: fp, second: sp } = d.order;
  if (fp.n && sp.n) {
    const better = fp.w / fp.n >= sp.w / sp.n ? "first" : "second";
    cards.push({ key: "t-order", tone: 6, hero: null, kicker: "First or second?",
      body: `${big(better, "pick")}${line(`You won more often picking ${better}.`)}${stats([["First pick", rec(fp)], ["Win rate", pct(fp.w / fp.n)]])}${stats([["Second pick", rec(sp)], ["Win rate", pct(sp.w / sp.n)]])}` });
  }
  const p = d.pool;
  if (p.picks) cards.push({ key: "t-pool", tone: 5, hero: p.list[0]?.hero, kicker: "Hero pool",
    body: `${big(fmt(p.heroes), "heroes")}${line(`in ${fmt(p.picks)} picks, ${p.list.filter((e) => e.n === 1).length} of them only once. Your top five made up ${gold(pct(p.top5))} of your picks.`)}${teamRankChip(t.ranks.pool, "for the deepest pool")}${heroRows(src, p.list.slice(0, 5), (e) => fmt(e.n), (e) => `${rec(e)} · ${winPct(e)} won`)}` });
  const s = d.steals[0];
  if (s) cards.push({ key: "t-steal", tone: 3, hero: s.hero, kicker: "Snuck through",
    body: `${bigName(s.hero)}${line(`The rest of ${leagueName(src)} banned it ${plural(s.divBans, "time")}. You picked it ${s.n}× and went ${gold(recP(s))}.`)}${heroRows(src, d.steals.slice(0, 4), recW, (e) => `${e.divBans} bans elsewhere`)}` });
  const n = d.nemesis[0];
  if (n && n.l >= 2) cards.push({ key: "t-nemesis", tone: 1, hero: n.hero, kicker: "Nemesis hero",
    body: `${bigName(n.hero)}${line(`You lost ${gold(`${n.l} of ${n.n}`)} games against it. Next season's first ban?`)}${heroRows(src, d.nemesis.slice(0, 4), recW, () => "your record against")}` });
  return cards;
}

// Part: the draft, for a season review (a division's or All AD2L's): the league's drafting meta, the
// way Team Wrapped's draft part reads one team. d: lib/wrapped-draft.js leagueDraftOf. divs (All
// only): [{ name, d }] per division, for each one's most banned hero.
function leagueDraftCards(src, d, scope, divs = []) {
  if (!d) return [];
  const cards = [], sc = esc(scope);
  const b = d.bans.slice(0, 5);
  if (b.length) cards.push({ key: "l-banned", tone: 1, hero: b[0].hero, kicker: "Most feared",
    body: `${bigName(b[0].hero)}${line(`Banned in ${gold(pct(b[0].rate))} of ${sc}'s ${plural(d.drafts, "draft")}: ${plural(b[0].n, "time")}, ${b[0].p1} in the first phase.`)}${heroRows(src, b, (e) => pct(e.rate), (e) => `${plural(e.n, "ban")} · ${e.p1} in phase 1 · banning team won ${winPct(e)}`)}` });
  const os = d.onSight[0];
  if (os && os.share >= 0.5 && os.hero !== b[0]?.hero) cards.push({ key: "l-sight", tone: 2, hero: os.hero, kicker: "Banned on sight",
    body: `${bigName(os.hero)}${line(`${gold(pct(os.share))} of its ${plural(os.n, "ban")} came in the opening phase. Nobody wanted to see it.`)}${heroRows(src, d.onSight.slice(0, 4), (e) => pct(e.share), (e) => `${e.p1} of ${plural(e.n, "ban")} in phase 1 · banning team won ${winPct(e)}`)}` });
  const pk = d.picks.slice(0, 5);
  if (pk.length) cards.push({ key: "l-picked", tone: 3, hero: pk[0].hero, kicker: "Everyone's pick",
    body: `${bigName(pk[0].hero)}${line(`Picked in ${gold(pct(pk[0].rate))} of drafts, ${recP(pk[0])}.`)}${heroRows(src, pk, recW, (e) => `${plural(e.n, "pick")} · ${pct(e.rate)} of drafts`)}` });
  const c = d.contested.slice(0, 5);
  if (c.length) cards.push({ key: "l-contest", tone: 5, hero: c[0].hero, kicker: "Most contested",
    body: `${big(pct(c[0].rate))}${line(`of ${sc}'s drafts had ${esc(c[0].hero)} picked or banned.`)}${heroRows(src, c, (e) => pct(e.rate), (e) => `${plural(e.picks, "pick")} · ${plural(e.bans, "ban")}${e.picks ? ` · ${winPct({ n: e.picks, w: e.pw })} won picked` : ""}`)}` });
  const { first: fp, second: sp } = d.order;
  if (fp.n) {
    const better = fp.w >= sp.w ? "first" : "second", { radiant: r, firstOn: fo } = d.side;
    cards.push({ key: "l-order", tone: 6, hero: null, kicker: "First or second?",
      body: `${big(better, "pick")}${line(`won more: first pick went ${gold(rec(fp))} (${pct(fp.w / fp.n)}).`)}${stats([["Radiant", `${rec(r)} · ${pct(r.w / r.n)}`], ["Dire", `${r.n - r.w}–${r.w} · ${pct((r.n - r.w) / r.n)}`]])}${src.ad2l || src.all ? stats([fo.a.n && ["First pick on Radiant", `${rec(fo.a)} · ${pct(fo.a.w / fo.a.n)}`], fo.b.n && ["First pick on Dire", `${rec(fo.b)} · ${pct(fo.b.w / fo.b.n)}`]]) : ""}` });
  }
  const f = d.first;
  if (f.length) {
    const k = d.firstCore;
    cards.push({ key: "l-first", tone: 3, hero: f[0].hero, kicker: "Opening pick",
      body: `${bigName(f[0].hero)}${line(`Teams opened with it ${plural(f[0].n, "time")}, ${recP(f[0])}.`)}${k == null ? "" : line(k < 0.4 ? `${sc} opens with supports: only ${gold(pct(k))} of first picks were cores.` : k > 0.6 ? `${sc} opens with cores: ${gold(pct(k))} of first picks.` : `First picks split between cores (${pct(k)}) and supports.`)}${heroRows(src, f.slice(0, 4), recW)}` });
  }
  const l = d.last;
  if (l.length && d.lastCore != null) cards.push({ key: "l-last", tone: 4, hero: l[0].hero, kicker: "The last word",
    body: `${big(pct(d.lastCore))}${line(`of last picks were cores. ${d.lastCore > 0.6 ? "Teams hid the carry or mid until the end." : d.lastCore < 0.4 ? "Teams closed drafts with supports." : "Sometimes the core, sometimes the support."}`)}${line(`Most common last pick: ${esc(l[0].hero)} (${l[0].n}×, ${rec(l[0])}, ${winPct(l[0])} won).`)}${heroRows(src, l.slice(0, 4), recW)}` });
  const best = d.best[0], worst = d.worst[0];
  if (best && best.rate > 0.5) cards.push({ key: "l-best", tone: 2, hero: best.hero, kicker: "The pick that paid",
    body: `${bigName(best.hero)}${line(`Won ${gold(pct(best.rate))} of its ${plural(best.n, "game")} (${rec(best)}). Best record of any hero picked ${d.floor}+ times.`)}${heroRows(src, d.best.slice(0, 4), (e) => pct(e.rate), (e) => `${rec(e)} · ${plural(e.n, "pick")}`)}` });
  if (worst && worst.rate < 0.5 && worst.hero !== best?.hero) cards.push({ key: "l-trap", tone: 1, hero: worst.hero, kicker: "Trap pick",
    body: `${bigName(worst.hero)}${line(`Picked ${plural(worst.n, "time")} and won only ${gold(pct(worst.rate))} (${rec(worst)}).`)}${heroRows(src, d.worst.slice(0, 4), (e) => pct(e.rate), (e) => `${rec(e)} · ${plural(e.n, "pick")}`)}` });
  const p = d.pool;
  if (p.heroes) cards.push({ key: "l-pool", tone: 5, hero: d.picks[0]?.hero, kicker: "Hero pool",
    body: `${big(fmt(p.heroes), "heroes")}${line(`picked in ${sc}'s ${plural(d.drafts, "draft")}, ${p.once} of them only once.`)}${p.never == null ? "" : line(p.never ? `${gold(fmt(p.never))} ${p.never === 1 ? "hero was" : "heroes were"} never picked or banned.` : `${gold("Every hero")} was picked or banned at least once.`)}${stats([["Picks", fmt(d.pickTotal)], ["Bans", fmt(d.banTotal)], ["Drafts", fmt(d.drafts)]])}` });
  const dv = divs.filter((x) => x.d?.bans[0]);
  if (dv.length > 1) cards.push({ key: "l-divs", tone: 6, hero: dv[0].d.bans[0].hero, kicker: "Every division's fear",
    body: `${big(fmt(new Set(dv.map((x) => x.d.bans[0].hero)).size), dv.length === new Set(dv.map((x) => x.d.bans[0].hero)).size ? "different heroes" : "heroes")}${line("Each division's most banned hero.")}${heroRows(src, dv.map((x) => ({ ...x.d.bans[0], div: x.name })), (e) => pct(e.rate), (e) => `${heroLink(src, e.hero)} · ${plural(e.n, "ban")} · banning team won ${winPct(e)}`, (e) => esc(e.div))}` });
  return cards;
}

// Part: your style. The team type (its two best-ranked traits against the division), then game
// length, the lead at 10, stomps and swings, smokes and buybacks.
function styleCards(src, t) {
  const cards = [], s = t.style, tp = t.tempo;
  if (s) {
    const bar = (a) => { const p = a.of > 1 ? (a.of - a.rank) / (a.of - 1) : 0.5; return `<div class="wr-trait"><span>${esc(a.name)}</span><i><b style="width:${Math.max(4, Math.round(p * 100))}%"></b></i><span>#${a.rank}</span></div>`; };
    cards.push({ key: "t-type", tone: 5, hero: null, kicker: "Your team type",
      body: `${bigName(s.top.name)}${line(`You ${esc(s.top.trait)}, and you ${esc(s.second.trait)}.`)}${line(`Least like you: ${esc(s.least.name.toLowerCase())}.`)}<div class="wr-traits">${[...s.axes].sort((a, b) => a.rank - b.rank || b.z - a.z).map(bar).join("")}</div>` });
  }
  if (!tp) return cards;
  const lens = tp.lengths.map((r) => [r.lo === 0 ? `Under ${r.hi}` : r.hi === Infinity ? `${r.lo}+` : `${r.lo}–${r.hi}`, r]);
  // Best bracket needs 3+ games where possible, so a 2-0 doesn't beat a 9-6.
  const pick = (min) => lens.filter(([, r]) => r.n >= min).sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n || y[1].n - x[1].n)[0];
  const best = pick(3) ?? pick(2);
  const phrase = (r) => (r.lo === 0 ? `under ${r.hi}` : r.hi === Infinity ? `over ${r.lo}` : `${r.lo}–${r.hi}`);
  if (best) cards.push({ key: "t-tempo", tone: 6, hero: null, kicker: "Short or long",
    body: `${big(best[0], "min")}${line(`Your best games: ${gold(recP(best[1]))} in games ${phrase(best[1])} minutes.`)}${stats(lens.filter(([, r]) => r.n).map(([k, r]) => [k, recP(r)]))}` });
  if (tp.lead10 != null) cards.push({ key: "t-lead10", tone: 4, hero: null, kicker: "Lead at 10",
    body: `${big(`${tp.lead10 >= 0 ? "+" : "−"}${kShort(Math.abs(tp.lead10))}`, "gold")}${line("Your average gold lead at 10 minutes.")}${teamRankChip(t.ranks.lead10, "at 10:00")}${stats([["Ahead at 10", recP(tp.ahead10)], ["Behind at 10", recP(tp.behind10)]])}` });
  cards.push({ key: "t-swing", tone: 2, hero: null, kicker: "Stomps and swings",
    body: `${big(fmt(tp.stomps), tp.stomps === 1 ? "stomp" : "stomps")}${line(`You won ${plural(tp.stomps, "game")} by 15k+ and lost ${fmt(tp.stomped)} that way.`)}${tp.swing.n ? line(`In ${plural(tp.swing.n, "back-and-forth game")} you went ${gold(recP(tp.swing))}.`) : ""}${stats([["Stomps", fmt(tp.stomps)], ["Stomped", fmt(tp.stomped)], ["Swings", rec(tp.swing)]])}` });
  if (tp.smokes) cards.push({ key: "t-smoke", tone: 5, hero: null, kicker: "Smoke squad",
    body: `${big(tp.smokes.toFixed(1), "a game")}${line(`Smokes lit per game, with ${tp.smokeKills.toFixed(1)} smoke kills per game.`)}${chips([t.ranks.smokes && `#${t.ranks.smokes.rank} of ${t.ranks.smokes.of} for smokes`, t.ranks.smokeKills && `#${t.ranks.smokeKills.rank} of ${t.ranks.smokeKills.of} for smoke kills`].filter(Boolean))}` });
  if (tp.buybacks) cards.push({ key: "t-buyback", tone: 4, hero: null, kicker: "Buyback budget",
    body: `${big(tp.buybacks.toFixed(1), "a game")}${line("Buybacks per game.")}${teamRankChip(t.ranks.buybacks, "for buybacks")}` });
  return cards;
}

async function renderTeamWrapped(src, id) {
  setTitle("Team Wrapped", `AD2L ${SEASON.name}`);
  app.innerHTML = loading(`AD2L · ${SEASON.name}`, "Team Wrapped");
  let div;
  try { div = await wrappedData(src); } catch (e) { app.innerHTML = `${pageHead(`AD2L · ${SEASON.name}`, "Team Wrapped")}${errorBox(e)}`; return; }
  const shown = div.open || isLocal(), t = shown ? teamWrapped(div.games, id) : null;
  const dname = leagueName(src);
  if (!t) {
    app.innerHTML = `${pageHead(`AD2L · ${SEASON.name}`, "Team Wrapped")}<section class="wr-page"><div class="wr-locked panel"><p class="wr-kicker">${shown ? "Not enough games" : "Locked"}</p><h3>No team Wrapped here yet</h3><p>${shown ? "A team needs 3 parsed games for its Wrapped." : `${dname}'s team Wrappeds open once its grand final is played.`}</p><p><a href="${src.root}">Back to ${dname}</a></p></div></section>`;
    return;
  }
  setTitle(`${t.name} Wrapped`, `AD2L ${SEASON.name}`);
  const box = fullPage(`${src.root}/teams/${encodeURIComponent(id)}`, t.name);
  const [record, heroes, ...played] = teamCards(src, t);
  const parts = [{ n: 1, label: "The season", cards: [partCard(1, "The season", `${t.wins}–${t.losses} in ${dname}`), record, heroes].filter(Boolean) }];
  const part = (label, sub, cards) => { if (cards.length) { const n = parts.length + 1; parts.push({ n, label, cards: [partCard(n, label, sub), ...cards] }); } };
  part("The draft", "Bans, first picks, last picks", draftCards(src, t));
  part("Your style", `What kind of team you were in ${dname}`, styleCards(src, t));
  const tm = FAV_WALLS && teamMapOf(new Map(div.d.teams.map((x) => [x.id, teamGames(div.games, x.id)])), id);
  if (tm) played.push({ key: "t-map", tone: 5, hero: null, sig: tm.top?.[1] ? tm.top[0] : null, kicker: "The work nobody sees",
    body: `${big(tm.stacks.toFixed(1), "stacks a game")}${line(`Camps stacked by the five of you, every game.${tm.top?.[1] ? ` Most by ${esc(tm.top[0])} (${tm.top[1]}).` : ""}`)}${stats([["Runes a game", tm.runes.toFixed(1)], ["Smoke kills a game", tm.smoke.toFixed(1)]])}${chips([`#${tm.ranks.stacks.rank} of ${tm.ranks.stacks.of} for stacks`, `#${tm.ranks.runes.rank} of ${tm.ranks.runes.of} for runes`])}` });
  part("How you played", "Vision, fights, timing, objectives", played);
  const top = t.heroes.map((h) => h.hero);
  mountStory(box, {
    title: `${t.name} Wrapped`, railTitle: `${esc(t.name)}'s ${esc(SEASON.name)}`,
    opening: { key: "t-open", tone: 1, hero: null, wall: top[0], kicker: `${dname} · ${esc(SEASON.name)}`, body: `${big(esc(t.name))}${line("Team Wrapped")}${line('<span class="wr-hint">Tap or press → to go on</span>')}` },
    parts: FAV_WALLS ? slideParts(parts) : parts,
    ending: { key: "end", tone: 5, hero: null, kicker: "That's a wrap", body: `${big(`GG, ${esc(t.name)}`)}${line(t.roster.filter((r) => r.games > r.standin).slice(0, 7).map((r) => esc(r.name)).join(" · "))}${line(`<a href="${src.root}/wrapped/review">See ${dname}'s awards</a>`)}` },
    extra: localNote([!div.open && dname].filter(Boolean)),
    share: { url: pageUrl(`${src.root}/wrapped/team/${encodeURIComponent(id)}`), title: `${t.name}'s ${SEASON.name} Wrapped` },
    heroes: top.slice(0, 3), pool: top,
  });
  box.querySelector(".wr-story")?.focus({ preventScroll: true });
}

// The full-screen page around a story: a bar with the way back, then the story.
function fullPage(back, backLabel) {
  app.innerHTML = `<section class="wr-full">
      <header class="wr-full-bar"><a class="wr-close" href="${back}">← ${esc(cameFrom() ?? backLabel)}</a><span class="wr-full-mark">AD2L ${esc(SEASON.name)} Wrapped</span></header>
      <div class="wr-full-body"></div>
    </section>`;
  addCollage(app.querySelector(".wr-full"));
  // Opened from another page on the site: back goes to exactly that page (the hub, a profile on
  // its Wrapped tab, another Wrapped...). Opened from a shared link: the link above.
  app.querySelector(".wr-close").addEventListener("click", (e) => {
    if (!cameFrom() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    history.back();
  });
  return app.querySelector(".wr-full-body");
}

async function renderPlayerWrapped(src, key) {
  setTitle("Wrapped", `AD2L ${SEASON.name}`);
  app.innerHTML = loading(`AD2L · ${SEASON.name}`, "Wrapped");
  let s;
  try { s = await playerStory(key); } catch (e) { app.innerHTML = `${pageHead(`AD2L · ${SEASON.name}`, "Wrapped")}${errorBox(e)}`; return; }
  const profile = playerHref(s?.home ?? src, key);
  if (!s) {
    app.innerHTML = `${pageHead(`AD2L · ${SEASON.name}`, "Wrapped")}<section class="wr-page"><div class="wr-locked panel"><p class="wr-kicker">Not yet</p><h3>No ${esc(SEASON.name)} Wrapped here yet</h3><p>A player's Wrapped opens once their division's grand final is played.</p><p><a href="${profile}">Back to the profile</a></p></div></section>`;
    return;
  }
  const { all, home, div, divShown, leagueShown, wDiv, wAll, p } = s;
  setTitle(`${p.name}'s Wrapped`, `AD2L ${SEASON.name}`);
  const box = fullPage(profile, `${p.name}'s profile`);
  const viewer = await steamAccount().catch(() => null);
  const own = viewer != null && String(viewer) === String(key);
  const pinned = own ? (await publicCollection(viewer).catch(() => null))?.wrappedPin ?? null : null;
  const dname = home ? leagueName(home) : "AD2L";
  const parts = [];
  if (wDiv) parts.push({ n: 1, label: `${name(p)} in ${dname}`, cards: [partCard(1, `${name(p)} in ${dname}`, `${plural(wDiv.games, "game")} with ${esc(wDiv.team ?? "their team")}`), ...playerCards(home, wDiv)] });
  const perfCards = FAV_WALLS ? performanceCards(home, wDiv, leagueShown ? wAll : null, name(p)) : [];
  const across = FAV_WALLS ? [] : leagueShown && wAll ? playerCards(SOURCES.all, wAll, scopeOf(SOURCES.all)) : [];
  if (perfCards.length) parts.push({ n: 2, label: "Performance", cards: perfCards });
  else if (across.length) parts.push({ n: 2, label: `${name(p)} across AD2L`, cards: [partCard(2, `${name(p)} across AD2L`, "Ranked against every division's players"), ...across] });
  else if (!leagueShown) parts.push({ n: 2, label: `${name(p)} across AD2L`, cards: [lockedCard(`${name(p)}'s league-wide ranks`)] });
  const review = home ? `${home.root}/wrapped/review` : "#/wrapped/review";
  if (FAV_WALLS) { const all = parts.flatMap((x) => x.cards); if (!all.some((c) => c.key === "locked")) parts.splice(0, parts.length, ...byCategory(all)); }
  if (FAV_WALLS) await claimDesigns(parts.flatMap((x) => x.cards), key).catch((e) => console.warn("card designs unavailable", e));
  if (FAV_WALLS) for (const c of parts.flatMap((x) => x.cards)) { c.sig = p.name; c.who = key; }
  // Highlights only (?short=1, lib/story-player.js): about 8 of their cards, offered beside the
  // full story in the bar. Not for a story with too few cards to cut, or a locked part.
  const flat = parts.flatMap((x) => x.cards), hl = flat.some((c) => c.key === "locked") ? [] : highlightCards(flat);
  const canCut = hl.length >= 3 && flat.length > hl.length + 2, short = canCut && new URLSearchParams(location.search).get("short") === "1";
  if (short) parts.splice(0, parts.length, { n: null, label: "Highlights", cards: hl, slides: true });
  // The other version's address. The switch keeps this page's place in history (replaceState):
  // back still leaves Wrapped.
  const mu = new URL(location.href);
  mu.searchParams.delete("slide");
  if (short) mu.searchParams.delete("short"); else mu.searchParams.set("short", "1");
  const switchMode = () => { history.replaceState(history.state, "", mu.pathname + mu.search + mu.hash); window.dispatchEvent(new HashChangeEvent("hashchange")); };
  // A slide about one game shows the hero this player was on in it (c.hero, fixed), never another
  // player's: in a player's own Wrapped every background is one of their heroes.
  mountStory(box, {
    title: `${SEASON.name} Wrapped`, railTitle: `${name(p)}'s ${esc(SEASON.name)}`,
    opening: null,
    parts,
    ending: { key: "end", tone: 5, hero: null, kicker: "That's a wrap", body: `${big(`GG, ${esc(SEASON.name)}`)}${line(own ? "Pin one of your cards to your profile with 📌." : "Every player's Wrapped is on their profile.")}${line(`<a href="${review}">See the season's awards</a>`)}` },
    pins: own ? { own, viewer, pinned, storyDiv: srcId(home ?? SOURCES.all) } : null,
    share: home ? { url: shareUrl(home, key), title: `${p.name}'s ${SEASON.name} Wrapped` } : null,
    extra: localNote([divShown && !div.open && dname, leagueShown && !all.open && "AD2L"].filter(Boolean)),
    heroes: (wDiv ?? wAll).heroes.slice(0, 3).map((h) => h.hero),
    pool: (wDiv ?? wAll).played ?? (wDiv ?? wAll).heroes.map((h) => h.hero),
    short,
    mode: canCut ? { label: short ? "Full story" : "Highlights", go: switchMode } : null,
  });
  if (canCut) {
    app.querySelector(".wr-full-mark")?.insertAdjacentHTML("beforebegin", `<a class="wr-mode" href="${esc(mu.pathname + mu.search)}">${short ? "Full story" : `Highlights only<span class="wr-mode-n"> · ${hl.length + 1} cards</span>`}</a>`);
    app.querySelector(".wr-mode")?.addEventListener("click", (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      switchMode();
    });
  }
  box.querySelector(".wr-story")?.focus({ preventScroll: true });
}

// The season review (#/<division>/wrapped, under Tools): the division's awards, then AD2L's. All:
// AD2L's only. /wrapped/<player> is that player's own Wrapped.
export async function renderWrapped(src, who = null) {
  addStyles();
  src = whole(src);
  // Start every download this Wrapped needs now, side by side: below, each waits on the one before
  // (the reads file only after every division has loaded, the saved card designs only at the end).
  // A team's Wrapped and a division's review read their own division, a player's theirs (from their
  // file), All's review and the hub every division.
  const fetchFor = (keys) => { for (const k of keys) if (SOURCES[k]) wrappedSrcData(SOURCES[k]).catch(() => {}); prebuiltFile(keys.length === 1 ? keys[0] : "all"); };
  const everyKey = Object.keys(DIVISIONS), player = who && who.team == null && !who.review;
  if (player) playerFile(who).then((f) => fetchFor(f ? [f.home] : everyKey));
  else fetchFor(who?.team != null || (who?.review && !src.all) ? [src.key] : everyKey);
  savedCards ??= listCards().catch(() => new Map());
  if (FAV_WALLS) favWalls ??= await loadFavWalls().catch((e) => (console.warn("fav walls unavailable", e), null));
  if (who?.team != null) return renderTeamWrapped(src, who.team);
  if (who?.review) return renderReview(src);
  if (who) return renderPlayerWrapped(src, who);
  return renderHub(src);
}

// The season review of one league (#/<division>/wrapped/review): its awards as a story.
async function renderReview(src) {
  const kicker = `AD2L · ${src.all ? "All divisions" : leagueName(src)}`, title = `${SEASON.name} season review`;
  setTitle("Season review", `AD2L ${SEASON.name}`);
  app.innerHTML = loading(kicker, title);
  let all, div = null;
  // A division's review shows its own awards only: it doesn't wait on every division's (All's review does).
  try { [all, div] = await Promise.all([src.all ? wrappedData(SOURCES.all) : null, src.all ? null : wrappedData(src)]); } catch (e) { app.innerHTML = `${pageHead(kicker, title)}${errorBox(e)}`; return; }
  const divShown = !!div && (div.open || isLocal()), leagueShown = !!all && (all.open || isLocal());
  const dname = src.all ? null : leagueName(src);
  if (src.all ? !leagueShown : !divShown) {
    app.innerHTML = `${pageHead(kicker, title)}<section class="wr-page"><div class="wr-locked panel"><p class="wr-kicker">Locked</p><h3>The ${esc(SEASON.name)} review opens when the season ends</h3><p>${dname ? `${dname}'s awards unlock once its grand final is played.` : "The league's awards unlock once every division's grand final is played."} Every player's own Wrapped opens on their profile then too.</p><p><a href="#/wrapped">Back to every Wrapped</a></p></div></section>`;
    return;
  }
  const parts = [];
  // The leaderboards in two parts of their own (Fav, 2026-11-25: "sort ... between averages and in
  // one game"): season averages and totals, then single games (records, biggest hit, comeback).
  const boards = (s, d, scope) => (FAV_WALLS ? leaderboards(d.games) : []).map((b) => ({ one: !!b.record || b.key === "clutch" || b.key === "hit", card: boardCard(s, b, scope) }));
  const boardParts = (s, d, scope) => {
    const bs = boards(s, d, scope);
    return [{ label: `${scope} · Season averages`, cards: bs.filter((b) => !b.one).map((b) => b.card) }, { label: `${scope} · In one game`, cards: bs.filter((b) => b.one).map((b) => b.card) }].filter((x) => x.cards.length);
  };
  if (divShown) {
    parts.push({ n: 1, label: `${dname} awards`, cards: [partCard(1, `${dname} awards`, `${plural(div.games.length, "game")} this season`), ...awardsOf(src, div)] });
    const dd = leagueDraftCards(src, leagueDraftOf(div.games, { heroCount: HERO_META.length }), dname);
    if (dd.length) parts.push({ n: parts.length + 1, label: `${dname} drafts`, cards: [partCard(parts.length + 1, `${dname} drafts`, "Bans, picks and the meta"), ...dd] });
    for (const x of boardParts(src, div, dname)) parts.push({ n: parts.length + 1, ...x });
  }
  // A division's review stops at its own awards: AD2L's are their own review (#/wrapped/review).
  if (src.all && leagueShown) {
    const showdown = FAV_WALLS && showdownCard(await allDivisions().then(divisionShowdown).catch((e) => (console.warn("division showdown unavailable", e), null)), null);
    parts.push({ n: parts.length + 1, label: "AD2L awards", cards: [partCard(parts.length + 1, "AD2L awards", `${plural(all.games.length, "game")} in every division`), ...awardsOf(SOURCES.all, all), showdown].filter(Boolean) });
    const divDrafts = await Promise.all(DIVISIONS_LIST.map((x) => wrappedData(SOURCES[x.key]).then((w) => ({ name: x.name, d: leagueDraftOf(w.games) })).catch(() => null)));
    const dd = leagueDraftCards(SOURCES.all, leagueDraftOf(all.games, { heroCount: HERO_META.length }), "AD2L", [...divDrafts].reverse().filter(Boolean));
    if (dd.length) parts.push({ n: parts.length + 1, label: "AD2L drafts", cards: [partCard(parts.length + 1, "AD2L drafts", "Bans, picks and the meta across every division"), ...dd] });
    for (const x of boardParts(SOURCES.all, all, "AD2L")) parts.push({ n: parts.length + 1, ...x });
  }
  // The Arcana Cup is league-wide: only the All AD2L review shows it (Fav, 2026-11-25).
  if (FAV_WALLS && src.all && leagueShown) {
    const cup = await cupCards(src).catch((e) => (console.warn("arcana cup slides unavailable", e), []));
    if (cup.length) parts.push({ n: parts.length + 1, label: "Arcana Cup", cards: [partCard(parts.length + 1, "Arcana Cup", "The season's card design cup"), ...cup] });
  }
  const mine = await import("../parts/me.js").then((m) => m.myProfileHref()).catch(() => null);
  const myRecap = mine ? mine.replace("/player/", "/wrapped/") : null;
  fullPage("#/wrapped", "Every Wrapped").innerHTML = `<section class="wr-review"></section>`;
  mountStory(app.querySelector(".wr-review"), {
    title, railTitle: esc(title), share: { url: pageUrl(src.all ? "#/wrapped/review" : `${src.root}/wrapped/review`), title: `${title} · ${src.all ? "AD2L" : `AD2L ${dname}`}` }, extra: localNote([divShown && !div.open && dname, src.all && leagueShown && !all.open && "AD2L"].filter(Boolean)),
    opening: { key: "open", tone: 1, hero: null, kicker: `AD2L ${esc(SEASON.long)}`, body: `${big("Wrapped")}${line("The season in review")}${line(dname ? `${dname}'s awards.` : "The awards across every division.")}${line('<span class="wr-hint">Tap or press → to go on</span>')}` },
    parts: FAV_WALLS ? slideParts(parts) : parts,
    ending: { key: "end", tone: 5, hero: null, kicker: "That's a wrap", body: `${big(`GG, ${esc(SEASON.name)}`)}${line(myRecap ? `<a href="${myRecap}">Open your own Wrapped</a>` : "Every player's own Wrapped is on their profile. Sign in with Steam to find yours.")}` },
  });
  app.querySelector(".wr-story")?.focus({ preventScroll: true });
}

// Every Wrapped (#/<division>/wrapped, Tools): a card per review (All AD2L, then each division,
// top division first) side by side, and a search for any player's own Wrapped.
async function renderHub(src) {
  const kicker = `AD2L · ${SEASON.name}`, title = `${SEASON.name} Wrapped`;
  setTitle("Wrapped", `AD2L ${SEASON.name}`);
  app.innerHTML = loading(kicker, title);
  const divs = [...DIVISIONS_LIST].reverse();
  let datas, all;
  try { [datas, all] = await Promise.all([Promise.all(divs.map((d) => wrappedSrcData(SOURCES[d.key]))), wrappedSrcData(SOURCES.all)]); }
  catch (e) { app.innerHTML = `${pageHead(kicker, title)}${errorBox(e)}`; return; }
  const done = divs.map((d, i) => seasonDone(SOURCES[d.key], datas[i]));
  const local = isLocal();
  // Each card's background: the league's most-picked hero this season, on its hero art. No two
  // cards share one: a hero an earlier card took goes to that league's next most picked.
  const used = new Set();
  const topHero = (d) => {
    const n = new Map();
    for (const m of seasonGames(d.games)) for (const q of m.players) if (heroArt(q.hero)) n.set(q.hero, (n.get(q.hero) ?? 0) + 1);
    const h = [...n].sort((a, b) => b[1] - a[1]).find(([x]) => !used.has(x))?.[0] ?? null;
    if (h) used.add(h);
    return h;
  };
  const artOf = (d) => { const h = topHero(d), a = h && heroArt(h); return a ? { hero: h, url: new URL(`../${a.src}`, import.meta.url).href } : null; };
  const tile = ({ href, name, sub, open, color, dark, art, kicker = `AD2L ${SEASON.name}` }) => `<a class="wr-tile${open ? "" : " wr-tile-locked"}" href="${href}" style="--tc:${color};--td:${dark}">
      ${art ? `<img class="wr-tile-art" src="${esc(art.url)}" alt="" loading="lazy" decoding="async">` : ""}
      <span class="wr-tile-kicker">${esc(kicker)}</span>
      <b class="wr-tile-name">${esc(name)}</b>
      <span class="wr-tile-mark">Wrapped</span>
      <span class="wr-tile-sub">${sub}</span>
      <span class="wr-tile-state">${open ? "Open ›" : local ? "Locked · local preview ›" : "Opens when the season ends"}</span>
    </a>`;
  const seasonGamesOf = (d) => seasonGames(d.games).length;
  const tiles = [
    tile({ href: "#/wrapped/review", name: "All AD2L", sub: `${plural(seasonGamesOf(all), "game")} · every division`, open: done.every(Boolean), color: "#e8b64c", dark: "#7a3f12", art: artOf(all) }),
    ...divs.map((d, i) => tile({ href: `${SOURCES[d.key].root}/wrapped/review`, name: d.name, sub: `${plural(seasonGamesOf(datas[i]), "game")} · ${plural(datas[i].teams.length, "team")}`, open: done[i], color: d.color, dark: d.dark, art: artOf(datas[i]) })),
  ];
  // Signed in: your own Wrapped and your team's come first, in your division's colours, each on
  // the hero you (or your team) played most. Locally ?wrapAs=<account> previews someone's.
  const asParam = isLocal() ? new URLSearchParams(location.search).get("wrapAs") : null;
  const account = asParam ?? await steamAccount().catch(() => null);
  const mine = await yourTiles(account, divs, datas, done);
  if (mine) {
    const { d, i, e, key, team } = mine, dsrc = SOURCES[d.key];
    const heroArtOf = (rows) => { const n = new Map(); for (const h of rows) if (heroArt(h)) n.set(h, (n.get(h) ?? 0) + 1); const h = [...n].sort((a, b) => b[1] - a[1])[0]?.[0], a = h && heroArt(h); return a ? { hero: h, url: new URL(`../${a.src}`, import.meta.url).href } : null; };
    const yours = [tile({ href: recapHref(dsrc, key), kicker: "Your Wrapped", name: e.p.name, sub: `${plural(e.rows.length, "game")} · ${esc(d.name)}`, open: done[i], color: d.color, dark: d.dark, art: heroArtOf(e.rows.map(({ p }) => p.hero)) })];
    if (team) yours.push(tile({ href: teamRecapHref(dsrc, team.id), kicker: "Your team", name: team.name, sub: `${plural(team.games, "game")} · ${esc(d.name)}`, open: done[i], color: d.color, dark: d.dark, art: heroArtOf(team.heroes) }));
    tiles.unshift(...yours);
  }
  const people = [...byPlayer(seasonGames(all.games)).values()].sort((a, b) => a.p.name.localeCompare(b.p.name));
  const myRecap = mine ? recapHref(SOURCES[mine.d.key], mine.key) : null;
  // Every team that played this season, labelled with its division (names can repeat across them).
  const teams = divs.flatMap((d, i) => {
    const played = new Set(seasonGames(datas[i].games).flatMap((m) => [m.team_a_id, m.team_b_id]));
    return datas[i].teams.filter((t) => played.has(t.id)).map((t) => ({ label: `${t.name} (${d.name})`, name: t.name, href: teamRecapHref(SOURCES[d.key], t.id) }));
  }).sort((a, b) => a.label.localeCompare(b.label));
  const myTeam = mine?.team ? teamRecapHref(SOURCES[mine.d.key], mine.team.id) : null;
  app.innerHTML = `<div class="wr-hubpage">${pageHead(kicker, title)}<section class="wr-hub">
      <p class="wr-hub-lead">The season in review. Pick a division's awards, or find any player's or team's own Wrapped.</p>
      <div class="wr-finds">
        ${playerPicker(people, myRecap)}
        ${teamPicker(teams, myTeam)}
      </div>
      <div class="wr-tiles">${tiles.join("")}</div>
    </section></div>`;
  addCollage(app.querySelector(".wr-hubpage"));
  wirePlayerPicker(src, people);
  wireTeamPicker(teams);
}

// The backdrop behind the hub and every Wrapped story: a tilted wall of hero art (img/hero-art/),
// rows drifting in turn, dimmed so what's over it stays readable. A fresh shuffle of every hero
// each visit, 12 different heroes a row (5 rows, 60 of the 127), so no row shows the same hero twice
// on screen. Added once the page has drawn and fetched at low priority, so it never holds the page
// up; lazy, so heroes still off screen wait until they drift in. Still where motion is turned down.
function addCollage(host) {
  if (!host || host.querySelector(":scope > .wr-collage")) return;
  const pool = WALL_HEROES.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // The small copies (img/hero-art-bg/, scripts/gen/hero-art-bg.py): about 7 KB a hero.
  const urls = pool.map((h) => new URL(`../${heroArt(h).src.replace("img/hero-art/", "img/hero-art-bg/")}`, import.meta.url).href);
  if (urls.length < 12) return;
  const per = 12, rows = Array.from({ length: 5 }, (_, r) => Array.from({ length: per }, (_, i) => urls[(r * per + i) % urls.length]));
  // Each row twice over, so its drift loops without a gap (the copy is the same files, already loaded).
  const img = (u) => `<img src="${esc(u)}" alt="" loading="lazy" decoding="async" fetchpriority="low">`;
  const row = (r, i) => `<div class="wr-collage-row${i % 2 ? " is-rev" : ""}">${[...r, ...r].map(img).join("")}</div>`;
  const draw = () => { if (host.isConnected && !host.querySelector(":scope > .wr-collage")) host.insertAdjacentHTML("afterbegin", `<div class="wr-collage" aria-hidden="true"><div class="wr-collage-wall">${rows.map(row).join("")}</div></div>`); };
  (window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200)))(draw, { timeout: 1500 });
}

// The signed-in player in the hub: the division they played the most season games in, their
// entry there (byPlayer), and their main team's games and heroes. Null when signed out or unplayed.
async function yourTiles(account, divs, datas) {
  if (account == null) return null;
  let best = null;
  divs.forEach((d, i) => {
    const games = seasonGames(datas[i].games), key = keyFor(games, account);
    const e = key && byPlayer(games).get(key);
    if (e && (!best || e.rows.length > best.e.rows.length)) best = { d, i, e, key, games };
  });
  if (!best) return null;
  const id = best.e.team?.id;
  let team = null;
  if (id != null) {
    const heroes = [];
    let games = 0;
    for (const m of best.games) {
      const side = m.team_a_id === id ? "a" : m.team_b_id === id ? "b" : null;
      if (!side) continue;
      games++;
      for (const q of m.players) if (q.team === side) heroes.push(q.hero);
    }
    team = { id, name: best.e.team.name ?? "Your team", games, heroes };
  }
  return { ...best, team };
}

// Find any player's own Wrapped, from every division.
function playerPicker(people, myRecap) {
  return `<form class="wr-pick">
      <label for="wr-who">Find a player's Wrapped</label>
      <div class="wr-field">
        <input id="wr-who" type="search" list="wr-people" placeholder="Search players" autocomplete="off">
        <datalist id="wr-people">${people.map((e) => `<option value="${esc(e.p.name)}">`).join("")}</datalist>
        <button type="submit">Open</button>
      </div>
      ${myRecap ? `<a href="${myRecap}">Mine</a>` : ""}
      <p class="wr-pick-msg" role="status"></p>
    </form>`;
}
function wirePlayerPicker(src, people) {
  const pick = app.querySelector(".wr-pick");
  if (!pick) return;
  pick.onsubmit = (e) => {
    e.preventDefault();
    const q = pick.querySelector("input").value.trim().toLowerCase();
    if (!q) return;
    const hit = people.find((x) => x.p.name.toLowerCase() === q) ?? people.find((x) => x.p.name.toLowerCase().includes(q));
    if (hit) location.href = recapHref(src.all ? SOURCES.all : src, hit.key);
    else pick.querySelector(".wr-pick-msg").textContent = "No player by that name this season.";
  };
}

// Find any team's Wrapped, from every division.
function teamPicker(teams, myTeam) {
  return `<form class="wr-pick wr-pick-team">
      <label for="wr-team">Find a team's Wrapped</label>
      <div class="wr-field">
        <input id="wr-team" type="search" list="wr-teams" placeholder="Search teams" autocomplete="off">
        <datalist id="wr-teams">${teams.map((t) => `<option value="${esc(t.label)}">`).join("")}</datalist>
        <button type="submit">Open</button>
      </div>
      ${myTeam ? `<a href="${myTeam}">Mine</a>` : ""}
      <p class="wr-pick-msg" role="status"></p>
    </form>`;
}
function wireTeamPicker(teams) {
  const pick = app.querySelector(".wr-pick-team");
  if (!pick) return;
  pick.onsubmit = (e) => {
    e.preventDefault();
    const q = pick.querySelector("input").value.trim().toLowerCase();
    if (!q) return;
    const hit = teams.find((t) => t.label.toLowerCase() === q) ?? teams.find((t) => t.name.toLowerCase() === q) ?? teams.find((t) => t.label.toLowerCase().includes(q));
    if (hit) location.href = hit.href;
    else pick.querySelector(".wr-pick-msg").textContent = "No team by that name this season.";
  };
}

// Whether a league's review is open (its grand final played; All: every division's). For the
// notice (lib/wrapped-notice.js): one model fit, not the whole review.
export async function reviewOpen(src) {
  if (!src?.ad2l) return false;
  src = whole(src);
  return unlocked(src, await src.data(), (s) => s.data()).catch(() => false);
}
