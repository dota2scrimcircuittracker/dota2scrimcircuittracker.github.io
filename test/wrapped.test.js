import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withDerived } from "../public/lib/stats.js";
import { seasonGames, seasonAwards, playerWrapped, leadChanges, overachievers, nemesisOf, validCard, targetedBans, heroPlays, byPlayer, seasonResults, deadTimeOf, biggestHitOf, highlightsOf, personalityOf, TRAITS, PERSONALITY_NAMES, UNNAMED_PAIRS, leaguePersonalities, PERSONALITY_CAP, medalStars, seriesCloseness, leadSwings } from "../public/lib/wrapped.js";

// A game: a's five are players a1..a5 on heroes ha1..ha5 (b likewise); winner "a" or "b".
let gid = 0;
function game(winner, { heroes = {}, series_id = 1, gold_adv = [], stat = {} } = {}) {
  const players = ["a", "b"].flatMap((team) => [1, 2, 3, 4, 5].map((pos) => {
    const key = `${team}${pos}`;
    return { team, name: key, player_key: key, account_id: pos, position: pos, hero: heroes[key] ?? `h${key}`,
      kills: 2, deaths: 2, assists: 2, net_worth: 10000, gpm: 500, hero_damage: 10000, obs_placed: pos > 3 ? 10 : 0, sen_placed: 0, camps_stacked: 0, ...(stat[key] ?? {}) };
  }));
  return withDerived({ id: ++gid, series_id, winner, score_a: 10, score_b: 10, duration_sec: 1800, gold_adv, players });
}

test("validCard takes recap cards and award cards only", () => {
  assert.ok(validCard("summary"));
  assert.ok(validCard("award:mvp"));
  assert.ok(!validCard("award:nope"));
  assert.ok(!validCard("<b>"));
  assert.ok(!validCard(3));
});

test("leadChanges counts 1k+ lead flips after minute 2", () => {
  assert.equal(leadChanges({ gold_adv: [0, 5000, -5000, 2000, -500, -1500, 3000] }), 3);
  assert.equal(leadChanges({ gold_adv: [0, 200, -300, 900] }), 0);
  assert.equal(leadChanges({}), 0);
});

test("series of the season prefers a close split series over a swingy sweep", () => {
  const wild = [0, 0, 6000, -6000, 6000, -6000, 6000, -6000, 3000];
  const close = [0, 0, 2000, -2000, 3000];
  const games = [
    game("a", { series_id: 10, gold_adv: wild }), game("a", { series_id: 10, gold_adv: wild }),
    game("a", { series_id: 11, gold_adv: close }), game("b", { series_id: 11, gold_adv: close }), game("a", { series_id: 11, gold_adv: close }),
  ];
  const sos = seasonAwards(games).find((a) => a.key === "series");
  assert.equal(sos.series, 11);
  assert.equal(sos.runnerUp.series, 10);
  assert.equal(seasonAwards(games.slice(2)).find((a) => a.key === "series").runnerUp, null);
  // With only sweeps, the swingiest one still wins.
  assert.equal(seasonAwards(games.slice(0, 2)).find((a) => a.key === "series").series, 10);
});

test("seriesCloseness rewards coming back in the series and marks down stomps", () => {
  const even = [0, 0, 2000, 3000];
  const stomp = [0, 0, 8000, 25000];
  const t = (winner, i, gold_adv) => ({ ...game(winner, { gold_adv }), start_time: i });
  const back = seriesCloseness([t("b", 1, even), t("a", 2, even), t("a", 3, even)]);
  const front = seriesCloseness([t("a", 1, even), t("b", 2, even), t("a", 3, even)]);
  assert.equal(back.score - front.score, 2);
  const sweep = seriesCloseness([t("b", 1, even), t("b", 2, even), t("a", 3, even), t("a", 4, even), t("a", 5, even)]);
  const plain = seriesCloseness([t("a", 1, even), t("b", 2, even), t("a", 3, even), t("b", 4, even), t("a", 5, even)]);
  assert.equal(sweep.score - plain.score, 10);
  assert.deepEqual(sweep.notes, ["Came back from 0–2"]);
  assert.deepEqual(back.notes, ["Came back from 0–1"]);
  const stomped = seriesCloseness([t("a", 1, even), t("b", 2, even), t("a", 3, stomp)]);
  assert.ok(stomped.score < front.score);
  // A game won from 5k+ down is a comeback.
  const cb = seriesCloseness([t("a", 1, [0, 0, -6000, 2000])], { home_score: 1, away_score: 1 });
  assert.equal(cb.split, 1);
  assert.match(cb.notes[0], /Game 1 comeback from 6k down/);
});

