// Predict's Bracket and Possibilities tabs (lib/playoffs.js does the working out).
//  - Bracket, with a toggle:
//    - Your picks: the rest of the group stage as the viewer called it on the Predictions tab,
//      the final table and the week 8 tiebreakers it leads to, then tiebreakers and bracket to
//      fill in by clicking winners (kept in this browser).
//    - Model's picks: the same with every call the model's.
//  - Possibilities: every way the remaining series (and the tiebreakers they set up) can go,
//    as each team's chance of each place; click a cell or team for what it takes.
import { playoffPicture, possibilities, pathsTo, pathsToEvent, TBD } from "../lib/playoffs.js";
import { info } from "../lib/glossary.js";
import { esc, pct, teamLink, DIVISIONS } from "../core.js";
import { ordinal as ord } from "../lib/ranks.js";

const RULES = "https://dota.playon.gg/rules";
const to = (where) => (where === "out" ? "out" : `to the ${where}`);
const bo = (n) => (n ? `Bo${n}` : "best-of not set in the rules");
// The model's score ("2–0") and each score's chance from the first-listed team's side.
const sc = (m) => `${m.score[0]}–${m.score[1]}`;
const scoreOdds = (m) => m.scores.map((s) => `${s.a}–${s.b} <span class="muted">${pct(s.p)}</span>`).join(" · ");
const MODES = [["mine", "Your picks"], ["model", "Model's picks"]];
const MODE_KEY = "po-mode";
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: not remembered */ } };

