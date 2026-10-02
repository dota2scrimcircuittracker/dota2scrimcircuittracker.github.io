// Predict's second part: the playoff picture if every remaining call goes the model's way —
// the rest of the group stage, the final table, week 8 tiebreakers and the bracket
// (lib/playoffs.js does the working out).
import { playoffPicture, REG_WEEKS } from "../lib/playoffs.js";
import { info } from "../lib/glossary.js";
import { esc, pct, teamLink, DIVISIONS } from "../core.js";

const RULES = "https://dota.playon.gg/rules";
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const to = (where) => (where === "out" ? "out" : `to the ${where}`);
const bo = (n) => (n ? `Bo${n}` : "best-of not set in the rules");

export function playoffsHtml(src, d, ratings) {
  const split = !!DIVISIONS[src.key]?.views;
  const p = playoffPicture(d.teams, d.series, ratings, { split });
  const name = Object.fromEntries(d.teams.map((t) => [t.id, t.name]));
  const link = (id) => (id == null ? '<span class="muted">bye</span>' : teamLink(src, name[id], id));
  const score = (s, id) => (s.home === id ? s.home_score : s.away_score);

  // The rest of the group stage: unreported series PlayOn has posted, then weeks it hasn't.
  const left = p.series.filter((s) => s.projected);
  const paired = left.filter((s) => s.paired);
  const call = (s) => {
    const [w, l] = s.home_score >= s.away_score ? [s.home, s.away] : [s.away, s.home];
    const tie = s.home_score === s.away_score;
    return `<li><span class="po-res${tie ? " t" : ""}">${score(s, w)}–${score(s, l)}</span> ${link(w)} <span class="muted">${tie ? "split with" : "over"}</span> ${link(l)}</li>`;
  };
  const restHtml = left.length ? `<div class="po-rest">
      ${left.some((s) => !s.paired) ? `<div><h4>Posted, not reported yet</h4><ul>${left.filter((s) => !s.paired).map(call).join("")}</ul></div>` : ""}
      ${[...new Set(paired.map((s) => s.week))].map((wk) => `<div><h4>Week ${wk} · <span class="po-guess">pairings guessed</span></h4><ul>${paired.filter((s) => s.week === wk).map(call).join("")}</ul></div>`).join("")}
    </div>
    ${paired.length ? `<p class="table-note">PlayOn posts each week's pairings a few days ahead and hasn't posted week ${Math.min(...paired.map((s) => s.week))} yet. These stand in for them: in table order, each team plays the nearest team it hasn't met (AD2L pairs "pseudo-swiss" but doesn't publish how). Once the real pairings sync, this uses them.</p>` : ""}`
    : `<p class="table-note">Every group-stage series is in.</p>`;

  const divHtml = (dv) => {
    const lineAt = new Map(dv.lines.map((l) => [l.after, l]));
    // Where a place ends up: above the first line, between two lines, or below the last.
    const status = (place) => {
      const i = dv.lines.findIndex((x) => place <= x.after);
      return i === 0 ? dv.lines[0].above : i > 0 ? dv.lines[i - 1].below : dv.lines.at(-1)?.below ?? "upper bracket";
    };
    const gain = (r) => r.wins - (d.series.filter((s) => s.home_score != null && (s.home === r.id || s.away === r.id)).reduce((a, s) => a + score(s, r.id), 0));
    const table = `<div class="table-wrap"><table class="po-table">
      <thead><tr><th scope="col">#</th><th scope="col" class="l">Team</th><th scope="col">Wins</th><th scope="col">SoS${info("sos")}</th><th scope="col" class="l">Goes to</th></tr></thead>
      <tbody>${dv.rows.map((r) => `<tr class="${lineAt.has(r.place) ? "po-cut" : ""} po-${status(r.place).replace(/\W+/g, "-").toLowerCase()}">
        <td class="num">${r.place}</td><td class="l">${link(r.id)}</td>
        <td class="num">${r.wins}${gain(r) ? ` <span class="muted">+${gain(r)}</span>` : ""}</td><td class="num">${r.sos}</td>
        <td class="l po-to">${esc(status(r.place))}</td></tr>`).join("")}</tbody></table></div>`;

    const tbs = dv.tiebreakers.map((tb) => {
      const [a, b] = tb.places;
      const m = (x) => `<li><span class="po-bo">${bo(x.bestOf)}</span> ${link(x.a)} <span class="muted">v</span> ${link(x.b)}${x.note ? ` <span class="muted">(${esc(x.note)})</span>` : ""}
        → <b>${esc(name[x.winner])}</b> <span class="muted">${pct(x.p)}</span></li>`;
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
    const settledHtml = seedTies.length ? `<p class="po-settled"><b>Ties decided without playing</b> (seed order: SoS, head to head, highest common opponent, coin flip):
      ${seedTies.map((x) => `${ord(x.place)}: ${esc(name[x.above])} ahead of ${esc(name[x.below])} on ${esc(x.detail)}`).join(" · ")}.</p>` : "";

    return `${dv.division ? `<h3 class="po-div">Division ${esc(dv.division)}</h3>` : ""}
      ${table}
      <h4 class="po-h">Week 8 tiebreakers</h4>
      ${tbs || `<p class="po-none">None: no tie sits across a dividing line${dv.lines.length ? ` (${dv.lines.map((l) => `${ord(l.after)}/${ord(l.after + 1)}`).join(" and ")})` : ""}, so week 8 has no games.</p>`}
      ${settledHtml}
      ${dv.bracket ? bracketHtml(dv) : ""}`;
  };

  const bracketHtml = (dv) => {
    const seedOf = new Map(dv.rows.slice(0, 8).map((r) => [r.id, r.place]));
    const b = dv.bracket;
    const slot = (m, id) => id == null ? `<div class="po-slot bye"><span class="po-seed"></span><span>bye</span></div>`
      : `<div class="po-slot${m.winner === id && !m.bye ? " win" : ""}"><span class="po-seed">${seedOf.get(id) ?? ""}</span>${link(id)}</div>`;
    const box = (m) => `<div class="po-m${m.side === "final" ? " gf" : ""}${m.bye ? " is-bye" : ""}">
        <div class="po-mh">${esc(m.label)}${m.side === "final" ? " · Bo3 or Bo5" : ""}</div>
        ${slot(m, m.a)}${slot(m, m.b)}
        ${m.bye ? "" : `<div class="po-mp">${esc(name[m.winner])} ${pct(m.p)}${m.side === "final" ? " (as Bo5)" : ""}</div>`}
      </div>`;
    const weeks = Math.max(...b.matches.map((m) => m.week));
    const col = (side, w) => b.matches.filter((m) => m.side === side && m.week === w).map(box).join("");
    const gf = b.matches.find((m) => m.side === "final");
    return `<h4 class="po-h">Bracket</h4>
      <p class="table-note">Seed 1 picks seed 3 or 4 to play first; the model has it take the weaker one (${b.pick === 3 ? "seed 3" : "seed 4"} here).
        ${dv.rows.length < 8 ? `${dv.rows.length} teams, so everyone's in: ${dv.rows.length <= 4 ? "all start in the upper bracket" : "seeds 5–6 start in the lower bracket"}. The rules only describe 8-team brackets, so this layout is the site's assumption.` : "Lower round 1 is 5 v 8 and 6 v 7; the loser of seed 1's match meets the 6 v 7 winner, as S47's brackets ran."}</p>
      <div class="po-br-wrap"><div class="po-br" style="--weeks:${weeks}">
        ${Array.from({ length: weeks }, (_, i) => `<div class="po-wk" style="grid-column:${i + 2}">Playoff week ${i + 1}</div>`).join("")}
        <div class="po-lbl up">Upper</div><div class="po-lbl low">Lower</div>
        ${Array.from({ length: weeks - 1 }, (_, i) => `<div class="po-col up" style="grid-column:${i + 2}">${col("upper", i + 1)}</div><div class="po-col low" style="grid-column:${i + 2}">${col("lower", i + 1)}</div>`).join("")}
        <div class="po-col gf" style="grid-column:${weeks + 1}">${box(gf)}<div class="po-champ"><span>Champion</span>${link(b.champion)}</div></div>
      </div></div>`;
  };

  const heroicNote = split ? `<p class="po-heroic">Top 4 of each division go to the <b>Aegis</b> playoffs and 5th–8th to the <b>Heroic</b> playoffs, each an 8-team double-elimination bracket.
      AD2L hasn't said how Division A and B teams are seeded against each other, so there's no bracket here until it does.</p>` : "";

  return `<p class="po-lead">What the playoffs look like if every call goes the model's way: the rest of the ${REG_WEEKS}-week group stage, the final table, the week 8 tiebreakers and the bracket, all by
      <a href="${RULES}" target="_blank" rel="noopener">AD2L's rules</a>. Every result is the model's pick (2–0 to the favourite, 1–1 for a coin flip; in Bo3s and the bracket the stronger team wins) with its chance alongside.</p>
    <h3 class="po-sub">Rest of the group stage</h3>
    ${restHtml}
    <h3 class="po-sub">Final table and tiebreakers</h3>
    ${heroicNote}
    ${p.divisions.map(divHtml).join("")}
    <details class="how"><summary>How the tiebreakers work</summary>
      <p>The table counts game wins (a bye is 1–0). <b>SoS</b> (strength of schedule) is the total wins of every opponent a team has played; a team met twice counts twice.</p>
      <p>A tie <b>across a dividing line</b> (upper/lower bracket, playoffs/out${split ? ", Aegis/Heroic" : ""}) is played off in week 8. The tied teams are ranked by SoS (then head to head, record against the highest common opponent, and a 1v1 mid), and the rules' table sets the games: 1 place for 2 teams is a Bo3; 1 place for 3 is 2nd v 3rd then the winner v 1st (Bo1s); 1 place for 4 is 1v4 and 2v3, winners meet; 2 places for 3 puts the best SoS through and 2nd v 3rd plays a Bo3; 2 places for 4 or more is 1v4 and 2v3 (Bo3s), 5th and below out; with more places the best SoS teams go through until it's one of those.</p>
      <p>A tie that only decides <b>seed order</b> isn't played: SoS, then head to head, then record against the highest common opponent, then a coin flip. Where it comes down to a 1v1 or a coin flip, the page shows the model's stronger team.</p>
    </details>`;
}
