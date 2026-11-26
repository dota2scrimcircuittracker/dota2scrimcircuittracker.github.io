// Link previews for AD2L Wrapped (pages/wrapped.js). For each league whose season is over (its
// grand finals played, lib/wrapped.js seasonOver), writes into a built copy of public/:
//   /<league>/wrapped/            the season review, with the award winners in its description
//   /<league>/wrapped/<player>/   that player's Wrapped, with their own title, description and
//                                 image (img/og/wrapped/<league>/<player>.jpg, drawn by
//                                 scripts/gen/wrapped-og.py)
//   /<league>/wrapped/team/<id>/  that team's Wrapped, the same way (img/og/wrapped/<league>/team-<id>.jpg)
//   data/wrapped-players.json     who has a Wrapped, with what their profile's Wrapped tab shows
//                                 (pages/wrapped.js mountPlayerWrapped), so a profile doesn't
//                                 load every division to find out. Always written; empty before
//                                 any season is over.
// Each page is the app, which opens the player's Wrapped tab on their profile. Leagues still
// playing get nothing, so no recap shows early. --preview writes every league anyway (testing).
// Usage: node scripts/deploy/wrapped-pages.js <site dir> [--preview]
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withNicknames } from "../../public/lib/nicknames.js";
import { withDerived, isRemake, hasDetails } from "../../public/lib/stats.js";
import { laneCuts } from "../../public/lib/lanes.js";
import { seasonGames, seasonAwards, playerWrapped, byPlayer, seasonOver, seasonResults } from "../../public/lib/wrapped.js";
import { HERO_META } from "../../public/lib/hero-meta.js";
import { heroArt } from "../../public/lib/hero-art.js";
import { teamGames, overview } from "../../public/lib/team-wrapped.js";
import { SEASON, DIVISIONS, slugOf } from "../../public/lib/divisions.js";
import { SITE, appPage } from "./page-head.js";

