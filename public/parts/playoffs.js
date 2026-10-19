// Predict's Bracket and Possibilities tabs (lib/playoffs.js does the working out).
//  - Bracket: the rest of the group stage as the viewer called it on the Predictions tab,
//    the final table and the week 8 tiebreakers it leads to, then tiebreakers and bracket to
//    fill in by clicking winners (kept in this browser). The model's bracket (every call the
//    model's) shows only when watched from the Bracket leaderboard.
//  - Possibilities: every way the remaining series (and the tiebreakers they set up) can go,
//    as each team's chance of each place; click a cell or team for what it takes.
import { playoffPicture, possibilities, pathsTo, pathsToEvent, TBD, HEROIC_DEFAULT, bracketsOf, seedsSettled, playoffScore, ROUND_POINTS, withFix } from "../lib/playoffs.js";
import { info } from "../lib/glossary.js";
import { esc, pct, teamLink, DIVISIONS } from "../core.js";
import { groupStage, REMOVED, SEASON } from "../lib/divisions.js";
import { ordinal as ord } from "../lib/ranks.js";

const RULES = "https://dota.playon.gg/rules";
const to = (where) => (where === "out" ? "out" : `to the ${where}`);
const bo = (n) => (n ? `Bo${n}` : "best-of not set in the rules");
// The model's score ("2–0") and each score's chance from the first-listed team's side.
const sc = (m) => `${m.score[0]}–${m.score[1]}`;
const scoreOdds = (m) => m.scores.map((s) => `${s.a}–${s.b} <span class="muted">${pct(s.p)}</span>`).join(" · ");
const BR_KEY = "po-split-br";
// A bracket drawn as PlayOn draws it: a column per playoff week, upper above lower, each match
// level with the middle of the matches whose winners play in it (lib/playoffs.js `from`), joined
// to them by lines. Rows are equal, so a match's place is exact: round 1 takes two rows, a match
// spans the rows of its feeders, and the grand final spans both sides. box(m): a match's HTML;
// champ: what goes under the grand final.
const NIGHT = (w) => SEASON.playoffNights?.[w - 1] ? new Date(`${SEASON.playoffNights[w - 1]}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : "";
function grid(b, box, champ) {
  const weeks = [...new Set(b.matches.map((m) => m.week))].sort((x, y) => x - y);
  const col = (m) => weeks.indexOf(m.week) + 2;
  const span = new Map(), size = {};
  for (const side of ["upper", "lower"]) {
    let next = 0;
    for (const m of b.matches.filter((x) => x.side === side)) {
      const fs = m.from.map((id) => span.get(id)).filter(Boolean);
      span.set(m.id, fs.length ? [Math.min(...fs.map((f) => f[0])), Math.max(...fs.map((f) => f[1]))] : [next, next += 2]);
    }
    size[side] = next;
  }
  // Grid rows: 1 the week heads, then upper, one spare row, lower.
  const top = { upper: 2, lower: 3 + size.upper };
  const rowsOf = (m) => (m.side === "final" ? [2, top.lower + size.lower] : span.get(m.id).map((r) => r + top[m.side]));
  const feeds = new Set(b.matches.flatMap((m) => m.from));
  const byId = new Map(b.matches.map((m) => [m.id, m]));
  const cell = (m) => {
    const [r0, r1] = rowsOf(m), fs = m.from.map((id) => byId.get(id));
    const start = fs.length ? Math.max(...fs.map(col)) + 1 : col(m);
    // The rail joining the feeders' lines, as % of this cell's height from the top and bottom.
    const ys = [50, ...fs.map((f) => { const [a, z] = rowsOf(f); return ((a + z) / 2 - r0) / (r1 - r0) * 100; })];
    const rail = fs.length ? ` style="--t:${Math.min(...ys).toFixed(2)}%;--b:${(100 - Math.max(...ys)).toFixed(2)}%"` : "";
    const inner = m.side === "final" ? `<div class="po-gfw">${box(m)}${champ}</div>` : box(m);
    return `<div class="po-cell${fs.length ? " has-in" : ""}${feeds.has(m.id) ? " has-out" : ""}" style="grid-column:${start}/${col(m) + 1};grid-row:${r0}/${r1}"><span class="po-in"${rail}></span>${inner}</div>`;
  };
  return `<div class="po-br-wrap"><div class="po-br" style="--cols:${weeks.length};--rows:${size.upper + 1 + size.lower};--up:${size.upper};--low:${size.lower}">
    ${weeks.map((w, i) => `<div class="po-wk" style="grid-column:${i + 2}">Playoff week ${w}${NIGHT(w) ? ` <span>${NIGHT(w)}</span>` : ""}</div>`).join("")}
    <div class="po-lbl up" style="grid-row:${top.upper}/${top.upper + size.upper}">Upper</div><div class="po-lbl low" style="grid-row:${top.lower}/${top.lower + size.lower}">Lower</div>
    ${b.matches.map(cell).join("")}
  </div></div>`;
}

const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: not remembered */ } };

// el: the section to fill. myCalls: series id → the viewer's pick ("home", "tie", "away").
// view: "bracket", "odds", or "team" (one team's chances, for its team page; `team` its id).
// watch: { name, model, picks } shows someone else's bracket, read-only (the Leaderboard tab):
// their series calls (myCalls) and, when they saved a bracket, their tiebreaker and bracket picks
// (`picks`, key → winner's team id); without it those go the model's way. `model` shows the
// model's own picks.
// share: { name, save(picks) } keeps the viewer's own picks on the Leaderboard (empty name: not
// yet, the page asks for one).
// final: once a league's seeds are settled (tiebreakers played), Your picks is one whole bracket
// that's submitted once and is then final: { closes (unix seconds), mine: { picks, orig, fix,
// open, submittedAt } or null, submit(picks), fix(picks) }. A bracket whose layout changed after
// it was sent (open: matches it has no pick for) gets one fix before `closes`: picks for those
// matches only (lib/playoffs.js withFix). Played matches are filled in for everyone. watch.final: someone's
// submitted bracket, shown read-only with its points.
// locked: when the bracket locked (unix seconds; the first bracket match, lib/playoffs.js
// postseason), or null. Locked, the viewer's bracket is the one saved on the Leaderboard, shown
// read-only. Played postseason series show as results either way.
export function mountPlayoffs(el, src, d, ratings, myCalls = new Map(), { view = "bracket", team = null, watch = null, share = null, locked = null, status = null, final = null } = {}) {
  const split = !!DIVISIONS[src.key]?.views;
  const name = Object.fromEntries(d.teams.map((t) => [t.id, t.name]));
  const link = (id) => (id == null ? '<span class="muted">bye</span>' : teamLink(src, name[id], id));
  const pickKey = `po-picks:${src.key}`;
  const state = { mode: watch?.model ? "model" : "mine", picks: watch ? { ...(watch.picks ?? {}) } : locked && share?.saved ? { ...share.saved } : load(pickKey, {}), weight: "equal", sel: null };
  // Heroic/Aegis: the week 8 reading PlayOn's posted brackets went with (lib/playoffs.js
  // HEROIC_VERSIONS), and which of the two brackets is on screen.
  state.version = HEROIC_DEFAULT;
  state.br = load(BR_KEY, "Aegis") === "Heroic" ? "Heroic" : "Aegis";
  const possCache = {};
  // The submitted-bracket view, once the seeds are settled (see `final` above). A draft is kept
  // in this browser until it's submitted, starting from any bracket picks made before.
  const finalKey = `po-final:${src.key}`;
  const ready = view === "bracket" && !status && !!(final || watch?.final) && seedsSettled(playoffPicture(d.teams, d.series, ratings, { split, version: state.version, blank: true }));
  const fixKey = `po-fix:${src.key}`;
  const beforeClose = () => Date.now() < (final?.closes ?? Infinity) * 1000;
  const fixable = () => !!(final?.mine?.open && !final.mine.fix && beforeClose());
  // Fixing: the bracket as sent, plus a draft of the new picks (kept in this browser till sent).
  // What was sent always wins, so only the open matches can take a pick.
  if (ready && !watch) state.fpicks = fixable() ? { ...load(fixKey, {}), ...final.mine.picks } : load(finalKey, null) ?? { ...load(pickKey, {}) };
  const sentKey = (k) => phase() === "fix" && Object.hasOwn(final.mine.picks, k);
  const phase = () => (!ready ? null : watch ? "watch" : final.mine ? (fixable() ? "fix" : "sent") : beforeClose() ? "open" : "closed");
  const brBar = () => `<div class="pd-toggle po-brs" role="group" aria-label="Bracket">${["Aegis", "Heroic"].map((n) => `<button type="button" data-br="${n}" aria-pressed="${n === state.br}">${n}</button>`).join("")}</div>`;

  // Your picks go to the Leaderboard as you click (a short pause after the last click), so
  // others can open your bracket.
  let shared = share?.name ? "idle" : "noname", shareTimer = null;
  function shareText() {
    return { noname: "Type your name above to share your bracket on the Leaderboard.", idle: `Shared on the Leaderboard as <b>${esc(share?.name ?? "")}</b>.`, saving: "Saving to the Leaderboard…", saved: `Saved to the Leaderboard as <b>${esc(share?.name ?? "")}</b>.`, failed: "Couldn't save your bracket to the Leaderboard. It's still kept in this browser." }[shared];
  }
  // Picks made before the name was set (or before this was saved) go up on first show.
  const unsynced = () => share?.name && Object.keys(state.picks).length && JSON.stringify(state.picks) !== JSON.stringify(share.saved ?? {});
  const showShare = () => { const n = el.querySelector("[data-share]"); if (n) n.innerHTML = shareText(); };
  function shareNow() {
    if (!share?.name || locked) return; // a locked bracket is never saved again
    shared = "saving"; showShare();
    clearTimeout(shareTimer);
    shareTimer = setTimeout(async () => {
      try { await share.save(state.picks); shared = "saved"; } catch (e) { console.warn(e); shared = "failed"; }
      showShare();
    }, 600);
  }

  const render = () => {
    if (view === "odds") { el.innerHTML = possHtml(); return; }
    if (view === "team") { el.innerHTML = teamHtml(); return; }
    if (ready && (watch || state.mode === "mine")) { el.innerHTML = pictureHtml(true, phase()); return; }
    el.innerHTML = status ? pictureHtml(false) : pictureHtml(state.mode === "mine");
  };

  // ---------- your picks / the model's picks ----------

  const pictureHtml = (mine, fin = null) => {
    // `mine` is a person's own series calls; `live` is the viewer clicking tiebreakers and the
    // bracket (not when watching someone else, whose bracket picks aren't saved).
    // fin: the submitted-bracket phase ("open" to pick, "fix", "sent", "closed", "watch"; see `final`).
    const live = fin ? fin === "open" || fin === "fix" : mine && !watch && !locked, frozen = fin ? fin === "sent" : mine && !watch && !!locked;
    const finPicks = fin === "sent" ? final.mine.picks : fin === "watch" ? watch.final : null;
    // Fixing shows the bracket as sent (played results don't move it), like any submitted one.
    const p = fin ? playoffPicture(d.teams, d.series, ratings, fin === "open" ? { split, version: state.version, choose: (k) => state.fpicks[k], blank: true }
        : fin === "fix" ? { split, version: state.version, choose: (k) => state.fpicks[k], blank: true, asPicked: true }
        : finPicks ? { split, version: state.version, choose: (k) => finPicks[k], blank: true, asPicked: true } : { split, version: state.version, blank: true })
      : playoffPicture(d.teams, d.series, ratings, status ? { split, version: state.version, blank: true } : live || frozen
      ? { split, version: state.version, call: (s) => myCalls.get(s.id), choose: (k) => state.picks[k], blank: true }
      : mine ? { split, version: state.version, call: (s) => myCalls.get(s.id), choose: watch?.picks ? (k) => state.picks[k] : undefined, blank: !!watch?.picks }
      : { split, version: state.version });
    // A submitted bracket next to the bracket as played: each match's real result, and points.
    const asPlayed = finPicks ? new Map(bracketsOf(playoffPicture(d.teams, d.series, ratings, { split, version: state.version, blank: true }), split).map(([n, b]) => [n, b])) : null;
    const fscore = finPicks ? playoffScore(d.teams, d.series, ratings, finPicks, { split, version: state.version }) : null;
    // status: the bracket as played, no picks. A seed still riding on an unplayed tiebreaker is TBD,
    // and a match nobody has won shows its running score or "yet to play".
    const unresolved = new Set(status ? p.divisions.flatMap((dv) => dv.tiebreakers.filter((tb) => tb.matches.some((m) => !m.real)).flatMap((tb) => tb.teams)) : []);
    const progressOf = (m) => status?.progress?.find((x) => (x.home === m.a && x.away === m.b) || (x.home === m.b && x.away === m.a));
    const statusLine = (m) => {
      const x = progressOf(m);
      if (!x) return "Yet to play";
      const [sa, sb] = x.home === m.a ? [x.sa, x.sb] : [x.sb, x.sa];
      return `${sa}–${sb}${x.live ? " · Live" : " · in progress"}`;
    };
    const score = (s, id) => (s.home === id ? s.home_score : s.away_score);
    const whose = (x) => (mine ? ` <span class="po-who${x.mine ? " me" : ""}">${x.mine ? (watch ? "their pick" : "your pick") : "model's pick"}</span>` : "");

    // Series still to be reported, PlayOn-posted or not. Nothing lists them: they show up in the
    // table they lead to, so just say which went the model's way.
    const left = p.series.filter((s) => s.projected);
    const paired = left.filter((s) => s.paired);
    const unpicked = left.filter((s) => !s.paired && !s.bye && !s.mine).length;
    const notesHtml = `${watch && mine && unpicked ? `<p class="po-nudge">${unpicked} ${unpicked === 1 ? "series wasn't" : "series weren't"} called by ${esc(watch.name)}, so ${unpicked === 1 ? "it goes" : "they go"} the model's way.</p>` : ""}
      ${live && unpicked ? `<p class="po-nudge">${unpicked} ${unpicked === 1 ? "series isn't" : "series aren't"} called yet, so ${unpicked === 1 ? "it goes" : "they go"} the model's way. <button type="button" class="linkish" data-tocards>Call ${unpicked === 1 ? "it" : "them"} on Predictions</button></p>` : ""}
      ${paired.length ? `<p class="table-note keep">PlayOn hasn't posted week ${Math.min(...paired.map((s) => s.week))} yet. Until it does, each team plays the nearest team in the table it hasn't met (AD2L pairs "pseudo-swiss" but doesn't publish how)${mine ? ". The model calls these games" : ""}.</p>` : ""}`;

    // A team in a match the viewer can pick: a button that sends it through.
    const pickBtn = (x, id) => `<button type="button" class="po-pick${x.winner === id ? " on" : ""}${x.mine ? " me" : ""}" data-k="${esc(x.key)}" data-w="${id}" aria-pressed="${x.winner === id}">${esc(name[id])}</button>`;

    const divHtml = (dv) => {
      const lineAt = new Map(dv.lines.map((l) => [l.after, l]));
      const status = (place) => {
        const i = dv.lines.findIndex((x) => place <= x.after);
        return i === 0 ? dv.lines[0].above : i > 0 ? dv.lines[i - 1].below : dv.lines.at(-1)?.below ?? "upper bracket";
      };
      const gain = (r) => r.wins - (groupStage(d.series).filter((s) => s.home_score != null && (s.home === r.id || s.away === r.id)).reduce((a, s) => a + score(s, r.id), 0));
      const zone = (place) => status(place).replace(/\W+/g, "-").toLowerCase();
      const table = `<div class="table-wrap"><table class="po-table">
        <thead><tr><th scope="col">#</th><th scope="col" class="l">Team</th><th scope="col">Wins</th><th scope="col">SoS${info("sos")}</th><th scope="col" class="l">Goes to</th></tr></thead>
        <tbody>${dv.rows.map((r) => `<tr class="${lineAt.has(r.place) ? "po-cut" : ""} po-${zone(r.place)}">
          <td class="num po-place">${r.place}</td><td class="l">${link(r.id)}</td>
          <td class="num">${r.wins}${gain(r) ? ` <span class="po-gain">+${gain(r)}</span>` : ""}</td><td class="num">${r.sos}</td>
          <td class="l po-to"><span class="po-zone" title="${esc(status(r.place))}">${esc(status(r.place).replace(/upper bracket/i, "UB").replace(/lower bracket/i, "LB"))}</span></td></tr>`).join("")}</tbody></table></div>`;

      const tbs = dv.tiebreakers.map((tb) => {
        const [a, b] = tb.places;
        const m = (x) => x.real
          ? `<li><span class="po-bo">${bo(x.bestOf)}</span> ${link(x.a)} <span class="muted">v</span> ${link(x.b)} → <b>${esc(name[x.winner])} ${sc(x)}</b> <span class="po-who played">played</span></li>`
          : live
          ? `<li class="po-tbm"><div class="po-tbm-row"><span class="po-bo">${bo(x.bestOf)}</span>${pickBtn(x, x.a)}<span class="muted">v</span>${pickBtn(x, x.b)}${whose(x)}</div>
            ${x.note ? `<div class="po-tbm-meta">${esc(x.note)}</div>` : ""}</li>`
          : `<li><span class="po-bo">${bo(x.bestOf)}</span> ${link(x.a)} <span class="muted">v</span> ${link(x.b)}${x.note ? ` <span class="muted">(${esc(x.note)})</span>` : ""}
            → <b>${esc(name[x.winner])} ${sc(x)}</b> <span class="muted">${pct(x.p)} to win</span>
            ${x.bestOf > 1 ? `<span class="po-odds">${scoreOdds(x)}</span>` : ""}</li>`;
        return `<div class="po-tb">
          <p><b>${tb.teams.length} teams tied on ${tb.wins} wins</b> for ${ord(a)}–${ord(b)}: ${tb.slots} ${tb.slots === 1 ? "goes" : "go"} ${esc(to(tb.line.above))}, the rest ${esc(to(tb.line.below))}.
            Ranked by SoS: ${tb.sosRank.map((x) => `${esc(name[x.id])} <span class="muted">${x.sos}${x.by && x.by.by !== "SoS" ? `, behind on ${esc(x.by.by)}` : ""}</span>`).join(" · ")}.</p>
          ${tb.matches.length ? `<ul>${tb.matches.map(m).join("")}</ul>` : `<p class="muted">Decided by SoS, no games.</p>`}
          <p class="po-out">${tb.above.map((id) => esc(name[id])).join(", ")} ${esc(to(tb.line.above))}; ${tb.below.map((id) => esc(name[id])).join(", ")} ${esc(to(tb.line.below))}.</p>
          ${tb.stated ? "" : `<p class="table-note keep">The rules don't cover ${tb.slots} ${tb.slots === 1 ? "place" : "places"} for ${tb.teams.length} teams, so this uses the nearest case.</p>`}
        </div>`;
      }).join("");
      const lastSeed = split ? 8 : Math.min(8, dv.rows.length);
      const seedTies = dv.settled.filter((x) => x.place < lastSeed);
      const settledHtml = seedTies.length ? `<p class="po-settled"><b>Ties decided without playing</b> (seed order: SoS, head to head, highest common opponent, then a 1v1 mid for 1st or a coin flip for any other seed):
        ${seedTies.map((x) => `${ord(x.place)}: ${esc(name[x.above])} ahead of ${esc(name[x.below])} on ${esc(x.detail)}`).join(" · ")}.</p>` : "";

      // Week 8 is over (no group series left, every tiebreaker played): just the table.
      if (seedsSettled({ series: p.series, divisions: [dv] })) return `${dv.division ? `<h3 class="po-div">Division ${esc(dv.division)}</h3>` : ""}${table}`;
      // Table on the left, week 8 on the right (stacked on narrow screens).
      return `${dv.division ? `<h3 class="po-div">Division ${esc(dv.division)}</h3>` : ""}
        <div class="po-split">
          <div>${table}</div>
          <div class="po-week8">
            <h4 class="po-h">Week 8 tiebreakers</h4>
            ${tbs || `<p class="po-none">None. No ties across a dividing line${dv.lines.length ? ` (${dv.lines.map((l) => `${ord(l.after)}/${ord(l.after + 1)}`).join(", ")})` : ""}, so week 8 has no games.</p>`}
            ${settledHtml}
          </div>
        </div>`;
    };
    // Each division's own bracket (everything but Heroic/Aegis).
    const divBracket = (dv) => (dv.bracket ? bracketHtml(dv.bracket, { seedOf: new Map(dv.rows.slice(0, 8).map((r) => [r.id, r.place])), teams: dv.rows.length, title: dv.division ? `Division ${dv.division} bracket` : fin ? "" : "Bracket", bn: dv.division }) : "");

    // seedOf: team id → its seed label. title: a heading over the bracket (Aegis, Heroic).
    // bn: the bracket's name in bracketsOf (to find it as played, for a submitted bracket).
    const bracketHtml = (b, { seedOf, teams = 8, title = "Bracket", bn = "" }) => {
      // A submitted bracket's match: how the real one went (matched by its place in the bracket).
      const finLine = (m) => {
        const a = asPlayed?.get(bn)?.matches.find((x) => x.id === m.id);
        if (!a?.real) return `<div class="po-mp">Not played yet</div>`;
        const right = a.winner === m.winner;
        return `<div class="po-mp po-res ${right ? "right" : "wrong"}">${right ? "✓" : "✗"} ${esc(name[a.winner])} won ${sc(a)}${right ? "" : ` <span class="muted">v ${esc(name[a.loser])}</span>`}</div>`;
      };
      const slot = (m, id) => {
        if (id === TBD) return `<div class="po-slot tbd"><span class="po-seed"></span><span>TBD</span></div>`;
        if (id == null) return `<div class="po-slot bye"><span class="po-seed"></span><span>bye</span></div>`;
        if (status && unresolved.has(id)) return `<div class="po-slot tbd" title="Decided by a week 8 tiebreaker"><span class="po-seed">${seedOf.get(id) ?? ""}</span><span>TBD</span></div>`;
        const win = m.winner === id && !m.bye && (!status || m.real);
        if (live && !m.bye && !m.pending && !m.real && !sentKey(m.key)) return `<button type="button" class="po-slot po-pick${win ? " win on" : ""}${m.mine ? " me" : ""}" data-k="${esc(m.key)}" data-w="${id}" aria-pressed="${win}"><span class="po-seed">${seedOf.get(id) ?? ""}</span><span class="po-nm">${esc(name[id])}</span></button>`;
        return `<div class="po-slot${win ? " win" : ""}"><span class="po-seed">${seedOf.get(id) ?? ""}</span>${link(id)}${m.bye || m.pending || m.open || (live && !m.real) || (status && !m.real) || (fin && !m.real) ? "" : `<span class="po-gw">${m.score[m.winner === id ? 0 : 1]}</span>`}</div>`;
      };
      // Your picks: an open match says "pick", a picked one "your pick"; a match still waiting
      // on an earlier pick just shows TBD.
      const tag = (m) => (m.real ? ` <span class="po-who played">played</span>` : m.mine ? ` <span class="po-who me">${live ? "your pick" : frozen ? "your pick" : "their pick"}</span>` : m.open ? ` <span class="po-who open">${live ? "pick" : "not picked"}</span>` : "");
      // status: a match whose teams could still change. Seed 1's first opponent (3 or 4) is its
      // own choice and the site only guesses it until a series between them exists. A seed that
      // rides on an unplayed tiebreaker just shows TBD (the slot), no box.
      const pickOpen = !b.matches.some((x) => (x.id === "u1" || x.id === "u2") && !x.bye && (x.real || progressOf(x)));
      const maybeWhy = (m) => !status || m.real || m.bye || m.pending || progressOf(m) ? ""
        : !b.fixed && pickOpen && (m.id === "u1" || m.id === "u2") ? "Could switch: seed 1 picks seed 3 or 4"
        : b.fixed && !b.pickSet && m.week === 1 ? "Could switch: cross-division matchups not announced" : "";
      const box = (m) => { const why = maybeWhy(m); return `<div class="po-m${m.side === "final" ? " gf" : ""}${m.bye ? " is-bye" : ""}${m.pending ? " is-tbd" : ""}${why ? " is-maybe" : ""}">
          <div class="po-mh">${esc(m.label)} · ${m.side === "final" ? "Bo3 or Bo5" : bo(m.bestOf)}${!m.bye && (live || frozen || m.real) ? tag(m) : ""}</div>
          ${slot(m, m.a)}${slot(m, m.b)}
          ${m.bye || m.pending ? "" : finPicks ? finLine(m) : m.real ? `<div class="po-mp">${esc(name[m.winner])} won ${sc(m)}</div>` : fin === "closed" ? `<div class="po-mp">Yet to play</div>` : status ? `<div class="po-mp">${statusLine(m)}</div>` : m.open && !live ? `<div class="po-mp">not picked</div>` : live ? ""
            : `<div class="po-mp">${esc(name[m.winner])} ${sc(m)} · ${pct(m.p)} to win${m.side === "final" ? " (as Bo5)" : ""}</div>
          <div class="po-odds">${scoreOdds(m)}</div>`}
          ${why ? `<div class="po-maybe">${why}</div>` : ""}
        </div>`; };
      const pickChoice = live && fin !== "fix" && !b.fixed && !b.pickSet ? `<div class="po-seedpick" role="group" aria-label="Seed 1 plays">
          <span class="pd-lbl">Seed 1 picks</span>${[3, 4].map((k) => `<button type="button" data-k="pick" data-w="${k}" aria-pressed="${b.pick === k}">Seed ${k}</button>`).join("")}
          <span class="muted">${state.picks.pick ? "your pick" : `model's pick: the weaker one, seed ${b.modelPick}`}</span></div>` : "";
      const shape = b.fixed ? "" : teams < 8 ? `${teams} teams, so everyone makes it: ${teams <= 4 ? "all start in the upper bracket" : "seeds 5–6 start in the lower bracket, 6 against the loser of seed 1's match and 5 against the other"}, as PlayOn's bracket has it.` : "Lower round 1 is 5 v 8 and 6 v 7. The loser of seed 1's match plays the 5 v 8 winner, as PlayOn's bracket has it.";
      return `${title ? `<h4 class="po-h">${esc(title)}</h4>` : ""}
        ${status || (fin && !live) ? "" : live ? pickChoice : b.fixed ? "" : `<p class="table-note keep">${b.pickSet ? `Seed 1 picked seed ${b.pick} as its first opponent.` : `Seed 1 picks seed 3 or 4 as its first opponent. The model takes the weaker one (${b.pick === 3 ? "seed 3" : "seed 4"}).`}</p>`}
        ${shape ? `<p class="table-note keep">${shape}</p>` : ""}
        ${grid(b, box, `<div class="po-champ"><span>${live || frozen ? "Your champion" : watch && mine ? "Their champion" : "Champion"}</span>${b.champion === TBD ? `<span class="po-champ-tbd">${status ? "TBD" : live ? "pick the grand final" : "not picked"}</span>` : link(b.champion)}</div>`)}`;
    };

    const removed = d.teams.filter((t) => REMOVED.has(t.id));
    const heroicNote = split ? `<p class="po-heroic">Top 8 of each division make the playoffs. <b>Aegis</b>: 1st to 4th of each division. <b>Heroic</b>: 5th to 8th. Each is a double-elimination bracket where all 8 start in the upper bracket.${removed.length ? ` ${removed.map((t) => `<b>${esc(t.name)}</b>`).join(", ")} ${removed.length === 1 ? "was" : "were"} removed from the league, so ${removed.length === 1 ? "it isn't" : "they aren't"} in the table below. ${removed.length === 1 ? "Its" : "Their"} results still count for the teams ${removed.length === 1 ? "it" : "they"} played.` : ""}</p>` : "";
    const splitBrackets = p.brackets?.length ? `${brBar()}${p.brackets.filter((x) => x.name === state.br).map((x) => bracketHtml(x.bracket, { seedOf: x.labels, title: `${x.name} bracket`, bn: x.name })).join("")}` : "";
    const splitNote = splitBrackets ? `<p class="table-note keep">Round 1 is as PlayOn's brackets have it. Losers of round 1 meet in pairs in the lower bracket; PlayOn hasn't drawn who the upper semifinal losers meet, so the site has each meet the lower winner from the other half.</p>` : "";
    const lockedOn = locked ? new Date(locked * 1000).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    const lead = frozen
      ? `<p class="po-lead"><b>Brackets locked</b> when the playoffs started (${esc(lockedOn)}). ${share?.saved ? "This is the bracket you saved on the Leaderboard; each match whose winner you picked scores a point there." : "You hadn't saved a bracket on the Leaderboard before then."} Played matches show their results.</p>`
      : watch && mine
      ? `<p class="po-lead">${esc(watch.name)}'s calls from Predictions, played out under <a href="${RULES}" target="_blank" rel="noopener">AD2L's rules</a>. ${Object.keys(watch.picks ?? {}).length ? "Week 8 and the bracket are their picks; matches they didn't pick are left open." : watch.picks ? "They haven't picked any winners, so only round 1 is set, by their calls." : "Week 8 and the bracket are the model's."}</p>`
      : live
      ? `<p class="po-lead">${share ? `<span class="po-share" data-share>${shareText()}</span> ` : ""}Your calls from Predictions, played out under <a href="${RULES}" target="_blank" rel="noopener">AD2L's rules</a>. Click winners to fill in week 8 and the bracket. Tiebreakers you skip go the model's way (dashed). The bracket fills in as you pick, starting from playoff week 1.</p>`
      : `<p class="po-lead">The model's call for every series under <a href="${RULES}" target="_blank" rel="noopener">AD2L's rules</a>: 2–0 to the favourite, 1–1 for a coin flip. Bo3s and bracket matches show the favourite's likeliest score, with the odds of each score below (top team first).</p>`;

    // Your picks: how much of it is yours so far, and the champion(s) it ends on.
    const brackets = p.brackets?.map((x) => [x.name, x.bracket]) ?? p.divisions.filter((dv) => dv.bracket).map((dv) => [dv.division ? `Division ${dv.division}` : "", dv.bracket]);
    // Played matches aren't picks to make.
    const tbMatches = p.divisions.flatMap((dv) => dv.tiebreakers.flatMap((tb) => tb.matches)).filter((m) => !m.real);
    const brMatches = brackets.flatMap(([, b]) => b.matches.filter((m) => !m.bye && !m.real));
    // (pending matches count toward the total: they're picks still to make)
    const groupLeft = left.filter((s) => !s.paired && !s.bye);
    const stat = (label, done, all) => `<div class="po-stat${all && done === all ? " full" : ""}"><span>${label}</span><b>${all ? `${done}<i>/${all}</i>` : "—"}</b></div>`;
    const progress = watch && mine ? `<div class="po-progress">
        ${stat("Series called", groupLeft.filter((s) => s.mine).length, groupLeft.length)}
        ${brackets.map(([n, b]) => `<div class="po-stat champ"><span>${n ? `${esc(n)} champion` : "Champion"}</span><b>${b.champion === TBD ? "—" : esc(name[b.champion] ?? "—")}</b></div>`).join("")}
      </div>` : live ? `<div class="po-progress">
        ${stat("Series called", groupLeft.filter((s) => s.mine).length, groupLeft.length)}
        ${stat("Week 8 picked", tbMatches.filter((m) => m.mine).length, tbMatches.length)}
        ${stat("Bracket picked", brMatches.filter((m) => m.mine).length, brMatches.length)}
        ${brackets.map(([n, b]) => `<div class="po-stat champ"><span>${n ? `${esc(n)} champion` : "Your champion"}</span><b>${b.champion === TBD ? '<i class="po-tbd">not picked yet</i>' : esc(name[b.champion] ?? "—")}</b></div>`).join("")}
        ${Object.keys(state.picks).length ? `<button type="button" class="linkish po-clear" data-reset>Clear my picks</button>` : ""}
      </div>` : "";
    // The two things side by side (stacked on narrow screens): the final table with its week 8
    // tiebreakers, and the bracket it leads to.
    const bracketsHtml = brackets.length ? `${splitNote}${split ? splitBrackets : p.divisions.map(divBracket).join("")}` : "";
    if (status) return bracketsHtml ? `${splitNote}${split ? splitBrackets : p.divisions.map(divBracket).join("")}` : "";
    if (fin) return finalLayout(fin, { p, brackets, brMatches, bracketsHtml, fscore, table: `${heroicNote}${p.divisions.map(divHtml).join("")}` });
    return `${lead}${progress}${notesHtml}
      <div class="po-two">
        <section class="po-pane" aria-label="Final table and week 8">${heroicNote}${p.divisions.map(divHtml).join("")}</section>
        ${bracketsHtml ? `<section class="po-pane" aria-label="${split ? "Playoff brackets" : "Bracket"}">${bracketsHtml}</section>` : ""}
      </div>
      ${howHtml}`;
  };

  // ---------- the submitted bracket ----------

  const fmtWhen = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const finalLayout = (fin, { brackets, brMatches, bracketsHtml, fscore, table }) => {
    const stat = (label, done, all) => `<div class="po-stat${all && done === all ? " full" : ""}"><span>${label}</span><b>${all ? `${done}<i>/${all}</i>` : "—"}</b></div>`;
    const picked = brMatches.filter((m) => m.winner !== TBD).length, all = brMatches.length, full = picked === all;
    // Fixing: the matches the sent bracket has no pick for, still open in the draft.
    const toFix = fin === "fix" ? brackets.reduce((n, [, b]) => n + b.matches.filter((m) => m.open).length, 0) : 0;
    const given = brackets.flatMap(([, b]) => b.matches.filter((m) => m.real)).length;
    const closes = final?.closes ? fmtWhen(final.closes * 1000) : "";
    const theirs = fin === "watch";
    const champs = brackets.map(([n, b]) => `<div class="po-stat champ"><span>${n ? `${esc(n)} champion` : theirs ? "Their champion" : "Your champion"}</span><b>${b.champion === TBD ? '<i class="po-tbd">not picked yet</i>' : esc(name[b.champion] ?? "—")}</b></div>`).join("");
    const lead = {
      open: `<b>Brackets are open.</b> Pick a winner for every match, then submit. <b>You get one go:</b> once it's in, it's final. ${given ? `${given === 1 ? "The series already played is" : `The ${given} series already played are`} filled in for everyone. ` : ""}${closes ? `Submissions close ${esc(closes)}.` : ""}`,
      fix: `<b>Your bracket needs a fix.</b> It now follows PlayOn's layout, so some matches have new pairings your bracket has no pick for. Pick the ones marked <b>pick</b>; everything you already picked stays as it is. <b>One go</b>, like the bracket. ${closes ? `Fixes close ${esc(closes)}.` : ""}`,
      sent: `<b>Your bracket is in</b>${final?.mine?.submittedAt ? ` (submitted ${esc(fmtWhen(final.mine.submittedAt))})` : ""} and it's final. Each match shows how the real one went.`,
      closed: `<b>Submissions closed</b>${closes ? ` ${esc(closes)}` : ""} and you didn't submit a bracket. This is the bracket as played so far.`,
      watch: `${esc(watch?.name ?? "")}'s submitted bracket. Each match shows how the real one went.`,
    }[fin];
    const why = !share?.name ? "Type your name above first." : !full ? `${all - picked} ${all - picked === 1 ? "match" : "matches"} left to pick.` : "Ready. One go, so check it first.";
    const stats = fin === "fix"
      ? `<div class="po-stat${toFix ? "" : " full"}"><span>Left to pick</span><b>${toFix}</b></div>${champs}
        <div class="po-submit"><button type="button" class="primary" data-fixsubmit ${toFix ? "disabled" : ""}>Submit fixes</button><span class="po-submit-note">${toFix ? `${toFix} ${toFix === 1 ? "match" : "matches"} left to pick.` : "Ready. One go, so check it first."}</span></div>`
      : fin === "open"
      ? `${stat("Bracket picked", picked, all)}${champs}
        <div class="po-submit"><button type="button" class="primary" data-submit ${full && share?.name ? "" : "disabled"}>Submit bracket</button><span class="po-submit-note">${why}</span>
        ${Object.keys(state.fpicks).length ? `<button type="button" class="linkish po-clear" data-freset>Clear my picks</button>` : ""}</div>`
      : fscore ? `<div class="po-stat full"><span>Points</span><b>${fscore.points}</b></div>${champs}` : "";
    const earned = fscore ? [...fscore.teams].filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]) : [];
    const breakdown = earned.length ? `<p class="po-earned"><b>Points by team:</b> ${earned.map(([t, x]) => `${esc(name[t])} <span class="po-pts">${x}</span>`).join(" · ")}</p>` : "";
    const head = { open: "Your bracket", fix: "Your bracket", sent: "Your bracket", closed: "Bracket", watch: `${esc(watch?.name ?? "")}'s bracket` }[fin];
    const note = { open: "click a team to send it through", fix: "pick the open matches", sent: "submitted, final", closed: "results so far", watch: "submitted, final" }[fin];
    return `<p class="po-lead keep">${lead}</p>
      ${stats ? `<div class="po-progress">${stats}</div>` : ""}
      <section class="wkb-box po-final"><h2>${head} <span class="h-note">${note}</span></h2>${bracketsHtml}</section>
      ${breakdown}
      <details class="how"><summary>How brackets score</summary>
        <p>For every playoff week from week 2, each team you have still in the playoffs that really is still in scores <b>${ROUND_POINTS} points</b>. If you had it in the upper bracket and it's in the lower bracket, it scores <b>${ROUND_POINTS / 2}</b>. A team doing better than you picked still scores ${ROUND_POINTS}. Your champion winning the grand final is ${ROUND_POINTS} more.</p>
        <p>So a team keeps scoring for the weeks it lasts, even after it drops to the lower bracket or goes out. Series played before brackets opened are the same for everyone. A bracket submitted after the deadline doesn't count.</p>
      </details>
      <details class="how"><summary>Final table</summary>${table}</details>`;
  };
  // Your draft as picks to submit: every decided match (played ones too) and seed 1's choice.
  const draftPicks = () => {
    const bs = bracketsOf(playoffPicture(d.teams, d.series, ratings, { split, version: state.version, choose: (k) => state.fpicks[k], blank: true }), split);
    const picks = {};
    for (const [, b] of bs) {
      for (const m of b.matches) if (m.key && !m.bye && m.winner !== TBD && m.winner != null) picks[m.key] = m.winner;
      if (!b.fixed) picks.pick = b.pick;
    }
    return { picks, champions: bs.map(([n, b]) => [n, b.champion]) };
  };
  function confirmSubmit() {
    if (phase() !== "open") return keep(render);
    const { picks, champions } = draftPicks();
    document.getElementById("po-confirm")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<dialog class="tier-modal po-confirm" id="po-confirm" style="--tc:var(--accent)" aria-labelledby="po-confirm-h">
      <div class="tm-head"><div class="tm-title"><h3 id="po-confirm-h">Submit your bracket?</h3><small>One per person · final once sent</small></div><button type="button" class="tm-close" data-no aria-label="Close">×</button></div>
      <div class="tm-body">
        <p>Are you sure? <b>You can't change it after you submit.</b></p>
        <ul class="po-confirm-champ">${champions.map(([n, c]) => `<li><span>${n ? `${esc(n)} champion` : "Your champion"}</span><b>${esc(name[c] ?? "—")}</b></li>`).join("")}</ul>
        <p class="notice err po-confirm-err" hidden></p>
        <div class="po-confirm-btns"><button type="button" data-no>Go back</button><button type="button" class="primary" data-yes>Yes, submit it</button></div>
      </div></dialog>`);
    const dlg = document.getElementById("po-confirm");
    dlg.addEventListener("close", () => dlg.remove());
    dlg.querySelectorAll("[data-no]").forEach((b) => (b.onclick = () => dlg.close()));
    dlg.querySelector("[data-yes]").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = "Submitting…";
      try {
        await final.submit(picks);
        final.mine = { picks, submittedAt: new Date() };
        try { localStorage.removeItem(finalKey); } catch { /* private window */ }
        dlg.close();
        keep(render);
      } catch (err) {
        console.warn(err);
        const m = dlg.querySelector(".po-confirm-err");
        m.hidden = false;
        m.textContent = /permission/i.test(err?.message ?? "") ? "Couldn't submit: you already have a bracket in, or submissions have closed." : `Couldn't submit: ${err?.message ?? err}`;
        btn.disabled = false; btn.textContent = "Yes, submit it";
      }
    };
    dlg.showModal();
  }

  // Fixing: send the new picks only (matches the sent bracket had no pick for), once.
  function confirmFix() {
    if (phase() !== "fix") return keep(render);
    const bs = bracketsOf(playoffPicture(d.teams, d.series, ratings, { split, version: state.version, choose: (k) => state.fpicks[k], blank: true, asPicked: true }), split);
    const fix = {};
    for (const [, b] of bs) for (const m of b.matches) if (m.key && !m.bye && m.winner !== TBD && m.winner != null && !Object.hasOwn(final.mine.picks, m.key)) fix[m.key] = m.winner;
    document.getElementById("po-confirm")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<dialog class="tier-modal po-confirm" id="po-confirm" style="--tc:var(--accent)" aria-labelledby="po-confirm-h">
      <div class="tm-head"><div class="tm-title"><h3 id="po-confirm-h">Submit your fixes?</h3><small>${Object.keys(fix).length} new ${Object.keys(fix).length === 1 ? "pick" : "picks"} · final once sent</small></div><button type="button" class="tm-close" data-no aria-label="Close">×</button></div>
      <div class="tm-body">
        <p>Are you sure? <b>You can't change them after you submit.</b></p>
        <ul class="po-confirm-champ">${bs.map(([n, b]) => `<li><span>${n ? `${esc(n)} champion` : "Your champion"}</span><b>${esc(name[b.champion] ?? "—")}</b></li>`).join("")}</ul>
        <p class="notice err po-confirm-err" hidden></p>
        <div class="po-confirm-btns"><button type="button" data-no>Go back</button><button type="button" class="primary" data-yes>Yes, submit them</button></div>
      </div></dialog>`);
    const dlg = document.getElementById("po-confirm");
    dlg.addEventListener("close", () => dlg.remove());
    dlg.querySelectorAll("[data-no]").forEach((b) => (b.onclick = () => dlg.close()));
    dlg.querySelector("[data-yes]").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = "Submitting…";
      try {
        await final.fix(fix);
        Object.assign(final.mine, { fix, picks: withFix(final.mine.picks, fix), open: 0 });
        try { localStorage.removeItem(fixKey); } catch { /* private window */ }
        dlg.close();
        keep(render);
      } catch (err) {
        console.warn(err);
        const m = dlg.querySelector(".po-confirm-err");
        m.hidden = false;
        m.textContent = /permission/i.test(err?.message ?? "") ? "Couldn't submit: your fixes are already in, or fixes have closed." : `Couldn't submit: ${err?.message ?? err}`;
        btn.disabled = false; btn.textContent = "Yes, submit them";
      }
    };
    dlg.showModal();
  }

  const howHtml = `<details class="how explain"><summary>How the tiebreakers work</summary>
      <p>The table counts game wins (a bye counts 1–0). <b>SoS</b> (strength of schedule) is the total wins of every opponent a team has played, counting an opponent twice if met twice. It uses the final table, so a result still to come changes the SoS of everyone who played either team.</p>
      <p>A tie <b>across a dividing line</b> (upper/lower bracket, lower bracket/out${split ? ", Aegis/Heroic" : ""}) is played off in week 8. The tied teams are ranked by SoS and play these formats ("1 SoS" is the tied team with the best SoS):</p>
      <ul class="how-list">
        ${TB_CASES.map(([, text]) => `<li>${text}.</li>`).join("")}
      </ul>
      <p>A case the rules don't list (say, 1 slot for 5+ teams) uses the nearest one and is flagged on the Bracket tab. A tie in SoS goes to head to head, then record against the highest common opponent, then a 1v1 solo mid between one player nominated by each team.</p>
      <p>A tie that only decides <b>seed order</b> isn't played off: SoS, then head to head, then record against the highest common opponent. If it's still level, a 1v1 solo mid decides 1st; any other seed is a coin flip.</p>
      <p><b>On this page.</b> The Bracket tab shows one outcome: the model's winner of each week 8 game, and the stronger team wherever it comes down to a 1v1 mid. The Seeding tab counts every outcome: each week 8 game both ways (evenly, or by the model's odds) and each 1v1 mid and coin flip as 50/50, since the model rates teams, not mid players. With three or more teams level, every order counts equally.</p>
      <p><b>Scores.</b> Each game uses the model's one-game odds, independently. The score shown is the winner's likeliest: always 2–0 in a Bo3, since 2–1 needs the favourite to drop a game, so check the odds below it for a close one. In a Bo5 it's 3–1, or 3–0 if the favourite wins more than 2 games in 3.</p>
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

  const possNow = () => (possCache[`${state.weight}|${state.version}`] ??= possibilities(d.teams, d.series, ratings, { split, weight: state.weight, version: state.version }));
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
    if (!dv) return `<div class="panel empty">${REMOVED.has(team) ? "AD2L removed this team from the league, so it has no seed." : "This team isn't in the table."}</div>`;
    const dist = dv.dist.get(team), N = dv.ids.length;
    const best = dist.reduce((b, p, i) => (p > dist[b] ? i : b), 0);
    const sel = state.sel?.team === team ? state.sel : { team, place: null };
    const cards = [{ label: "Likeliest seed", value: `${ord(best + 1)}`, note: pctFine(dist[best]) }, ...summary(dv).map((c) => ({ label: c.label, value: pctFine(c.of(team)) }))];
    const bars = Array.from({ length: N }, (_, i) => {
      const p = dist[i], on = sel.place === i + 1;
      const inner = `<span class="po-tb-k">${ord(i + 1)}</span><span class="po-tb-bar"><i style="width:${(Math.min(1, p) * 100).toFixed(1)}%"></i></span><span class="po-tb-v">${p < 5e-4 ? "·" : pctFine(p)}</span>`;
      const hue = `style="--ph:${placeHue(i + 1, playoffCut(dv))}"`;
      return p < 5e-4 ? `<div class="po-tbar zero" ${hue}>${inner}</div>` : `<button type="button" class="po-tbar${on ? " on" : ""}" ${hue} data-team="${team}" data-place="${i + 1}">${inner}</button>`;
    }).join("");
    const n = dv.open?.length;
    return `${weightBar()}
      <p class="po-lead">Where this team could finish the group stage (its seed, after week 8 tiebreakers), not where it finishes in the playoffs. ${dv.exact ? (n ? `${n} series left, ${dv.count} ways they can go.` : "Only week 8 tiebreakers are left.") : `Based on ${dv.count} simulated seasons.`} ${state.weight === "equal" ? "Every result counts the same." : "Weighted by the model's odds."} <b>Click a seed</b> to see what it takes.</p>
      <div class="po-tcards">${cards.map((c) => `<div class="po-stat"><span>${esc(c.label)}</span><b>${c.value}${c.note ? ` <i>${c.note}</i>` : ""}</b></div>`).join("")}</div>
      <div class="po-tbars">${bars}</div>
      ${detailHtml(P, dv, sel)}
      <p class="table-note"><button type="button" class="linkish" data-goodds>Every team's seeding on Predict →</button></p>`;
  };

  const weightBar = () => `<div class="pd-toggle po-weightbar" role="group" aria-label="How outcomes count"><span class="pd-lbl">Count</span>
        <button type="button" data-weight="equal" aria-pressed="${state.weight === "equal"}">Every outcome the same</button>
        <button type="button" data-weight="model" aria-pressed="${state.weight === "model"}">By the model's odds</button></div>`;

  const possHtml = () => {
    const P = possNow();
    const n = P.divisions.reduce((a, dv) => a + (dv.open?.length ?? 0), 0);
    const counts = P.divisions.length > 1 ? P.divisions.map((dv) => `${dv.count} in Division ${esc(dv.division)}`).join(", ") : `${P.divisions[0]?.count}`;
    const unposted = P.divisions.some((dv) => dv.unposted), sampled = P.divisions.find((dv) => !dv.exact);
    const weighting = state.weight === "equal" ? "Every result counts the same." : "Results are weighted by the model's odds.";
    const lead = `<p class="po-lead"><b>Seeding</b> is where each team finishes the group stage, after any week 8 tiebreakers. It sets who starts in the upper or lower bracket. It is not where teams finish in the playoffs.</p>
      <p class="po-lead">${P.exact
        ? (n ? `${n} group-stage series are left (${counts}${P.divisions.length > 1 ? "" : " ways they can go"}). ${weighting} Each cell is a team's chance of that seed. <b>Click a cell</b> to see what a team needs for it, or <b>a team ▸</b> for all its seeds.`
          : "The group stage is over. Only week 8 tiebreakers can still change the seeds; each cell is a team's chance of that seed.")
        : `There are too many ways the rest can go to list${unposted ? " while PlayOn hasn't posted every week" : ""}, so this plays out ${sampled?.count} random seasons. ${weighting} Each cell is a team's chance of that seed. Once every week is posted, this lists every way and what each team needs.`}</p>`;

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
        <thead><tr><th scope="col" class="l">Team</th>${Array.from({ length: N }, (_, i) => `<th scope="col"${lines.some((l) => l.after === i + 1) ? ' class="po-line"' : ""} title="Seed ${i + 1}">${i ? i + 1 : "Seed 1"}</th>`).join("")}
          ${cols.map((l) => `<th scope="col" class="po-sum">${esc(l.col)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((id) => `<tr class="${state.sel?.team === id ? "sel" : ""}"><th scope="row" class="l"><button type="button" class="linkish po-team" data-team="${id}" aria-expanded="${state.sel?.team === id && !state.sel.place}" title="Every place ${esc(name[id])} can reach"><span class="po-caret" aria-hidden="true"></span><span class="po-tname">${esc(name[id])}</span></button></th>
          ${Array.from({ length: N }, (_, i) => cell(id, i)).join("")}
          ${cols.map((l) => `<td class="po-sum num">${pctFine(sum(id, l.after) - (l.band ? sum(id, lines[lines.indexOf(l) - 1]?.after ?? 0) : 0))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      const pick = state.sel && dv.ids.includes(state.sel.team) ? detailHtml(P, dv, state.sel) : "";
      return `${dv.division ? `<h3 class="po-div">Division ${esc(dv.division)}</h3>` : ""}${table}${pick}${eventsHtml(dv)}`;
    };

    return `${weightBar()}${lead}${P.divisions.map(divHtml).join("")}
      <p class="table-note">Ties on wins: across a dividing line, a week 8 tiebreaker (counted both ways); for seed order, SoS, head to head, record against the highest common opponent, then a 1v1 mid for 1st or a coin flip for other seeds (both counted 50/50).</p>
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
      `Teams tied on wins across the upper/lower bracket or playoff line play off in week 8. These ties can still happen.`,
      "No result left can leave a tie across a dividing line.",
      `<th scope="col" class="l">Line</th><th scope="col" class="l">Teams level</th><th scope="col">Wins</th><th scope="col">Seeds</th><th scope="col" class="l">Format</th>`,
      (e) => `<td class="l">${lineName(e.line)}</td><td class="l name">${teams(e)}</td><td class="num">${e.wins}</td><td class="num">${e.places[0]}–${e.places[1]}</td><td class="l name">${esc(tbCase(e.slots, e.teams.length))}</td>`);
    const mid = section("mid", "Possible 1v1 mids",
      "A 1v1 solo mid only decides 1st place or a side of a dividing line (upper/lower bracket, in or out of the playoffs). Teams play one when they're level on wins, SoS, head to head and record against the highest common opponent. Counted here as 50/50.",
      "No result left can bring two teams level all the way to a 1v1.",
      `<th scope="col" class="l">Teams</th><th scope="col">Wins</th><th scope="col" class="l">Still level on</th><th scope="col" class="l">Decides</th>`,
      (e) => `<td class="l name">${teams(e)}</td><td class="num">${e.wins}</td><td class="l name po-why">${whyLevel(e)}</td><td class="l name">${e.purpose === "seed"
        ? "Who's seed 1"
        : `Their order in the ${lineName(e.line)} tiebreaker for seeds ${e.places[0]}–${e.places[1]}`}</td>`);
    return `<div class="po-events">${tb}${mid}<p class="table-note">A 1v1 needs the teams level at every step: wins, SoS, head to head and record against the highest common opponent. "Still level on" is the likeliest way there; the numbers can differ in other ways.</p>${dv.exact ? "" : `<p class="table-note">These chances are simulated. What leads to each shows once every outcome can be listed.</p>`}</div>`;
  };
  // Each tiebreaker step a 1v1's teams came out level on.
  const whyLevel = (e) => {
    const w = e.why;
    if (!w) return "";
    const g = ([a, b]) => `${a}–${b}`;
    const many = e.teams.length > 2;
    const h2h = many ? "head to head" : w.h2h ? `head to head (${g(w.h2h)})` : "head to head (never played)";
    const opps = w.hco.map((o) => esc(name[o.opp])).join(" and ");
    const hco = !w.hco.length ? "no common opponent"
      : many ? `record v ${opps}`
      : w.hco.every((o) => o.a[0] === o.b[0] && o.a[1] === o.b[1]) ? `both ${w.hco.map((o) => g(o.a)).join(", ")} v ${opps} (${w.hco[0].wins} wins)`
      : `the same record v ${opps} (${w.hco[0].wins} wins)`;
    return `<ul class="po-why-list"><li>SoS ${w.sos} each</li><li>${h2h}</li><li>${hco}</li></ul>`;
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
      <p class="table-note">Any one way leads here, and each way needs every result in it. Unlisted series can go any way.</p></div>`;
  };

  const detailHtml = (P, dv, sel) => {
    const id = sel.team, dist = dv.dist.get(id);
    const places = sel.place ? [sel.place] : dist.map((p, i) => [p, i + 1]).filter(([p]) => p >= 5e-4).map(([, k]) => k);
    // On the team page the name is the page itself: the row only shows once a place is picked.
    const head = view === "team" && !sel.place ? "" : `<div class="po-need-h"><b>${esc(name[id])}</b>${sel.place ? ` as seed ${sel.place}: ${pctFine(dist[sel.place - 1])}` : ""}
      ${sel.place ? `<button type="button" class="linkish" data-team="${id}">Show every seed</button>` : ""}
      ${view === "team" ? "" : `<button type="button" class="linkish" data-close>Close</button>`}</div>`;
    if (!dv.exact) return `<div class="po-need">${head}<p class="muted">Too many outcomes to list what it takes ${dv.unposted ? "while weeks are unposted" : "with more than 9 series left"}. The chances above are simulated.</p></div>`;
    const MAX = 8;
    const own = (i) => dv.open[i].home === id || dv.open[i].away === id;
    const block = (place) => {
      const paths = pathsTo(dv, id, place, dv.total);
      const hue = `style="--ph:${placeHue(place, playoffCut(dv))}"`;
      // Each place collapsible, closed to start unless it's the one picked.
      const open = sel.place === place ? " open" : "";
      if (!paths.length) return `<details class="po-need-p" ${hue}${open}><summary><h5>Seed ${place} · 0%</h5></summary><p class="muted">Can't happen.</p></details>`;
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
      return `<details class="po-need-p" ${hue}${open}><summary><h5>Seed ${place} · ${pctFine(dist[place - 1])} · ${paths.length} way${paths.length === 1 ? "" : "s"}</h5></summary>
        <div class="po-ways-grid">${paths.slice(0, MAX).map(way).join("")}</div>
        ${paths.length > MAX ? `<p class="muted">…and ${paths.length - MAX} more ways, ${pctFine(paths.slice(MAX).reduce((a, c) => a + c.p, 0))} between them.</p>` : ""}
      </details>`;
    };
    return `<div class="po-need">${head}${places.map(block).join("")}
      <p class="table-note">Any one way gets them there, and each way needs every result in it. "Or" means either result works. <span class="po-key">Gold</span> is ${esc(name[id])}'s own series. Unlisted series can go any way. The share beside each way is how much of ${state.weight === "equal" ? "all outcomes" : "the model's odds"} it covers.</p></div>`;
  };

  // ---------- wiring ----------

  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.dataset.k && ready && !watch) {
      const ph = phase();
      if (ph !== "open" && ph !== "fix") return;
      const k = t.dataset.k, w = Number(t.dataset.w);
      if (k === "pick" && ph === "fix") return;
      if (sentKey(k)) return; // a sent pick can't change
      if (state.fpicks[k] === w) delete state.fpicks[k]; else state.fpicks[k] = w;
      if (ph === "fix") save(fixKey, Object.fromEntries(Object.entries(state.fpicks).filter(([x]) => !Object.hasOwn(final.mine.picks, x))));
      else save(finalKey, state.fpicks);
      return keep(render);
    }
    if (t.hasAttribute("data-submit")) return confirmSubmit();
    if (t.hasAttribute("data-fixsubmit")) return confirmFix();
    if (t.hasAttribute("data-freset")) { state.fpicks = {}; save(finalKey, state.fpicks); return keep(render); }
    if (t.dataset.k) {
      if (locked || watch) return;
      const k = t.dataset.k, w = Number(t.dataset.w);
      // Clicking your own pick again hands the match back to the model.
      if (state.picks[k] === w) delete state.picks[k]; else state.picks[k] = w;
      save(pickKey, state.picks);
      shareNow();
      return keep(render);
    }
    if (t.hasAttribute("data-tocards")) { document.querySelector('.pp-tabs [data-tab="calls"]')?.click(); return; }
    if (t.hasAttribute("data-reset")) { if (locked) return; state.picks = {}; save(pickKey, state.picks); shareNow(); return keep(render); }
    if (t.dataset.weight) { state.weight = t.dataset.weight; return keep(render); }
    if (t.dataset.br) { state.br = t.dataset.br; save(BR_KEY, state.br); return keep(render); }
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
  // Once the seeds are settled the old bracket (group-stage picks) stays as it was saved.
  if (view === "bracket" && !watch && !ready && unsynced()) shareNow();
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
  ?? `${slots} slot${slots === 1 ? "" : "s"}, ${n} teams: not in the rules, nearest case used`;

// A share with a decimal under 1% so a long shot doesn't read as 0%.
// Each final place's colour, best first: gold, green, teal, sky, blue, indigo, violet, magenta
// through the playoff places, then red for every place that misses them. CSS turns --ph (a
// hue) into a colour that reads in both themes.
const PLACE_HUES = [45, 140, 172, 198, 222, 250, 275, 305];
const placeHue = (place, cut) => (place > cut ? 0 : PLACE_HUES[Math.min(place - 1, PLACE_HUES.length - 1)]);
// The last place that makes the playoffs (everyone, in a division too small to cut).
const playoffCut = (dv) => dv.lines.find((l) => l.below === "out" && l.after < dv.ids.length)?.after ?? dv.ids.length;
const pctFine = (p) => (p >= 1 - 5e-4 ? "100%" : p > 0.99 ? ">99%" : p >= 0.01 ? `${Math.round(p * 100)}%` : p > 0 ? `${(p * 100).toFixed(1)}%` : "0%");