test("leadSwings sizes each lead change; big swings and bloody games score higher", () => {
  assert.deepEqual(leadSwings({ gold_adv: [0, 9000, 3000, -2000, -8000, 500, 12000] }), [11000, 20000]);
  assert.deepEqual(leadSwings({ gold_adv: [0, 0, 2000] }), []);
  const t = (gold_adv, kills = 2) => game("a", { gold_adv, stat: Object.fromEntries(["a1", "b1"].map((k) => [k, { kills }])) });
  const small = seriesCloseness([t([0, 0, 2000, -2000, 2000])]);
  const big = seriesCloseness([t([0, 0, 12000, -12000, 12000])]);
  assert.ok(big.score > small.score);
  const calm = seriesCloseness([t([0, 0, 2000])], null, { avgKills: 40 });
  const bloody = seriesCloseness([t([0, 0, 2000], 30)], null, { avgKills: 40 });
  assert.ok(bloody.score - calm.score >= 1.9);
  assert.match(bloody.notes.join(), /Game 1: \d+ kills/);
});

test("overachievers scores only series won as the underdog, long odds most", () => {
  const sr = (home, away, hs, as) => ({ home, away, home_score: hs, away_score: as });
  const out = overachievers([
    { s: sr(1, 2, 2, 0), q: 0.25 }, // team 1 wins at long odds
    { s: sr(1, 3, 2, 0), q: 0.45 }, // team 1 wins as a slight underdog
    { s: sr(4, 5, 2, 0), q: 0.9 }, //  team 4 wins as favourite: no surprise
    { s: sr(4, 6, 2, 0), q: 0.9 },
    { s: sr(5, 6, 1, 1), q: 0.3 }, //  a tie scores nothing
  ]);
  assert.deepEqual(out.map((e) => e.id), [1]);
  assert.equal(out[0].upsets, 2);
  assert.equal(out[0].best.opp, 2);
  assert.ok(out[0].best.chance < 0.25 && out[0].score > 1);
});

test("nemesisOf needs two losses to the same hero", () => {
  const games = [game("b", { heroes: { b1: "Axe" } }), game("b", { heroes: { b1: "Axe" } }), game("a", { heroes: { b1: "Axe" } })];
  const rows = games.map((m) => ({ m, p: m.players[0] }));
  assert.deepEqual(nemesisOf(rows), { hero: "Axe", n: 3, lost: 2 });
  assert.equal(nemesisOf(rows.slice(2)), null);
});

test("duo award: a long winning run beats a short perfect one", () => {
  const games = [
    ...Array.from({ length: 3 }, () => game("a", { heroes: { a1: "Tiny" } })),
    ...Array.from({ length: 8 }, (_, i) => game(i === 0 ? "a" : "b", { heroes: { b2: "Lina" } })),
  ];
  const duo = seasonAwards(seasonGames(games)).find((a) => a.key === "duo");
  assert.equal(duo.player, "b2");
  assert.equal(duo.hero, "Lina");
  assert.equal(duo.wins, 7);
});