// el: the section to fill. myCalls: series id → the viewer's pick ("home", "tie", "away").
// view: "bracket", "odds", or "team" (one team's chances, for its team page; `team` its id).
export function mountPlayoffs(el, src, d, ratings, myCalls = new Map(), { view = "bracket", team = null } = {}) {
  const split = !!DIVISIONS[src.key]?.views;
  const name = Object.fromEntries(d.teams.map((t) => [t.id, t.name]));
  const link = (id) => (id == null ? '<span class="muted">bye</span>' : teamLink(src, name[id], id));
  const pickKey = `po-picks:${src.key}`;
  const state = { mode: load(MODE_KEY, "mine"), picks: load(pickKey, {}), weight: "equal", sel: null };
  if (!MODES.some(([id]) => id === state.mode)) state.mode = "mine";
  const possCache = {};

  const render = () => {
    if (view === "odds") { el.innerHTML = possHtml(); return; }
    if (view === "team") { el.innerHTML = teamHtml(); return; }
    const bar = `<div class="pd-toggle po-modes" role="group" aria-label="Whose bracket">${MODES.map(([id, label]) => `<button type="button" data-pomode="${id}" aria-pressed="${id === state.mode}">${label}</button>`).join("")}</div>`;
    el.innerHTML = `${bar}${pictureHtml(state.mode === "mine")}`;
  };

  // ---------- your picks / the model's picks ----------

  const pictureHtml = (mine) => {
    const p = playoffPicture(d.teams, d.series, ratings, mine
      ? { split, call: (s) => myCalls.get(s.id), choose: (k) => state.picks[k], blank: true }
      : { split });
    const score = (s, id) => (s.home === id ? s.home_score : s.away_score);
    const whose = (x) => (mine ? ` <span class="po-who${x.mine ? " me" : ""}">${x.mine ? "your pick" : "model's pick"}</span>` : "");

    // The rest of the group stage: unreported series PlayOn has posted, then weeks it hasn't.
    const left = p.series.filter((s) => s.projected);
    const paired = left.filter((s) => s.paired);
    const unpicked = left.filter((s) => !s.paired && !s.bye && !s.mine).length;
    // One series as a small card: both teams with their game wins, the winner lit, a 1–1 in
    // gold, and whose call it is underneath.
    const game = (s) => {
      const tie = s.home_score === s.away_score;
      const other = (id) => (id === s.home ? s.away : s.home);
      const row = (id) => `<div class="po-g-t${score(s, id) > score(s, other(id)) ? " w" : ""}">${link(id)}<b>${score(s, id)}</b></div>`;
      const by = s.bye ? "bye · counts 1–0" : s.paired ? "model · guessed pairing" : mine ? (s.mine ? "your call" : "model's call · not called yet") : "model's call";
      return `<div class="po-g${tie ? " tie" : ""}${s.mine ? " me" : ""}">${row(s.home)}${row(s.away)}<div class="po-g-by">${esc(by)}</div></div>`;
    };
    const restHtml = left.length ? `
        ${left.some((s) => !s.paired) ? `<div class="po-games">${left.filter((s) => !s.paired).map(game).join("")}</div>` : ""}
        ${[...new Set(paired.map((s) => s.week))].map((wk) => `<h4 class="po-h">Week ${wk} · <span class="po-guess">pairings guessed</span></h4><div class="po-games">${paired.filter((s) => s.week === wk).map(game).join("")}</div>`).join("")}
      ${mine && unpicked ? `<p class="po-nudge">${unpicked} ${unpicked === 1 ? "series isn't" : "series aren't"} called yet, so ${unpicked === 1 ? "it goes" : "they go"} the model's way. <button type="button" class="linkish" data-tocards>Call ${unpicked === 1 ? "it" : "them"} on Predictions</button></p>` : ""}
      ${paired.length ? `<p class="table-note">PlayOn hasn't posted week ${Math.min(...paired.map((s) => s.week))} yet. These stand in: in table order, each team plays the nearest team it hasn't met (AD2L pairs "pseudo-swiss" but doesn't publish how)${mine ? ", with the model's calls, since there's nothing to pick yet" : ""}. Once the real pairings sync, this uses them.</p>` : ""}`
      : `<p class="table-note">Every group-stage series is in.</p>`;

    // A team in a match the viewer can pick: a button that sends it through.
    const pickBtn = (x, id) => `<button type="button" class="po-pick${x.winner === id ? " on" : ""}${x.mine ? " me" : ""}" data-k="${esc(x.key)}" data-w="${id}" aria-pressed="${x.winner === id}">${esc(name[id])}</button>`;

    const divHtml = (dv) => {
      const lineAt = new Map(dv.lines.map((l) => [l.after, l]));
      const status = (place) => {
        const i = dv.lines.findIndex((x) => place <= x.after);
        return i === 0 ? dv.lines[0].above : i > 0 ? dv.lines[i - 1].below : dv.lines.at(-1)?.below ?? "upper bracket";
      };
      const gain = (r) => r.wins - (d.series.filter((s) => s.home_score != null && (s.home === r.id || s.away === r.id)).reduce((a, s) => a + score(s, r.id), 0));
      const zone = (place) => status(place).replace(/\W+/g, "-").toLowerCase();
      const table = `<div class="table-wrap"><table class="po-table">
        <thead><tr><th scope="col">#</th><th scope="col" class="l">Team</th><th scope="col">Wins</th><th scope="col">SoS${info("sos")}</th><th scope="col" class="l">Goes to</th></tr></thead>
        <tbody>${dv.rows.map((r) => `<tr class="${lineAt.has(r.place) ? "po-cut" : ""} po-${zone(r.place)}">
          <td class="num po-place">${r.place}</td><td class="l">${link(r.id)}</td>
          <td class="num">${r.wins}${gain(r) ? ` <span class="po-gain">+${gain(r)}</span>` : ""}</td><td class="num">${r.sos}</td>
          <td class="l po-to"><span class="po-zone">${esc(status(r.place))}</span></td></tr>`).join("")}</tbody></table></div>`;

      const tbs = dv.tiebreakers.map((tb) => {
        const [a, b] = tb.places;
        const m = (x) => mine
          ? `<li class="po-tbm"><div class="po-tbm-row"><span class="po-bo">${bo(x.bestOf)}</span>${pickBtn(x, x.a)}<span class="muted">v</span>${pickBtn(x, x.b)}${whose(x)}</div>
            <div class="po-tbm-meta">${x.note ? `${esc(x.note)} · ` : ""}model: ${esc(name[x.model])} ${pct(x.model === x.winner ? x.p : 1 - x.p)}${x.bestOf > 1 ? ` · ${scoreOdds(x)}` : ""}</div></li>`
          : `<li><span class="po-bo">${bo(x.bestOf)}</span> ${link(x.a)} <span class="muted">v</span> ${link(x.b)}${x.note ? ` <span class="muted">(${esc(x.note)})</span>` : ""}
            → <b>${esc(name[x.winner])} ${sc(x)}</b> <span class="muted">${pct(x.p)} to win</span>
            ${x.bestOf > 1 ? `<span class="po-odds">${scoreOdds(x)}</span>` : ""}</li>`;
        return `<div class="po-tb">
          <p><b>${tb.teams.length} teams tied on ${tb.wins} wins</b> for ${ord(a)}–${ord(b)}: ${tb.slots} ${tb.slots === 1 ? "goes" : "go"} ${esc(to(tb.line.above))}, the rest ${esc(to(tb.line.below))}.
            Ranked by SoS: ${tb.sosRank.map((x) => `${esc(name[x.id])} <span class="muted">${x.sos}${x.by && x.by.by !== "SoS" ? `, behind on ${esc(x.by.by)}` : ""}</span>`).join(" · ")}.</p>
          ${tb.matches.length ? `<ul>${tb.matches.map(m).join("")}</ul>` : `<p class="muted">Decided by SoS, no games.</p>`}
          <p class="po-out">${tb.above.map((id) => esc(name[id])).join(", ")} ${esc(to(tb.line.above))}; ${tb.below.map((id) => esc(name[id])).join(", ")} ${esc(to(tb.line.below))}.</p>
          ${tb.stated ? "" : `<p class="table-note">The rules' table doesn't list ${tb.slots} ${tb.slots === 1 ? "place" : "places"} for ${tb.teams.length} teams; this follows its nearest case.</p>`}
        </div>`;
      }).join("");
      const lastSeed = split ? 8 : Math.min(8, dv.rows.length);
      const seedTies = dv.settled.filter((x) => x.place < lastSeed);
      const settledHtml = seedTies.length ? `<p class="po-settled"><b>Ties decided without playing</b> (seed order: SoS, head to head, highest common opponent, 1v1 mid):
        ${seedTies.map((x) => `${ord(x.place)}: ${esc(name[x.above])} ahead of ${esc(name[x.below])} on ${esc(x.detail)}`).join(" · ")}.</p>` : "";

      // Table on the left, week 8 on the right (stacked on narrow screens).
      return `${dv.division ? `<h3 class="po-div">Division ${esc(dv.division)}</h3>` : ""}
        <div class="po-split">
          <div>${table}</div>
          <div class="po-week8">
            <h4 class="po-h">Week 8 tiebreakers</h4>
            ${tbs || `<p class="po-none">None. No tie sits across a dividing line${dv.lines.length ? ` (${dv.lines.map((l) => `${ord(l.after)}/${ord(l.after + 1)}`).join(", ")})` : ""}, so week 8 has no games.</p>`}
            ${settledHtml}
          </div>
        </div>`;
    };
    // Each division's own bracket (everything but Heroic/Aegis).
    const divBracket = (dv) => (dv.bracket ? bracketHtml(dv.bracket, { seedOf: new Map(dv.rows.slice(0, 8).map((r) => [r.id, r.place])), teams: dv.rows.length, title: dv.division ? `Division ${dv.division} bracket` : "" }) : "");

    // seedOf: team id → its seed label. title: a heading over the bracket (Aegis, Heroic).
    const bracketHtml = (b, { seedOf, teams = 8, title = "Bracket" }) => {
      const slot = (m, id) => {
        if (id === TBD) return `<div class="po-slot tbd"><span class="po-seed"></span><span>TBD</span></div>`;
        if (id == null) return `<div class="po-slot bye"><span class="po-seed"></span><span>bye</span></div>`;
        const win = m.winner === id && !m.bye;
        if (mine && !m.bye && !m.pending) return `<button type="button" class="po-slot po-pick${win ? " win on" : ""}${m.mine ? " me" : ""}" data-k="${esc(m.key)}" data-w="${id}" aria-pressed="${win}"><span class="po-seed">${seedOf.get(id) ?? ""}</span><span class="po-nm">${esc(name[id])}</span></button>`;
        return `<div class="po-slot${win ? " win" : ""}"><span class="po-seed">${seedOf.get(id) ?? ""}</span>${link(id)}${m.bye || m.pending ? "" : `<span class="po-gw">${m.score[m.winner === id ? 0 : 1]}</span>`}</div>`;
      };
      // Your picks: an open match says "pick", a picked one "your pick"; a match still waiting
      // on an earlier pick just shows TBD.
      const tag = (m) => (m.mine ? ` <span class="po-who me">your pick</span>` : m.open ? ` <span class="po-who open">pick</span>` : "");
      const box = (m) => `<div class="po-m${m.side === "final" ? " gf" : ""}${m.bye ? " is-bye" : ""}${m.pending ? " is-tbd" : ""}">
          <div class="po-mh">${esc(m.label)} · ${m.side === "final" ? "Bo3 or Bo5" : bo(m.bestOf)}${!m.bye && mine ? tag(m) : ""}</div>
          ${slot(m, m.a)}${slot(m, m.b)}
          ${m.bye || m.pending ? "" : mine ? `<div class="po-mp">model: ${esc(name[m.model])} ${pct(m.mine && m.winner !== m.model ? 1 - m.p : m.p)}</div>`
            : `<div class="po-mp">${esc(name[m.winner])} ${sc(m)} · ${pct(m.p)} to win${m.side === "final" ? " (as Bo5)" : ""}</div>
          <div class="po-odds">${scoreOdds(m)}</div>`}
        </div>`;
      const weeks = Math.max(...b.matches.map((m) => m.week));
      const col = (side, w) => b.matches.filter((m) => m.side === side && m.week === w).map(box).join("");
      const gf = b.matches.find((m) => m.side === "final");
      const pickChoice = mine && !b.fixed ? `<div class="po-seedpick" role="group" aria-label="Seed 1 plays">
          <span class="pd-lbl">Seed 1 picks</span>${[3, 4].map((k) => `<button type="button" data-k="pick" data-w="${k}" aria-pressed="${b.pick === k}">Seed ${k}</button>`).join("")}
          <span class="muted">${state.picks.pick ? "your pick" : `model's pick: the weaker one, seed ${b.modelPick}`}</span></div>` : "";
      const shape = b.fixed ? "" : teams < 8 ? `${teams} teams, so everyone's in: ${teams <= 4 ? "all start in the upper bracket" : "seeds 5–6 start in the lower bracket"}. The rules only describe 8-team brackets, so this layout is the site's assumption.` : "Lower round 1 is 5 v 8 and 6 v 7; the loser of seed 1's match meets the 6 v 7 winner, as S47's brackets ran.";
      return `${title ? `<h4 class="po-h">${esc(title)}</h4>` : ""}
        ${mine ? pickChoice : b.fixed ? "" : `<p class="table-note">${`Seed 1 picks seed 3 or 4 to play first; the model has it take the weaker one (${b.pick === 3 ? "seed 3" : "seed 4"} here). `}</p>`}
        ${shape ? `<p class="table-note">${shape}</p>` : ""}
        <div class="po-br-wrap"><div class="po-br" style="--weeks:${weeks}">
          ${Array.from({ length: weeks }, (_, i) => `<div class="po-wk" style="grid-column:${i + 2}">Playoff week ${i + 1}</div>`).join("")}
          <div class="po-lbl up">Upper</div><div class="po-lbl low">Lower</div>
          ${Array.from({ length: weeks - 1 }, (_, i) => `<div class="po-col up" style="grid-column:${i + 2}">${col("upper", i + 1)}</div><div class="po-col low" style="grid-column:${i + 2}">${col("lower", i + 1)}</div>`).join("")}
          <div class="po-col gf" style="grid-column:${weeks + 1}">${box(gf)}<div class="po-champ"><span>${mine ? "Your champion" : "Champion"}</span>${b.champion === TBD ? '<span class="po-champ-tbd">pick the grand final</span>' : link(b.champion)}</div></div>
        </div></div>`;
    };

    const heroicNote = split ? `<p class="po-heroic">Top 8 of each division make the playoffs. <b>Aegis</b>: 1st and 2nd of each division start in the upper bracket, 3rd and 4th in the lower. <b>Heroic</b>: 5th and 6th start upper, 7th and 8th lower. Each is a double-elimination bracket.</p>` : "";
    const splitBrackets = (p.brackets ?? []).map((x) => bracketHtml(x.bracket, { seedOf: x.labels, title: `${x.name} bracket` })).join("");
    const splitNote = splitBrackets ? `<p class="table-note">AD2L hasn't said who meets whom across the two divisions. These assume the usual crossover: in the upper bracket A1 v B2 and B1 v A2, in the lower A3 v B4 and B3 v A4 (Heroic the same with 5th–8th); the loser of A1's match meets the B3 v A4 winner, as S47's brackets ran.</p>` : "";
    const lead = mine
      ? `<p class="po-lead">Your calls from the Predictions tab, played out by <a href="${RULES}" target="_blank" rel="noopener">AD2L's rules</a>. Click winners to fill in week 8 and the bracket. A tiebreaker you leave goes the model's way (dashed); the bracket fills in only as you pick, starting from week 1.</p>`
      : `<p class="po-lead">Every call the model's way, by <a href="${RULES}" target="_blank" rel="noopener">AD2L's rules</a>: 2–0 to the favourite (1–1 for a coin flip), and in Bo3s and the bracket the stronger team by its likeliest score, with the chance of every score underneath, top team first.</p>`;

    // Your picks: how much of it is yours so far, and the champion(s) it ends on.
    const brackets = p.brackets?.map((x) => [x.name, x.bracket]) ?? p.divisions.filter((dv) => dv.bracket).map((dv) => [dv.division ? `Division ${dv.division}` : "", dv.bracket]);
    const tbMatches = p.divisions.flatMap((dv) => dv.tiebreakers.flatMap((tb) => tb.matches));
    const brMatches = brackets.flatMap(([, b]) => b.matches.filter((m) => !m.bye));
    // (pending matches count toward the total: they're picks still to make)
    const groupLeft = left.filter((s) => !s.paired && !s.bye);
    const stat = (label, done, all) => `<div class="po-stat${all && done === all ? " full" : ""}"><span>${label}</span><b>${all ? `${done}<i>/${all}</i>` : "—"}</b></div>`;
    const progress = mine ? `<div class="po-progress">
        ${stat("Series called", groupLeft.filter((s) => s.mine).length, groupLeft.length)}
        ${stat("Week 8 picked", tbMatches.filter((m) => m.mine).length, tbMatches.length)}
        ${stat("Bracket picked", brMatches.filter((m) => m.mine).length, brMatches.length)}
        ${brackets.map(([n, b]) => `<div class="po-stat champ"><span>${n ? `${esc(n)} champion` : "Your champion"}</span><b>${b.champion === TBD ? '<i class="po-tbd">not picked yet</i>' : esc(name[b.champion] ?? "—")}</b></div>`).join("")}
        ${Object.keys(state.picks).length ? `<button type="button" class="linkish po-clear" data-reset>Clear my picks</button>` : ""}
      </div>` : "";
    const step = (n, title, hint, body) => `<section class="po-step"><header><span class="po-step-n">${n}</span><div><h3>${title}</h3>${hint ? `<p>${hint}</p>` : ""}</div></header>${body}</section>`;

    return `${lead}${progress}
      ${step(1, "Rest of the group stage", mine ? "From your calls on the Predictions tab." : "", restHtml)}
      ${step(2, "Final table and week 8", mine && tbMatches.length ? "Click who wins each tiebreaker." : "", `${heroicNote}${p.divisions.map(divHtml).join("")}`)}
      ${brackets.length ? step(3, split ? "Playoff brackets" : "Bracket", mine ? "Click a team to send it through." : "", `${splitNote}${split ? splitBrackets : p.divisions.map(divBracket).join("")}`) : ""}
      ${howHtml}`;
  };

  const howHtml = `<details class="how"><summary>How the tiebreakers work</summary>
      <p>The table counts game wins (a bye is 1–0). <b>SoS</b> (strength of schedule) is the total wins of every opponent a team has played; a team met twice counts twice. It's worked out on the final table, so a result still to come moves the SoS of everyone who played those two teams.</p>
      <p>A tie <b>across a dividing line</b> (upper/lower bracket, lower bracket/out${split ? ", Aegis/Heroic" : ""}) is played off in week 8. The tied teams are ranked by SoS, and the rules' table sets the games ("1 SoS" is the best SoS of the tied teams):</p>
      <ul class="how-list">
        ${TB_CASES.map(([, text]) => `<li>${text}.</li>`).join("")}
      </ul>
      <p>A case the rules don't list (1 slot for 5+ teams, say) follows the nearest one and is marked on the Bracket tab. A tie in SoS is broken by head to head, then record against the highest common opponent, then a single 1v1 solo mid between a player nominated by each team.</p>
      <p>A tie that only decides <b>seed order</b> isn't played off: SoS, then head to head, then record against the highest common opponent. If none of those break it, the 1v1 solo mid decides the higher seed.</p>
      <p><b>On this page.</b> The Bracket tab shows one way it goes: the model's winner of each week 8 game, and the model's stronger team where it comes down to a 1v1 mid. Possibilities counts every way: each week 8 game both ways (half each, or by the model's odds) and each 1v1 mid 50/50 (the model rates teams, not mid players; three or more teams level take every order equally).</p>
      <p><b>Scores.</b> Each game is the model's one-game chance, played independently. The score shown is the winner's likeliest: in a Bo3 that's always 2–0, because 2–1 needs the favourite to drop a game. A close Bo3 shows up in the odds below it (2–1 either way adds up). In a Bo5 the favourite's likeliest score is 3–1 unless it wins over 2 games in 3, then 3–0.</p>
    </details>`;

  // ---------- possibilities ----------

  // One open series as a condition: which of its three results a path allows.
  // From the picked team's side when it plays in the series ("beat X 2–0"), else plainly
  // ("A beats B 2–0", "A wins or 1–1 v B").
  const cond = (s, m, me) => {
    if (s.home === me || s.away === me) {
      const opp = esc(name[s.home === me ? s.away : s.home]);
      const win = s.home === me ? 1 : 4, lose = s.home === me ? 4 : 1;
      return { [win]: `beat ${opp} 2–0`, 2: `1–1 with ${opp}`, [lose]: `lose 0–2 to ${opp}`, [win | 2]: `beat ${opp} or 1–1`, [lose | 2]: `1–1 or lose to ${opp}`, 5: `no 1–1 with ${opp}` }[m];
    }
    const H = esc(name[s.home]), A = esc(name[s.away]);
    return { 1: `${H} beats ${A} 2–0`, 2: `${H} and ${A} go 1–1`, 4: `${A} beats ${H} 2–0`, 3: `${H} wins or 1–1 v ${A}`, 6: `${A} wins or 1–1 v ${H}`, 5: `${H} v ${A} isn't 1–1` }[m];
  };
  // What week 8 has to do, from pathsTo's tb code.
  const week8 = (tb) => tb === "*" ? "and the other week 8 tiebreakers falling right"
    : `Week 8: ${tb.split(",").map((x) => `${x[0] === "w" ? "beat" : "lose to"} ${esc(name[Number(x.slice(1))])}`).join(", then ")}`;

  const possNow = () => (possCache[state.weight] ??= possibilities(d.teams, d.series, ratings, { split, weight: state.weight }));
  // The summary columns: each line's label and a team's chance there (a running total, or with
  // `band` just that line's places).
  const summary = (dv) => {
    const lines = dv.lines.filter((l) => l.after < dv.ids.length);
    const sum = (id, k) => dv.dist.get(id).slice(0, k).reduce((a, b) => a + b, 0);
    return lines.filter((l) => l.col).map((l) => ({ label: l.col, of: (id) => sum(id, l.after) - (l.band ? sum(id, lines[lines.indexOf(l) - 1]?.after ?? 0) : 0) }));
  };

  // One team's chances: its summary, a bar per place, and what it takes for each.
  const teamHtml = () => {
    const P = possNow(), dv = P.divisions.find((x) => x.ids.includes(team));
    if (!dv) return `<div class="panel empty">This team isn't in the table.</div>`;
    const dist = dv.dist.get(team), N = dv.ids.length;
    const best = dist.reduce((b, p, i) => (p > dist[b] ? i : b), 0);
    const sel = state.sel?.team === team ? state.sel : { team, place: null };
    const cards = [{ label: "Likeliest place", value: `${ord(best + 1)}`, note: pctFine(dist[best]) }, ...summary(dv).map((c) => ({ label: c.label, value: pctFine(c.of(team)) }))];
    const bars = Array.from({ length: N }, (_, i) => {
      const p = dist[i], on = sel.place === i + 1;
      const inner = `<span class="po-tb-k">${ord(i + 1)}</span><span class="po-tb-bar"><i style="width:${(Math.min(1, p) * 100).toFixed(1)}%"></i></span><span class="po-tb-v">${p < 5e-4 ? "·" : pctFine(p)}</span>`;
      const hue = `style="--ph:${placeHue(i + 1, playoffCut(dv))}"`;
      return p < 5e-4 ? `<div class="po-tbar zero" ${hue}>${inner}</div>` : `<button type="button" class="po-tbar${on ? " on" : ""}" ${hue} data-team="${team}" data-place="${i + 1}">${inner}</button>`;
    }).join("");
    const n = dv.open?.length;
    return `${weightBar()}
      <p class="po-lead">${dv.exact ? (n ? `Every way the last ${n} group-stage series in the division can go (${dv.count} outcomes), and every way the week 8 tiebreakers they set up can go.` : "Every group-stage series is in; only week 8 is left.") : `${dv.count} random runs of the rest of the season (too many outcomes to list one by one).`} ${state.weight === "equal" ? "Each outcome counts the same." : "Weighted by the model's odds."} <b>Click a place</b> for what it takes.</p>
      <div class="po-tcards">${cards.map((c) => `<div class="po-stat"><span>${esc(c.label)}</span><b>${c.value}${c.note ? ` <i>${c.note}</i>` : ""}</b></div>`).join("")}</div>
      <div class="po-tbars">${bars}</div>
      ${detailHtml(P, dv, sel)}
      <p class="table-note">Ties on wins go by AD2L's tiebreakers: SoS first, then head to head and highest common opponent, a week 8 playoff across a dividing line, and a 1v1 mid (counted 50/50) if nothing else splits them. <button type="button" class="linkish" data-goodds>Every team's chances on Predict →</button></p>`;
  };

  const weightBar = () => `<div class="pd-toggle po-weightbar" role="group" aria-label="How outcomes count"><span class="pd-lbl">Count</span>
        <button type="button" data-weight="equal" aria-pressed="${state.weight === "equal"}">Every outcome the same</button>
        <button type="button" data-weight="model" aria-pressed="${state.weight === "model"}">By the model's odds</button></div>`;

  const possHtml = () => {
    const P = possNow();
    const n = P.divisions.reduce((a, dv) => a + (dv.open?.length ?? 0), 0);
    const counts = P.divisions.length > 1 ? P.divisions.map((dv) => `${dv.count} in Division ${esc(dv.division)}`).join(", ") : `${P.divisions[0]?.count} in all`;
    const unposted = P.divisions.some((dv) => dv.unposted), sampled = P.divisions.find((dv) => !dv.exact);
    const lead = P.exact
      ? (n ? `<p class="po-lead">Every way the last ${n} group-stage series can go: 2–0 either way or 1–1 each, ${counts} outcomes, and for each one every way the week 8 tiebreakers it sets up can go. ${state.weight === "equal" ? "Each outcome counts the same (a tiebreaker splits its outcome in half)." : "Each outcome counts by how likely the model makes it."} A cell is the share where the team finishes in that place. <b>Click a cell</b> for what it takes to finish there, or <b>a team ▸</b> to open every place it can reach.</p>`
        : `<p class="po-lead">Every group-stage series is in, so the table is set; only the week 8 tiebreakers are left to play. A cell is the share of tiebreaker outcomes where the team finishes there.</p>`)
      : `<p class="po-lead">Too many ways the rest can go to list one by one${unposted ? " (PlayOn hasn't posted every week, and the pairings depend on the results)" : ""}, so this plays out ${sampled?.count} random runs instead: each series 2–0 either way or 1–1${state.weight === "equal" ? " with equal chances" : " by the model's odds"}, unposted weeks paired as on the other tabs, then the week 8 tiebreakers. A cell is the share of runs where the team finishes there. Once the last week is posted, this lists every outcome and what each team needs.</p>`;

    const divHtml = (dv) => {
      const N = dv.ids.length;
      const exp = (id) => dv.dist.get(id).reduce((a, p, i) => a + p * (i + 1), 0);
      const rows = [...dv.ids].sort((a, b) => exp(a) - exp(b));
      const lines = dv.lines.filter((l) => l.after < N), cols = lines.filter((l) => l.col);
      const sum = (id, k) => dv.dist.get(id).slice(0, k).reduce((a, b) => a + b, 0);
      const cell = (id, i) => {
        const p = dv.dist.get(id)[i], on = state.sel?.team === id && state.sel?.place === i + 1;
        const cls = `po-c${lines.some((l) => l.after === i + 1) ? " po-line" : ""}`;
        if (p < 5e-4) return `<td class="${cls} zero">·</td>`;
        return `<td class="${cls}"><button type="button" data-team="${id}" data-place="${i + 1}" class="${on ? "on" : ""}" style="--p:${Math.min(1, p).toFixed(3)}" title="${esc(name[id])}: ${ord(i + 1)} in ${pctFine(p)}">${pctFine(p)}</button></td>`;
      };
      const table = `<div class="table-wrap"><table class="po-poss">
        <thead><tr><th scope="col" class="l">Team</th>${Array.from({ length: N }, (_, i) => `<th scope="col"${lines.some((l) => l.after === i + 1) ? ' class="po-line"' : ""}>${ord(i + 1)}</th>`).join("")}
          ${cols.map((l) => `<th scope="col" class="po-sum">${esc(l.col)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((id) => `<tr class="${state.sel?.team === id ? "sel" : ""}"><th scope="row" class="l"><button type="button" class="linkish po-team" data-team="${id}" aria-expanded="${state.sel?.team === id && !state.sel.place}" title="Every place ${esc(name[id])} can reach"><span class="po-caret" aria-hidden="true"></span><span class="po-tname">${esc(name[id])}</span></button></th>
          ${Array.from({ length: N }, (_, i) => cell(id, i)).join("")}
          ${cols.map((l) => `<td class="po-sum num">${pctFine(sum(id, l.after) - (l.band ? sum(id, lines[lines.indexOf(l) - 1]?.after ?? 0) : 0))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      const pick = state.sel && dv.ids.includes(state.sel.team) ? detailHtml(P, dv, state.sel) : "";
      return `${dv.division ? `<h3 class="po-div">Division ${esc(dv.division)}</h3>` : ""}${table}${pick}${eventsHtml(dv)}`;
    };

    return `${weightBar()}${lead}${P.divisions.map(divHtml).join("")}
      <p class="table-note">Ties on wins are broken as AD2L's rules say: across a dividing line, a week 8 tiebreaker (counted both ways); for seed order, SoS, head to head, record against the highest common opponent, then a 1v1 mid (counted 50/50).</p>
      ${howHtml}`;
  };

  // Every week 8 tiebreaker and every 1v1 mid that can happen, each with its chance and (click)
  // the results that lead to it.
  const EV_MAX = 10;
  const eventsHtml = (dv) => {
    const all = [...dv.events.values()].filter((e) => e.p >= 5e-4).sort((a, b) => b.p - a.p);
    const teams = (e) => e.teams.map((t) => esc(name[t])).join(", ");
    const lineName = (l) => `${esc(l.above)} / ${esc(l.below)}`;
    const why = (e) => (dv.exact ? `<button type="button" class="linkish${state.ev === e.key ? " on" : ""}" data-ev="${esc(e.key)}">${state.ev === e.key ? "Hide" : "What leads to it"}</button>` : "");
    const section = (kind, title, lead, none, head, row) => {
      const list = all.filter((e) => e.kind === kind), showAll = state.evAll?.[`${dv.division}|${kind}`];
      const shown = showAll ? list : list.slice(0, EV_MAX);
      const open = list.find((e) => e.key === state.ev);
      return `<h4 class="po-h po-ev-h">${title}</h4><p class="po-lead">${lead}</p>
        ${list.length ? `<div class="table-wrap"><table class="po-ev"><thead><tr><th scope="col">Chance</th>${head}<th scope="col"></th></tr></thead>
          <tbody>${shown.map((e) => `<tr class="${state.ev === e.key ? "sel" : ""}"><td class="num">${pctFine(e.p)}</td>${row(e)}<td>${why(e)}</td></tr>`).join("")}</tbody></table></div>
          ${list.length > EV_MAX ? `<button type="button" class="linkish" data-evall="${esc(`${dv.division}|${kind}`)}">${showAll ? "Show fewer" : `Show all ${list.length}`}</button>` : ""}
          ${open ? eventWays(dv, open) : ""}` : `<p class="muted">${none}</p>`}`;
    };
    const tb = section("tb", "Possible week 8 tiebreakers",
      `Every tie across a dividing line the rest of the season can leave, and how often (${state.weight === "equal" ? "share of outcomes" : "by the model's odds"}). The format is the rules' case for that many teams and places.`,
      "No result left can leave a tie across a dividing line.",
      `<th scope="col" class="l">Line</th><th scope="col" class="l">Teams level</th><th scope="col">Wins</th><th scope="col">Places</th><th scope="col" class="l">Format</th>`,
      (e) => `<td class="l">${lineName(e.line)}</td><td class="l name">${teams(e)}</td><td class="num">${e.wins}</td><td class="num">${ord(e.places[0])}–${ord(e.places[1])}</td><td class="l name">${esc(tbCase(e.slots, e.teams.length))}</td>`);
    const mid = section("mid", "Possible 1v1 mids",
      "Teams level on wins, SoS, head to head and record against the highest common opponent play a 1v1 solo mid. Each is counted 50/50 here.",
      "No result left can bring two teams level all the way to a 1v1.",
      `<th scope="col" class="l">Teams</th><th scope="col">Wins</th><th scope="col" class="l">Decides</th>`,
      (e) => `<td class="l name">${teams(e)}</td><td class="num">${e.wins}</td><td class="l name">${e.purpose === "seed"
        ? (e.teams.length === 2 ? `Who's ${ord(e.places[0])} and who's ${ord(e.places[1])}` : `The order of ${ord(e.places[0])}–${ord(e.places[1])}`)
        : `Their order in the ${lineName(e.line)} tiebreaker for ${ord(e.places[0])}–${ord(e.places[1])} (which games they play, or a slot straight in)`}</td>`);
    return `<div class="po-events">${tb}${mid}${dv.exact ? "" : `<p class="table-note">Chances here are from the random runs; what leads to each shows once every outcome can be listed.</p>`}</div>`;
  };
  // The results that lead to one tiebreaker or 1v1: each way, every result it needs.
  const eventWays = (dv, e) => {
    const paths = pathsToEvent(dv, e.key, dv.total);
    const way = (c, k) => {
      const list = [...c.masks.map((m, i) => (m === 7 ? null : cond(dv.open[i], m, null))).filter(Boolean), ...(c.tb ? [week8(c.tb)] : [])];
      return `<details class="po-way" open><summary><span class="po-way-n">Way ${k + 1}</span><span class="po-need-share">${pctFine(c.p)}</span>
          <span class="po-way-sum">${list.length ? `${list.length} result${list.length === 1 ? "" : "s"}` : "any results"}</span></summary>
        <ul class="po-way-list">${list.length ? list.map((x) => `<li${x.startsWith("and the other") ? ' class="tb"' : ""}>${x}</li>`).join("") : '<li class="any">Any results lead here</li>'}</ul></details>`;
    };
    const MAX = 8;
    return `<div class="po-need"><div class="po-need-h"><b>${e.kind === "tb" ? "Week 8 tiebreaker" : "1v1 mid"}: ${e.teams.map((t) => esc(name[t])).join(", ")}</b> ${pctFine(e.p)}
        <button type="button" class="linkish" data-ev="${esc(e.key)}">Close</button></div>
      <div class="po-ways-grid">${paths.slice(0, MAX).map(way).join("")}</div>
      ${paths.length > MAX ? `<p class="muted">…and ${paths.length - MAX} more ways, ${pctFine(paths.slice(MAX).reduce((a, c) => a + c.p, 0))} between them.</p>` : ""}
      <p class="table-note">Any one way leads here; every result inside it has to happen. Series not listed can go any way.</p></div>`;
  };

  const detailHtml = (P, dv, sel) => {
    const id = sel.team, dist = dv.dist.get(id);
    const places = sel.place ? [sel.place] : dist.map((p, i) => [p, i + 1]).filter(([p]) => p >= 5e-4).map(([, k]) => k);
    // On the team page the name is the page itself: the row only shows once a place is picked.
    const head = view === "team" && !sel.place ? "" : `<div class="po-need-h"><b>${esc(name[id])}</b>${sel.place ? ` in ${ord(sel.place)}: ${pctFine(dist[sel.place - 1])}` : ""}
      ${sel.place ? `<button type="button" class="linkish" data-team="${id}">Show every place</button>` : ""}
      ${view === "team" ? "" : `<button type="button" class="linkish" data-close>Close</button>`}</div>`;
    if (!dv.exact) return `<div class="po-need">${head}<p class="muted">Listing what it takes needs every outcome, and there are too many ${dv.unposted ? "while weeks are unposted" : "with more than 9 series left"}. Shares above are from random runs.</p></div>`;
    const MAX = 8;
    const own = (i) => dv.open[i].home === id || dv.open[i].away === id;
    const block = (place) => {
      const paths = pathsTo(dv, id, place, dv.total);
      const hue = `style="--ph:${placeHue(place, playoffCut(dv))}"`;
      // Each place collapsible, closed to start unless it's the one picked.
      const open = sel.place === place ? " open" : "";
      if (!paths.length) return `<details class="po-need-p" ${hue}${open}><summary><h5>${ord(place)} · 0%</h5></summary><p class="muted">Can't happen.</p></details>`;
      // Each way in full, collapsible: its share and the team's own result up top, every result
      // it needs inside, side by side in a grid, all open to start.
      const n = dv.open.length, order = [...Array(n).keys()].sort((x, y) => own(y) - own(x));
      const needs = (c) => [
        ...order.filter((i) => c.masks[i] !== 7).map((i) => ({ own: own(i), text: cond(dv.open[i], c.masks[i], id) })),
        ...(c.tb ? [{ tb: true, text: week8(c.tb) }] : []),
      ];
      const way = (c, k) => {
        const list = needs(c), mine = list.find((x) => x.own);
        const rest = list.length - (mine ? 1 : 0);
        return `<details class="po-way" open><summary>
            <span class="po-way-n">Way ${k + 1}</span><span class="po-need-share">${pctFine(c.p)}</span>
            <span class="po-way-sum">${mine ? `<b>${mine.text}</b>` : ""}${list.length ? (rest ? `${mine ? " + " : ""}${rest} more result${rest === 1 ? "" : "s"}` : "") : "any results"}</span></summary>
          <ul class="po-way-list">${list.length ? list.map((x) => `<li class="${x.own ? "own" : x.tb ? "tb" : ""}">${x.text}</li>`).join("") : '<li class="any">Any results get them here</li>'}</ul>
        </details>`;
      };
      return `<details class="po-need-p" ${hue}${open}><summary><h5>${ord(place)} · ${pctFine(dist[place - 1])} of outcomes · ${paths.length} way${paths.length === 1 ? "" : "s"}</h5></summary>
        <div class="po-ways-grid">${paths.slice(0, MAX).map(way).join("")}</div>
        ${paths.length > MAX ? `<p class="muted">…and ${paths.length - MAX} more ways, ${pctFine(paths.slice(MAX).reduce((a, c) => a + c.p, 0))} between them.</p>` : ""}
      </details>`;
    };
    return `<div class="po-need">${head}${places.map(block).join("")}
      <p class="table-note">Any one way gets them there; every result listed inside it has to happen. "Or" means either result of that one series is fine. <span class="po-key">Gold</span> is ${esc(name[id])}'s own series. Series not listed can go any way. The share beside each way is how much of ${state.weight === "equal" ? "all outcomes" : "the model's odds"} it covers.</p></div>`;
  };

  // ---------- wiring ----------

  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.pomode) { state.mode = t.dataset.pomode; save(MODE_KEY, state.mode); return keep(render); }
    if (t.dataset.k) {
      const k = t.dataset.k, w = Number(t.dataset.w);
      // Clicking your own pick again hands the match back to the model.
      if (state.picks[k] === w) delete state.picks[k]; else state.picks[k] = w;
      save(pickKey, state.picks);
      return keep(render);
    }
    if (t.hasAttribute("data-tocards")) { document.querySelector('.pp-tabs [data-tab="calls"]')?.click(); return; }
    if (t.hasAttribute("data-reset")) { state.picks = {}; save(pickKey, state.picks); return keep(render); }
    if (t.dataset.weight) { state.weight = t.dataset.weight; return keep(render); }
    if (t.hasAttribute("data-goodds")) {
      // Predict opens on its remembered tab; drop this page's ?tab= so it doesn't carry over.
      try { localStorage.setItem("predictTab", "odds"); } catch {}
      history.replaceState(history.state, "", location.pathname);
      location.hash = `${src.root}/predict`;
      return;
    }
    if (t.hasAttribute("data-close")) { state.sel = null; return keep(render); }
    if (t.dataset.ev) { state.ev = state.ev === t.dataset.ev ? null : t.dataset.ev; return keep(render); }
    if (t.dataset.evall) { state.evAll = { ...state.evAll, [t.dataset.evall]: !state.evAll?.[t.dataset.evall] }; return keep(render); }
    if (t.dataset.team) {
      const team = Number(t.dataset.team), place = t.dataset.place ? Number(t.dataset.place) : null;
      state.sel = state.sel?.team === team && state.sel?.place === place ? null : { team, place };
      return keep(render, true);
    }
  });
  // Re-render without the page jumping: keep the clicked spot where it was on screen.
  const keep = (fn, toDetail = false) => {
    const y = scrollY;
    fn();
    scrollTo({ top: y });
    if (toDetail) el.querySelector(".po-need")?.scrollIntoView({ block: "nearest" });
  };
  render();
}