const OUT = path.resolve(process.argv[2] ?? "_site");
const PREVIEW = process.argv.includes("--preview");
const slugOfHero = new Map(HERO_META.map(([, n, s]) => [n, s]));
const plural = (n, w) => `${n} ${n === 1 ? w : `${w}s`}`;
// A team's finish from seasonResults: "4th, Aegis", "Champions", or its group-stage place.
const finishOf = (f) => {
  const po = f?.playoff, gp = f?.group;
  return po ? (po.alive ? null : `${po.label}${po.bracket ? `, ${po.bracket}` : ""}`) : gp ? `#${gp.rank} of ${gp.of} in the group stage` : null;
};
// The hero played most among names (one per pick) that has art on the site, as the tile job's
// art (the site's hero art, the backdrop) and hero (its slug, for Valve's full render).
const artOf = (heroes) => {
  const n = new Map();
  for (const h of heroes) if (heroArt(h)) n.set(h, (n.get(h) ?? 0) + 1);
  const top = [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? { art: path.join(OUT, heroArt(top).src), hero: slugOfHero.get(top) ?? null } : { art: null, hero: null };
};
const num = (v, f) => (f === "%" ? `${Math.round(v * 100)}%` : Number(v).toFixed(f));
const app = await readFile(path.join(OUT, "index.html"), "utf8");

async function write(p, head) {
  await mkdir(path.join(OUT, p), { recursive: true });
  await writeFile(path.join(OUT, p, "index.html"), appPage(app, { ...head, url: `${SITE}/${p}/` }));
}

const jobs = [];
let teamPages = 0;
let leagues = 0;
// Profile tabs: a player's home is the first division (this order) whose season games have them,
// as pages/wrapped.js homeOf. Listed once that division's season is over.
const homes = new Set(), profiles = {};
for (const dv of DIVISIONS) {
  let raw;
  try { raw = JSON.parse(await readFile(path.join(OUT, "data", `${dv.key}.json`), "utf8")); } catch { continue; }
  const d = withNicknames(raw);
  // As the page loads a division (core.js loadDivision), so games come out in the same order.
  d.games = d.games.filter((g) => !isRemake(g)).map((g) => withDerived({ ...g, createdAt: new Date(g.start_time * 1000) }));
  const games = seasonGames(d.games), open = seasonOver(d, { split: !!dv.views });
  for (const [key, e] of byPlayer(games)) {
    if (homes.has(key)) continue;
    homes.add(key);
    if (!open || !/^\d+$/.test(key)) continue;
    const w = playerWrapped(games, key);
    if (w) profiles[key] = { home: dv.key, name: w.p.name ?? null, team: w.team ?? null, teamId: e.team.id, heroes: w.heroes.slice(0, 2).map((h) => h.hero) };
  }
  if (!PREVIEW && !open) continue;
  leagues++;
  const cuts = laneCuts(d.games.filter(hasDetails));
  // No model reads here: the team awards (upset, overachiever) need the drafts file. The
  // previews only name player awards.
  const results = seasonResults(d, { split: !!dv.views });
  const awards = seasonAwards(games, { series: d.series, teams: d.teams, cuts, results });
  const slug = slugOf(dv), league = `AD2L ${dv.name}`;

  const champs = awards.filter((a) => a.key === "champions").map((a) => `${a.title}: ${d.teams.find((t) => t.id === a.team)?.name ?? "?"}`);
  const leagueImg = `${SITE}/img/og/wrapped/${dv.key}/league.jpg`;
  const named = [...champs, ...awards.filter((a) => a.p).map((a) => `${a.title}: ${a.p.name}${a.key === "duo" ? ` + ${a.hero}` : ""}`)];
  await write(`${slug}/wrapped`, {
    title: `${SEASON.name} Wrapped · ${league}`,
    description: `The ${dv.name} season in review. ${named.join(" · ")}. Every player's own Wrapped is on their profile.`,
    color: dv.color, image: leagueImg,
  });
  // The season review story itself (#/<league>/wrapped/review): same preview, its own address.
  await write(`${slug}/wrapped/review`, {
    title: `${SEASON.name} season review · ${league}`,
    description: `The ${dv.name} season in review. ${named.join(" · ")}.`,
    color: dv.color, image: leagueImg,
  });
  // One image for both, like the hub's tile: the league's most-picked hero, champions and MVP.
  jobs.push({
    tile: true, out: path.join(OUT, "img", "og", "wrapped", dv.key, "league.jpg"), color: dv.color, dark: dv.dark,
    kicker: `AD2L · ${SEASON.name}`, name: dv.name, sub: `${plural(games.length, "game")} · ${plural(d.teams.length, "team")} · season in review`,
    line: named.slice(0, 2).join("  ·  ") || null, ...artOf(games.flatMap((m) => m.players.map((q) => q.hero))),
  });

  // Each team's Wrapped (#/<league>/wrapped/team/<id>): record, finish, top heroes and roster.
  for (const t of d.teams) {
    const tg = teamGames(games, t.id);
    if (!tg.length) continue;
    const o = overview(tg), top = o.heroes[0], finish = finishOf(results?.teams.get(t.id));
    const roster = o.roster.filter((r) => r.games > r.standin).slice(0, 5).map((r) => r.name);
    const facts = [
      `${o.wins}–${o.losses} in ${plural(o.games, "game")}`,
      finish,
      top && `most played ${top.hero} (${top.w}–${top.n - top.w})`,
      roster.length && roster.join(", "),
    ].filter(Boolean);
    const file = `team-${t.id}.jpg`;
    await write(`${slug}/wrapped/team/${t.id}`, {
      title: `${t.name}'s ${SEASON.name} Wrapped · ${league}`,
      description: `${facts.join(" · ")}.`,
      color: dv.color, image: `${SITE}/img/og/wrapped/${dv.key}/${file}`,
      alt: `${t.name}'s ${SEASON.name} Wrapped: ${facts[0]}`,
    });
    jobs.push({
      tile: true, out: path.join(OUT, "img", "og", "wrapped", dv.key, file), color: dv.color, dark: dv.dark,
      kicker: `Team · AD2L ${dv.name} · ${SEASON.name}`, name: t.name, sub: roster.join(" · ") || dv.name,
      stats: [["RECORD", `${o.wins}–${o.losses}`], ["GAMES", String(o.games)], ["HEROES", String(o.heroes.length)], ["KILLS", String(o.kills)]],
      line: [finish, top && `Most played: ${top.hero} (${top.w}–${top.n - top.w})`].filter(Boolean).join("  ·  ") || null,
      ...artOf(o.heroes.flatMap((h) => Array(h.n).fill(h.hero))),
    });
    teamPages++;
  }

  for (const e of byPlayer(games).values()) {
    if (!/^\d+$/.test(e.key)) continue;
    const w = playerWrapped(games, e.key, { cuts, awards, results });
    if (!w) continue;
    const name = w.p.name, team = w.team ?? "their team", top = w.heroes[0];
    const kda = ((w.kills + w.assists) / Math.max(w.deaths, 1)).toFixed(1);
    const sig = w.signature && { value: num(w.signature.value, w.signature.fmt), label: w.signature.label, rank: w.signature.rank, of: w.signature.of };
    // The team's finish: "4th, Aegis", "Champions", or its group-stage place.
    const finish = finishOf(w.finish);
    const facts = [
      `${w.wins}–${w.losses} for ${team} in ${plural(w.games, "game")}`,
      finish,
      w.playoffs && `${w.playoffs.wins}–${w.playoffs.games - w.playoffs.wins} in the playoffs`,
      top && `top hero ${top.hero} (${top.w}–${top.n - top.w})`,
      w.mvps && plural(w.mvps, "game MVP"),
      sig && `${sig.value} ${sig.label}, #${sig.rank} of ${sig.of}`,
      w.awards.length && `won ${w.awards.map((a) => a.title).join(" and ")}`,
    ].filter(Boolean);
    await write(`${slug}/wrapped/${e.key}`, {
      title: `${name}'s ${SEASON.name} Wrapped · ${league}`,
      description: `${facts.join(" · ")}.`,
      color: dv.color, image: `${SITE}/img/og/wrapped/${dv.key}/${e.key}.jpg`,
      alt: `${name}'s ${SEASON.name} Wrapped: ${facts[0]}`,
    });
    jobs.push({
      tile: true, out: path.join(OUT, "img", "og", "wrapped", dv.key, `${e.key}.jpg`), color: dv.color, dark: dv.dark,
      kicker: `AD2L ${dv.name} · ${SEASON.name}`, name, sub: [team, finish].filter(Boolean).join(" · "),
      stats: [["RECORD", `${w.wins}–${w.losses}`], ["GAMES", String(w.games)], ["MVPS", String(w.mvps)], ["KDA", kda]],
      line: [w.awards.length && w.awards.map((a) => a.title).join(" · "), sig && `#${sig.rank} of ${sig.of} · ${sig.value} ${sig.label}`].filter(Boolean)[0] || null,
      ...artOf(w.heroes.flatMap((h) => Array(h.n).fill(h.hero))),
    });
  }
}

await writeFile(path.join(OUT, "data", "wrapped-players.json"), JSON.stringify({ season: SEASON.name, players: profiles }));

// The images: one Python run for all of them (Pillow, the site's fonts).
if (jobs.length) {
  const list = path.join(OUT, "img", "og", "wrapped", "jobs.json");
  await mkdir(path.dirname(list), { recursive: true });
  await writeFile(list, JSON.stringify(jobs));
  const py = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "gen", "wrapped-og.py");
  const run = spawnSync(py, [script, list], { stdio: "inherit" });
  await rm(list, { force: true });
  if (run.status !== 0) throw new Error(`wrapped-og.py failed (${run.error?.message ?? `exit ${run.status}`})`);
}
console.log(`Wrapped previews: ${leagues} league${leagues === 1 ? "" : "s"} open, ${jobs.length} images (${leagues} league, ${teamPages} team, the rest player)${PREVIEW ? " (--preview)" : ""}, ${Object.keys(profiles).length} profile tabs`);