test("sandbagged award: most medal stars gained in ranked since the season began, top 5 on the card", () => {
  // Each player its own account (a1 -> 101, b1 -> 201, ...).
  const stat = Object.fromEntries(["a", "b"].flatMap((t, i) => [1, 2, 3, 4, 5].map((n) => [`${t}${n}`, { account_id: (i + 1) * 100 + n }])));
  const games = seasonGames([game("a", { stat }), game("a", { stat }), game("b", { stat })]);
  // Main accounts' ranked games, flat groups of 3: time, won, lobby average rank.
  const pubs = (...g) => g.flatMap(([t, won, avg]) => [t, won, avg]);
  const at = (avg, won = 1) => Array.from({ length: 5 }, (_, i) => [150 + i, won, avg]);
  const ranked = {
    // Before the season is left out: Legend 2 lobbies to Legend 3, 1 star.
    101: pubs([50, 1, 31], ...at(52)),
    // Archon 5 lobbies to Legend 3 now: 3 stars.
    202: pubs(...at(45, 0), [160, 1, 45]),
    // Divine 5 lobbies to Immortal: 1 star, more net wins than a1.
    203: pubs(...at(75), ...at(75)),
  };
  const ranks = new Map([["101", 53], ["202", 53], ["203", 80]]);
  const s = seasonAwards(games, { ranked, since: 100, ranks }).find((a) => a.key === "sandbagged");
  assert.equal(s.player, "b2");
  assert.deepEqual([s.from, s.to, s.climb, s.wins, s.losses], [45, 53, 3, 1, 5]);
  assert.deepEqual(s.top.map((t) => [t.key, t.climb]), [["b2", 3], ["b3", 1], ["a1", 1]]);
  assert.equal(medalStars(80) - medalStars(75), 1);
  // Without the ranked games, or nobody up: no award.
  assert.equal(seasonAwards(games).find((a) => a.key === "sandbagged"), undefined);
  assert.equal(seasonAwards(games, { ranked: { 203: ranked[203] }, since: 100, ranks: new Map([["203", 75]]) }).find((a) => a.key === "sandbagged"), undefined);
});

test("upset award needs a result the model gave under 40%", () => {
  const s = { id: 9, home: 1, away: 2, home_score: 0, away_score: 2 };
  const games = seasonGames([game("a"), game("a"), game("a")]);
  assert.equal(seasonAwards(games, { reads: [{ s, q: 0.6, p: 0.45 }] }).find((a) => a.key === "upset"), undefined);
  const up = seasonAwards(games, { reads: [{ s, q: 0.8, p: 0.04 }] }).find((a) => a.key === "upset");
  assert.equal(up.team, 2);
  assert.equal(up.loser, 1);
});

test("playerWrapped on the Champion data", () => {
  const d = JSON.parse(readFileSync(new URL("../public/data/ad2l.json", import.meta.url), "utf8"));
  const games = seasonGames(d.games.map(withDerived));
  const awards = seasonAwards(games, { series: d.series, teams: d.teams });
  const mvp = awards.find((a) => a.key === "mvp");
  const w = playerWrapped(games, mvp.player, { awards });
  assert.equal(w.wins + w.losses, w.games);
  assert.equal(w.mvps, mvp.value);
  assert.equal(w.mvpRank, 1);
  assert.ok(w.heroes.length >= 1 && w.heroes.length <= 3);
  assert.ok(w.awards.some((a) => a.key === "mvp"));
  assert.equal(playerWrapped(games, "nobody"), null);
});

test("setWrappedPin keeps a valid pin and refuses anything else", async () => {
  const { setWrappedPin } = await import("../public/lib/cosmetics-engine.js");
  const pin = { season: "S48", div: "heroic_a", card: "award:mvp" };
  assert.deepEqual(setWrappedPin({}, { pin: { ...pin, extra: "x" } }).wrappedPin, pin);
  assert.equal(setWrappedPin({ wrappedPin: pin }, { pin: null }).wrappedPin, null);
  for (const bad of [{ ...pin, card: "<img>" }, { ...pin, season: "48" }, { ...pin, div: "../x" }, "summary", [pin]])
    assert.throws(() => setWrappedPin({}, { pin: bad }));
});

test("targetedBans credits a ban to the teammate who plays the hero most", () => {
  const ban = (side, hero) => ({ pick: false, side, hero });
  // a1 plays Kez twice and a2 once, so bans on Kez are a1's. Luna is only a1's; Axe is nobody's.
  const g1 = game("a", { heroes: { a1: "Kez", a2: "Luna2" } }), g2 = game("b", { heroes: { a1: "Kez", a2: "Kez2" } }), g3 = game("a", { heroes: { a1: "Luna", a2: "Kez" } });
  g1.draft = [ban("b", "Kez"), ban("b", "Axe"), ban("a", "Luna")];
  g2.draft = [ban("b", "Luna"), ban("b", "Kez"), { pick: true, side: "b", hero: "Kez" }];
  const games = seasonGames([g1, g2, g3]);
  const plays = heroPlays(byPlayer(games));
  const rowsOf = (k) => games.map((m) => ({ m, p: m.players.find((q) => q.player_key === k) }));
  // g1: 1 of 2 enemy bans is a1's; g2: 2 of 2. Average share 75%.
  assert.deepEqual(targetedBans(rowsOf("a1"), plays), { drafts: 2, total: 3, share: 0.75, heroes: [{ hero: "Kez", n: 2 }, { hero: "Luna", n: 1 }], byHero: { Kez: 2, Luna: 1 } });
  assert.equal(targetedBans(rowsOf("a2"), plays), null);
});