// The rules' week 8 table (AD2L S48 rules): [slots, teams (a number, or "n+"), the format].
const TB_CASES = [
  [[1, 2], "1 slot, 2 teams: Bo3"],
  [[1, 3], "1 slot, 3 teams: 2 SoS v 3 (Bo1), the winner plays 1 (Bo1)"],
  [[1, 4], "1 slot, 4 teams: 1 SoS v 4, 2 v 3, the winners play for the slot"],
  [[2, 3], "2 slots, 3 teams: 1 SoS in, 2 v 3 (Bo3)"],
  [[2, "4+"], "2 slots, 4+ teams: 1 SoS v 4 (Bo3), 2 v 3 (Bo3), 5+ SoS out"],
  [[3, 4], "3 slots, 4 teams: 1 and 2 SoS in, 3 v 4 (Bo3)"],
  [[3, 5], "3 slots, 5 teams: 1 SoS in, then as 2 slots, 4 teams"],
  [[3, "6+"], "3 slots, 6+ teams: 1 SoS in, 6+ out, then as 2 slots, 4 teams"],
  [[4, 5], "4 slots, 5 teams: 1, 2 and 3 SoS in, 4 v 5 (Bo3)"],
  [[4, 6], "4 slots, 6 teams: 1 and 2 SoS in, then as 2 slots, 4 teams"],
];
const tbCase = (slots, n) => TB_CASES.find(([[s, t]]) => s === slots && (t === n || (typeof t === "string" && n >= parseInt(t, 10))))?.[1]
  ?? `${slots} slot${slots === 1 ? "" : "s"}, ${n} teams: not in the rules' table, so its nearest case`;

// A share with a decimal under 1% so a long shot doesn't read as 0%.
// Each final place's colour, best first: gold, green, teal, sky, blue, indigo, violet, magenta
// through the playoff places, then red for every place that misses them. CSS turns --ph (a
// hue) into a colour that reads in both themes.
const PLACE_HUES = [45, 140, 172, 198, 222, 250, 275, 305];
const placeHue = (place, cut) => (place > cut ? 0 : PLACE_HUES[Math.min(place - 1, PLACE_HUES.length - 1)]);
// The last place that makes the playoffs (everyone, in a division too small to cut).
const playoffCut = (dv) => dv.lines.find((l) => l.below === "out" && l.after < dv.ids.length)?.after ?? dv.ids.length;
const pctFine = (p) => (p >= 1 - 5e-4 ? "100%" : p > 0.99 ? ">99%" : p >= 0.01 ? `${Math.round(p * 100)}%` : p > 0 ? `${(p * 100).toFixed(1)}%` : "0%");