test("bestHero: highest win rate on 2+ games", () => {
  const games = [game("a", { heroes: { a1: "Kez" } }), game("a", { heroes: { a1: "Kez" } }), game("b", { heroes: { a1: "Luna" } }), game("b", { heroes: { a1: "Luna" } }), game("a", { heroes: { a1: "Luna" } }), game("a", { heroes: { a1: "Axe" } })];
  const w = playerWrapped(seasonGames(games), "a1");
  assert.equal(w.heroes[0].hero, "Luna");
  assert.equal(w.bestHero.hero, "Kez");
});

test("seasonResults: group places, playoff finishes, teams still in rank ahead of teams out", () => {
  const d = JSON.parse(readFileSync(new URL("../public/data/heroic.json", import.meta.url), "utf8"));
  const r = seasonResults(d, { split: true });
  const byName = (n) => r.teams.get(d.teams.find((t) => t.name === n).id);
  const ch = byName("Costco Hotdog");
  assert.deepEqual([ch.group.rank, ch.group.division, ch.playoff.bracket], [1, "B", "Aegis"]);
  // Each bracket: places are dense from 1, and a finished team never ranks ahead of one still in.
  for (const name of ["Aegis", "Heroic"]) {
    const ps = [...r.teams.values()].map((t) => t.playoff).filter((p) => p?.bracket === name);
    assert.equal(ps.length, 8);
    const alive = ps.filter((p) => p.alive).length;
    for (const p of ps.filter((x) => !x.alive)) assert.ok(p.place > alive, `${p.label} ahead of a team still in`);
  }
  assert.ok(r.playoffSeries.size > 0);
  // Before a grand final there are no champions.
  assert.equal(r.champions.length, ["Aegis", "Heroic"].filter((n) => [...r.teams.values()].some((t) => t.playoff?.bracket === n && t.playoff.place === 1)).length);
});

test("deadTimeOf adds up time dead and finds the worst game", () => {
  const games = [game("a", { stat: { a1: { time_dead: 120 } } }), game("b", { stat: { a1: { time_dead: 300 } } }), game("a")];
  const d = deadTimeOf(games.map((m) => ({ m, p: m.players[0] })));
  assert.equal(d.seconds, 420);
  assert.equal(d.games, 2);
  assert.equal(d.worst.seconds, 300);
  assert.equal(d.worst.m, games[1]);
  assert.equal(deadTimeOf([{ m: games[2], p: games[2].players[0] }]), null);
});

test("biggestHitOf takes the single hardest hit", () => {
  const games = [game("a", { stat: { a1: { max_hit: [900, "lina_laguna_blade", "pudge"] } } }), game("a", { stat: { a1: { max_hit: [1500, null, "axe"] } } }), game("a")];
  const h = biggestHitOf(games.map((m) => ({ m, p: m.players[0] })));
  assert.equal(h.damage, 1500);
  assert.equal(h.source, null);
  assert.equal(h.target, "axe");
  assert.equal(biggestHitOf([{ m: games[2], p: games[2].players[0] }]), null);
});

test("highlightsOf totals multi-kills, the longest streak and first bloods", () => {
  const games = [
    game("a", { stat: { a1: { multi: [2, 1, 0, 0], streaks: [1, 1, 0, 0, 0, 0, 0, 0], first_blood: 1 } } }),
    game("a", { stat: { a1: { multi: [1, 0, 0, 1], streaks: [1, 1, 1, 1, 1, 1, 1, 1], first_blood: 0 } } }),
  ];
  const h = highlightsOf(games.map((m) => ({ m, p: m.players[0] })));
  assert.deepEqual(h.multi, [3, 1, 0, 1]);
  assert.equal(h.streak, 10);
  assert.equal(h.firstBloods, 1);
  assert.equal(highlightsOf([{ m: game("a"), p: game("a").players[0] }]), null);
});

test("personalityOf names a player's two strongest traits, or the strongest alone", () => {
  // a5 and a1 stack far more than anyone. a5 also wards (tied top 4 of 10, inside the top 40%):
  // the pair. a1 doesn't ward and is level with everyone on the rest: stacks alone.
  const games = Array.from({ length: 3 }, () => game("a", { stat: { a5: { camps_stacked: 9 }, a1: { camps_stacked: 9 } } }));
  const players = byPlayer(seasonGames(games));
  const t = personalityOf(players, players.get("a5"));
  assert.equal(t.key, "vision+stacks");
  assert.equal(t.title, "The Jungle Janitor");
  assert.deepEqual(t.traits.map((x) => [x.key, x.value, x.top]), [["stacks", 9, 2 / 10], ["vision", 10, 4 / 10]]);
  assert.equal(personalityOf(players, players.get("a1")).key, "stacks");
  // Under MIN_GAMES: none.
  const few = byPlayer(seasonGames(games.slice(0, 2)));
  assert.equal(personalityOf(few, few.get("a5")), null);
});

test("every pair of personality traits has a name, and no two share one", () => {
  const keys = TRAITS.map(([k]) => k), missing = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const k = `${keys[i]}+${keys[j]}`;
    if (!UNNAMED_PAIRS.includes(k) && !PERSONALITY_NAMES[k]) missing.push(k);
  }
  assert.deepEqual(missing, []);
  const titles = Object.values(PERSONALITY_NAMES).map(([t]) => t);
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(titles.length, TRAITS.length + (TRAITS.length * (TRAITS.length - 1)) / 2 - UNNAMED_PAIRS.length);
});

test("leaguePersonalities: at most PERSONALITY_CAP per name, never two in one division", () => {
  // Eight leagues where a5 is the same standout stacker-warder, so all eight want the same names.
  // In league 0 a1 stacks and wards just as much, so two in one league want them too.
  const leagues = Array.from({ length: 8 }, (_, i) => {
    const stat = { a5: { camps_stacked: 9 }, ...(i === 0 ? { a1: { camps_stacked: 9, obs_placed: 10 } } : {}) };
    const players = byPlayer(seasonGames(Array.from({ length: 3 }, () => game("a", { stat }))));
    return { id: `L${i}`, players, divisionOf: () => null };
  });
  const out = leaguePersonalities(leagues);
  // Every name: at most PERSONALITY_CAP holders, each from a different league.
  const holders = new Map();
  for (const [id, m] of out) for (const [, p] of m) (holders.get(p.key) ?? holders.set(p.key, []).get(p.key)).push(id);
  for (const [name, ids] of holders) {
    assert.ok(ids.length <= PERSONALITY_CAP, `${name} has ${ids.length}`);
    assert.equal(new Set(ids).size, ids.length, `${name} twice in one league`);
  }
  // Eight stackers want the same few names; they're spread over more than one.
  assert.ok(new Set([...out.values()].map((m) => m.get("a5").key)).size > 1);
  // Everyone ranked still gets a personality.
  for (const [id, m] of out) assert.equal(m.size, [...leagues.find((l) => l.id === id).players.values()].filter((e) => e.rows.length >= 3).length);
  // Each still gets a name with their standout trait in it.
  for (const [, m] of out) assert.ok(m.get("a5").key.includes("stacks"));
});

test("nemesis strip lists every game against it, oldest first, with their hero and result", () => {
  const g = (winner, t, mine) => ({ ...game(winner, { heroes: { a1: mine, b1: "storm" } }), start_time: t });
  const games = [g("b", 3, "lina"), g("a", 2, "kez"), g("b", 1, "puck"), g("b", 4, "kez")];
  const x = playerWrapped(games, "a1").nemesisMore;
  assert.deepEqual(x.strip.map((s) => [s.hero, s.won]), [["puck", false], ["kez", true], ["lina", false], ["kez", false]]);
});
