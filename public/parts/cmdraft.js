// The draft model on the page (lib/cmdraft.js, Project Sybil's model): loading each division's
// draft file, reading a game's ten players, and the game page's Draft tab.
import { DIVISIONS, esc, pct, portrait, playerLink, divLite } from "../core.js";
import { gameContext, readDraft, buildDraft, draftProbability, scoreHeroes, openRoleFor, CM_STEPS, FIT } from "../lib/cmdraft.js";
import { heroImg } from "../lib/hero-meta.js";

// <division>-draft.json: hero names and baselines, and every rostered player's games
// (scripts/sync/ad2l-sync.js). null when the division hasn't been synced with it yet.
const cache = {};
export const draftData = (key) => (cache[key] ??= fetch(DIVISIONS[key].file.replace(/\.json$/, "-draft.json"), { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null));

// Several divisions' files as one: histories merged, heroes and baselines from the first.
export async function draftDataFor(keys) {
  const all = (await Promise.all([...new Set(keys)].filter((k) => DIVISIONS[k]).map(draftData))).filter(Boolean);
  if (!all.length) return null;
  return { ...all[0], history: Object.assign({}, ...all.map((d) => d.history)), totals: Object.assign({}, ...all.map((d) => d.totals ?? {})) };
}

// Hero name <-> id from the draft file, and every hero id, A–Z.
export function heroIndex(data) {
  const byName = new Map(Object.entries(data.heroes).map(([id, name]) => [name, Number(id)]));
  const ids = [...byName.values()].sort((a, b) => data.heroes[a].localeCompare(data.heroes[b]));
  return { byName, ids, name: (id) => data.heroes[id] ?? `hero ${id}` };
}

// Side "a" is Radiant (OpenDota team 0). A game's players by side, in the game's order.
export const SIDE = { a: "radiant", b: "dire" };
const sideList = (m, t) => m.players.filter((p) => p.team === t).map((p) => ({ key: p.player_key, rank_tier: p.rank_tier, name: p.name, p }));

export const gameHasModel = (m) => m.draft?.some((s) => s.pick) && m.players?.length === 10;

// A game read by the model as of its own start: only games before it count.
export function readGame(m, data, { alternatives = 3 } = {}) {
  const heroes = heroIndex(data);
  const ctx = gameContext(data, { radiant: sideList(m, "a"), dire: sideList(m, "b") }, m.start_time);
  const steps = [...m.draft].sort((x, y) => x.order - y.order).map((s) => ({ side: SIDE[s.side], pick: s.pick, hero: heroes.byName.get(s.hero), name: s.hero }))
    .filter((s) => s.hero != null);
  return { ctx, heroes, read: readDraft(ctx, steps, heroes.ids, { alternatives }) };
}

const pts = (x) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}`;
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
export const MODEL_NOTE = `Draft model: Sybil's Captains Mode model (by ybabts and Fav), trained on ${FIT.games.toLocaleString()} AD2L games, ${FIT.seasons}. On held-out patch ${FIT.heldOut.split.split(" ")[0]} games its favourite won ${Math.round(FIT.heldOut.accuracy * 100)}%. Each pick is rated for the player most likely to play it: their record on the hero (shrunk toward its win rate at this rank), their usual heroes, and the rank gap. It doesn't account for counters, synergy or this season's results yet.`;

// The game page's Draft tab: the win chance after every step, and what the model would have
// done at each one.
export function gameDraftHtml(m, src, data, width = null) {
  const { ctx, heroes, read } = readGame(m, data);
  const A = (p) => p; // Radiant = team A
  const values = [read.start, ...read.steps.map((s) => s.p)];
  const chart = draftChart({ values, nameX: m.team_a, nameY: m.team_b, width: width ?? 1000,
    steps: read.steps.map((s) => ({ who: s.side === "radiant" ? "X" : "Y", pick: s.pick, hero: s.name })) });

  const teamOf = (side) => (side === "radiant" ? m.team_a : m.team_b);
  const cls = (side) => (side === "radiant" ? "s-a" : "s-b");
  const rows = read.steps.map((s, i) => {
    const before = i ? read.steps[i - 1].p : read.start;
    const mine = (p) => (s.side === "radiant" ? p : 1 - p);
    const change = mine(s.p) - mine(before);
    const v = s.view, key = s.pick ? "pick" : "ban";
    const val = (x) => (s.pick ? pct(x.pick) : `${pts(x.ban)}`);
    const best = v?.best.map((x) => `<span class="cm-alt${x.hero === s.hero ? " is-chosen" : ""}" title="${esc(heroes.name(x.hero))}: ${s.pick ? `${pct(x.pick)} to win` : `${pts(x.ban)} pts denied`}">${portrait(heroes.name(x.hero))}<small>${val(x)}</small></span>`).join("") ?? "";
    return `<tr class="${s.pick ? "cm-pick" : "cm-ban"}">
      <td>${i + 1}</td>
      <td class="l"><span class="cm-side ${cls(s.side)}">${esc(teamOf(s.side))}</span></td>
      <td class="l">${s.pick ? "Pick" : "Ban"}</td>
      <td class="l cm-hero">${portrait(s.name)} ${esc(s.name)}</td>
      <td>${v?.rank ? `<span class="${v.rank <= 3 ? "cm-good" : v.rank > 20 ? "cm-off" : ""}" title="The model's ${key} value for it ranked ${ord(v.rank)} of the ${v.of} heroes left">${ord(v.rank)}</span>` : "—"}</td>
      <td>${v?.chosen ? val(v.chosen) : "—"}</td>
      <td class="l cm-alts">${best}</td>
      <td>${pct(mine(s.p))}</td>
      <td class="${!s.pick || Math.abs(change) < 0.005 ? "" : change > 0 ? "cm-up" : "cm-down"}">${s.pick ? pts(change) : "—"}</td>
    </tr>`;
  }).join("");

  // Who the model thought would play each hero, against who did.
  const picks = { radiant: read.steps.filter((s) => s.pick && s.side === "radiant"), dire: read.steps.filter((s) => s.pick && s.side === "dire") };
  let right = 0, total = 0;
  const whoRows = ["radiant", "dire"].flatMap((side) => picks[side].map((s, k) => {
    const players = ctx.info[side];
    const col = read.assignment[side].map((row) => row[k]);
    const j = col.indexOf(Math.max(...col));
    const guess = players[j], actual = players.find((p) => p.p.hero === s.name);
    const hit = actual && guess === actual;
    if (actual) { total++; if (hit) right++; }
    return `<tr><td class="l"><span class="cm-side ${cls(side)}">${esc(teamOf(side))}</span></td><td class="l cm-hero">${portrait(s.name)} ${esc(s.name)}</td>
      <td class="l">${playerLink(src, guess.p)} <small class="muted">${pct(col[j])}</small></td><td class="l">${actual ? playerLink(src, actual.p) : "—"}</td><td>${actual ? (hit ? "✓" : "✗") : ""}</td></tr>`;
  })).join("");

  const readRows = ["radiant", "dire"].flatMap((side) => ctx.info[side].map((p) => `<tr><td class="l"><span class="cm-side ${cls(side)}">${esc(teamOf(side))}</span></td>
    <td class="l">${playerLink(src, p.p)}</td><td>${p.games ? p.games.toLocaleString() : '<span class="muted">none</span>'}</td>
    <td>${p.rank == null ? "—" : rankName(p.rank)}${p.rankFrom === "medal" ? ' <small class="muted">medal</small>' : ""}</td></tr>`)).join("");
  const unknown = [...ctx.info.radiant, ...ctx.info.dire].filter((p) => !p.games).length;

  const end = read.steps.at(-1)?.p ?? read.start, fav = end >= 0.5 ? m.team_a : m.team_b, won = m.winner === (end >= 0.5 ? "a" : "b");
  return `<div class="cm-tab">
    <div class="td-head"><span class="gp-label">${esc(m.winner === "a" ? m.team_a : m.team_b)} won</span>
      <span class="td-call ${won ? "right" : "wrong"}">${won ? `✓ the model called it: ${esc(fav)} ${pct(Math.max(end, 1 - end))} after the draft` : `✗ upset: the model had ${esc(fav)} ${pct(Math.max(end, 1 - end))} after the draft`}</span></div>
    ${oddsBars(m.team_a, m.team_b, read.start, end)}
    ${chart}
    <h3 class="gm-h3">Step by step</h3>
    <p class="table-note cm-legend">Rank: where the model placed the actual choice among the heroes left (picks by win chance, bans by how much the hero would have given the other team). Model's top 3: its best options at that step.</p>
    <div class="table-wrap"><table class="cm-steps">
      <thead><tr><th>#</th><th class="l">Team</th><th class="l"></th><th class="l">Hero</th><th>Rank</th><th>Value</th><th class="l">Model's top 3</th><th>Win after</th><th>Change</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <h3 class="gm-h3">Who plays what</h3>
    <p class="table-note">The model doesn't know who played which hero; it guesses from each player's heroes and positions. It got ${right} of ${total} right here.</p>
    <div class="table-wrap"><table><thead><tr><th class="l">Team</th><th class="l">Hero</th><th class="l">Model's guess</th><th class="l">Played by</th><th></th></tr></thead><tbody>${whoRows}</tbody></table></div>
    <h3 class="gm-h3">Players as read</h3>
    <p class="table-note">Pub and league games in the ${data.history_days} days before this game. Rank is from recent pub lobbies, or PlayOn medal if there are none.${unknown ? ` ${unknown} player${unknown === 1 ? " has" : "s have"} no history (a stand-in or private profile) and count${unknown === 1 ? "s" : ""} as an average player at this rank.` : ""}</p>
    <div class="table-wrap"><table><thead><tr><th class="l">Team</th><th class="l">Player</th><th>Games</th><th>Rank</th></tr></thead><tbody>${readRows}</tbody></table></div>
    <p class="table-note">${esc(MODEL_NOTE)}</p>
  </div>`;
}

const MEDALS = ["Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal"];
// A rank value (1–36, lib/cmdraft.js rankValue) as a medal; medians can fall between stars.
export const rankName = (v) => (v >= 36 ? "Immortal" : `${MEDALS[Math.floor((Math.round(v) - 1) / 5)]} ${((Math.round(v) - 1) % 5) + 1}`);

// ---------- the draft chart ----------

// Team X's chance to win before the draft and after every step, drawn as steps (the number
// holds, then moves at a step) on a fixed 15–85% axis around 50%: X's half tinted in its colour,
// Y's in its. Each filled step is its hero on the line, outlined in its team's colour (a ban
// smaller, greyed, struck through); a pick's change sits in a pill, above for X and below for Y,
// green when it helped that team. `values` has one more entry than `steps` (the start); `order`
// gives every slot ({ who, pick }) so open steps draw as empty columns; `current` marks the step
// in play; with `rewind`, filled columns carry data-rewind (the Drafter rewinds on a click).
const LO = 0.15, HI = 0.85;
export function draftChart({ values, steps, order = steps, nameX, nameY, current = null, rewind = false, width = 1000, height = 236, cells = true }) {
  // Drawn at the container's own pixel width and a fixed height, so text and icons keep their
  // size on any screen instead of the whole chart scaling up with the page.
  const W = Math.max(320, Math.round(width)), H = height, L = 44, R = 8, T = 22, B = cells ? 46 : 8;
  const cols = order.length + 1, cw = (W - L - R) / cols;
  const x = (i) => L + (i + 0.5) * cw;
  const y = (p) => T + (1 - (Math.min(HI, Math.max(LO, p)) - LO) / (HI - LO)) * (H - T - B);
  const mid = y(0.5);
  const icon = Math.min(43, cw - 4), ih = icon * 9 / 16;
  let svg = `<rect class="dc-x" x="${L}" y="${T}" width="${W - L - R}" height="${mid - T}"/><rect class="dc-y" x="${L}" y="${mid}" width="${W - L - R}" height="${H - B - mid}"/>`;
  order.forEach((o, i) => {
    const c = i + 1;
    if (!o.pick) svg += `<rect class="dc-ban-col" x="${L + c * cw}" y="${T}" width="${cw}" height="${H - T - B}"/>`;
    if (c - 1 === current) svg += `<rect class="dc-now" x="${L + c * cw + 1}" y="${T}" width="${cw - 2}" height="${H - T - B}"/><text class="dc-next" x="${x(c)}" y="${T - 6}" text-anchor="middle">NEXT</text>`;
  });
  svg += `<line class="dc-mid" x1="${L}" x2="${W - R}" y1="${mid}" y2="${mid}"/>`;
  for (const p of [LO, 0.5, HI]) svg += `<text class="dc-tick" x="${L - 6}" y="${y(p) + 4}" text-anchor="end">${Math.round(p * 100)}%</text>`;
  svg += `<text class="dc-name dc-name-x" x="${L + 6}" y="${T + 14}">${esc(nameX)} ahead</text><text class="dc-name dc-name-y" x="${L + 6}" y="${H - B - 6}">${esc(nameY)} ahead</text>`;
  // The line: flat through each column, then a vertical move into the next step's icon.
  let d = `M${L} ${y(values[0])} H${x(0)}`;
  for (let i = 1; i < values.length; i++) d += ` H${x(i)} V${y(values[i])}`;
  svg += `<path class="dc-line" d="${d}"/><circle class="dc-dot" cx="${x(0)}" cy="${y(values[0])}" r="3"/>`;
  steps.forEach((s, i) => {
    const c = i + 1, cx = x(c), cy = y(values[c]), side = s.who === "X" ? "dc-sx" : "dc-sy";
    const w = s.pick ? icon : icon * 0.75, h = w * 9 / 16, src = heroImg(s.hero);
    svg += `<g class="dc-step ${s.pick ? "pick" : "ban"} ${side}"><title>${i + 1}. ${esc(s.who === "X" ? nameX : nameY)} ${s.pick ? "pick" : "ban"}: ${esc(s.hero)} · ${esc(nameX)} ${pct(values[c])}</title>
      <rect class="dc-frame" x="${cx - w / 2 - 1.5}" y="${cy - h / 2 - 1.5}" width="${w + 3}" height="${h + 3}"/>
      ${src ? `<image href="${src}" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` : ""}
      ${s.pick ? "" : `<line class="dc-slash" x1="${cx - w / 2}" y1="${cy + h / 2}" x2="${cx + w / 2}" y2="${cy - h / 2}"/>`}</g>`;
    const move = (values[c] - values[c - 1]) * (s.who === "X" ? 1 : -1);
    if (s.pick && Math.abs(move) >= 0.0005 && cw >= 26) {
      const text = `${move >= 0 ? "+" : "−"}${Math.abs(move * 100).toFixed(1)}`, pw = text.length * 8.4 + 10, ph = 19;
      const py = s.who === "X" ? cy - ih / 2 - 6 - ph : cy + ih / 2 + 6;
      svg += `<g class="dc-pill ${move >= 0 ? "good" : "bad"}"><rect x="${cx - pw / 2}" y="${py}" width="${pw}" height="${ph}" rx="9.5"/><text x="${cx}" y="${py + 14}" text-anchor="middle">${text}</text></g>`;
    }
  });
  // The whole draft order along the bottom, done and to come: each step's number and PICK or
  // BAN in a cell edged in its team's colour; the step in play filled in. Filled columns rewind
  // on a click. `cells: false` leaves the cells out (the Drafter has its own board).
  const narrow = cw < 36;
  order.forEach((o, i) => {
    if (rewind && i < steps.length) svg += `<rect class="dc-hit" data-rewind="${i}" x="${L + (i + 1) * cw}" y="${T}" width="${cw}" height="${H - T}"><title>Rewind to step ${i + 1}</title></rect>`;
    if (!cells) return;
    const c = i + 1, cy = H - B + 6, ch = B - 10;
    const state = i < steps.length ? "done" : i === current ? "now" : "todo";
    svg += `<g class="dc-cell ${o.who === "X" ? "dc-sx" : "dc-sy"} ${o.pick ? "pick" : "ban"} ${state}"><title>${c}. ${esc(o.who === "X" ? nameX : nameY)} ${o.pick ? "pick" : "ban"}</title>
      <rect x="${L + c * cw + 2}" y="${cy}" width="${cw - 4}" height="${ch}"/>
      <text class="dc-cn" x="${x(c)}" y="${cy + 13}" text-anchor="middle">${c}</text>
      <text class="dc-ck" x="${x(c)}" y="${cy + ch - 6}" text-anchor="middle">${o.pick ? (narrow ? "P" : "PICK") : (narrow ? "B" : "BAN")}</text></g>`;
  });
  return `<figure class="dchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(nameX)}'s chance to win through the draft: ${pct(values[0])} before it, ${pct(values[values.length - 1])} now">${svg}</svg></figure>`;
}

// ---------- a team's drafts ----------

// The team page's Draft tab: every drafted series, newest first, each game's draft drawn from
// this team's side (their chance above the line), and how far the draft moved it. `series` are
// { label, games: [{ m, side }] } where side is the team's "a" or "b".
export function teamDraftsHtml(team, series, src, data, width = 1000) {
  const tally = { n: 0, preRight: 0, postRight: 0, up: 0, swing: 0 };
  const blocks = series.map(({ label, games }) => {
    const gamesHtml = games.map(({ m, side }, j) => {
      const { read } = readGame(m, data, { alternatives: 0 });
      const ours = (p) => (side === "a" ? p : 1 - p);
      const values = [read.start, ...read.steps.map((st) => st.p)].map(ours);
      const opp = side === "a" ? m.team_b : m.team_a, won = m.winner === side;
      const pre = values[0], post = values.at(-1), swing = post - pre;
      tally.n++; tally.swing += swing; if (swing > 0) tally.up++;
      if ((pre >= 0.5) === won) tally.preRight++;
      if ((post >= 0.5) === won) tally.postRight++;
      const chart = draftChart({ values, nameX: team.name, nameY: opp, width,
        steps: read.steps.map((st) => ({ who: (st.side === "radiant") === (side === "a") ? "X" : "Y", pick: st.pick, hero: st.name })) });
      return `<div class="td-game ${won ? "won" : "lost"}">
        <div class="td-head"><span class="gp-label">Game ${j + 1}</span>
          ${resultChip(won, post)}
          <a href="${src.link(m)}?tab=draft">Step by step →</a></div>
        ${oddsBars(team.name, opp, pre, post)}
        ${chart}</div>`;
    }).join("");
    return `<section class="td-series"><h3 class="td-shead">${label}</h3>${gamesHtml}</section>`;
  }).join("");
  if (!tally.n) return `<p class="muted">No drafted games yet.</p>`;
  const t = tally;
  return `<div class="td-summary">
      ${statTile("Model before the draft", `${t.preRight} of ${t.n}`, "games where its favourite won")}
      ${statTile("Model after the draft", `${t.postRight} of ${t.n}`, "games where its favourite won")}
      ${statTile(`${esc(team.name)}'s drafts`, pts(t.swing / t.n), `points a draft, on average · up in ${t.up}, down in ${t.n - t.up}`, t.swing >= 0 ? "cm-up" : "cm-down")}
    </div>
    <p class="table-note">Every percentage is ${esc(team.name)}'s chance to win. "Before the draft" rates the ten players alone; "after the draft" adds the heroes and who plays them. Each chart shows the change step by step.</p>
    ${blocks}
    <p class="table-note">${esc(MODEL_NOTE)}</p>`;
}

const statTile = (label, value, sub, cls = "") => `<div class="td-tile"><small>${label}</small><b class="${cls}">${value}</b><span>${sub}</span></div>`;

// Won or lost, and whether the model's after-draft favourite won.
const resultChip = (won, post) => {
  const fav = post >= 0.5, right = fav === won;
  return `<span class="td-chip ${won ? "w" : "l"}">${won ? "Won" : "Lost"}</span>
    <span class="td-call ${right ? "right" : "wrong"}">${right ? "✓ the model called it" : `✗ upset: the model had them ${pct(post)}`}</span>`;
};

// Two odds bars, before and after the draft, each one team's share against the other's.
export const oddsBars = (us, them, pre, post) => `<div class="td-odds">
  ${[["Before the draft", pre], ["After the draft", post]].map(([label, p]) => `<div class="td-orow"><small>${label}</small>
    <span class="td-us td-fit"><span class="td-nm">${esc(us)}</span> <b>${pct(p)}</b></span>
    <span class="td-track"><i style="width:${(p * 100).toFixed(1)}%"></i><em></em></span>
    <span class="td-them td-fit"><b>${pct(1 - p)}</b> <span class="td-nm">${esc(them)}</span></span></div>`).join("")}
  <div class="td-delta">Draft: <b class="${post - pre >= 0.005 ? "cm-up" : post - pre <= -0.005 ? "cm-down" : ""}">${pts(post - pre)}</b> for ${esc(us)}</div>
</div>`;

// ---------- the Predict page ----------

// A team's likely five: its roster players with the most league games for it this season.
export function teamFive(team, games) {
  const n = new Map();
  for (const g of games) if (g.team_a_id === team.id || g.team_b_id === team.id) for (const p of g.players) n.set(p.player_key, (n.get(p.player_key) ?? 0) + 1);
  return team.players.map((p) => ({ key: String(p.account_id), name: p.name, rank_tier: p.rank_tier }))
    .sort((x, y) => (n.get(y.key) ?? 0) - (n.get(x.key) ?? 0)).slice(0, 5);
}

// For a hero grid (parts/herogrid.js): the model's read of one side of `ctx` before any pick.
// threats: heroes by their chance to win with it, with the positions it fits them; likely: the
// heroes they're likeliest to play (the model's propensity: their weighted games on it plus what
// their positions suggest), with who; banvs: points each hero would add to them if the other
// side left it. vs: the other side's name, for the notes.
// Bans against `side` in each Captains Mode ban phase: at the start of the phase, after the
// model's own draft up to there (both first-pick orders, averaged), points each still-open hero
// would add to them. Phase 1 is before any pick; 2 after each team's first pick; 3 after eight
// picks. Best first.
const BAN_PHASE_STARTS = CM_STEPS.map(([, k], i) => (k === "ban" && (i === 0 || CM_STEPS[i - 1][1] === "pick") ? i : null)).filter((i) => i != null);
export function phaseBans(ctx, side, heroes) {
  const ours = side === "radiant" ? "dire" : "radiant";
  const acc = BAN_PHASE_STARTS.map(() => new Map());
  for (const themFirst of [true, false]) {
    const order = CM_STEPS.map(([f, k]) => [(f === "F") === themFirst ? side : ours, k]);
    const { steps } = buildDraft(ctx, order, heroes.ids);
    BAN_PHASE_STARTS.forEach((at, p) => {
      const st = { radiant: [], dire: [], pins: { radiant: [], dire: [] } }, gone = new Set();
      for (const s of steps.slice(0, at)) { gone.add(s.hero); if (s.pick) { st[s.side].push(s.hero); st.pins[s.side].push(s.player); } }
      for (const x of scoreHeroes(ctx, st, ours, heroes.ids.filter((h) => !gone.has(h)))) {
        if (x.ban == null) continue;
        const a = acc[p].get(x.hero) ?? [0, 0];
        a[0] += x.ban; a[1]++;
        acc[p].set(x.hero, a);
      }
    });
  }
  return acc.map((m) => [...m].map(([h, [sum, n]]) => [h, sum / n]).sort((a, b) => b[1] - a[1]));
}

export function heroGridModel(ctx, side, heroes, vs = null, { phases = false } = {}) {
  const other = side === "radiant" ? "dire" : "radiant", empty = { radiant: [], dire: [] };
  const who = (j) => ctx.info?.[side]?.[j]?.name ?? null;
  const theirs = scoreHeroes(ctx, empty, side, heroes.ids), ours = scoreHeroes(ctx, empty, other, heroes.ids);
  const threats = theirs.filter((x) => x.pick != null).sort((a, b) => b.pick - a.pick).map((x) => ({
    hero: heroes.name(x.hero), pos: [0, 1, 2, 3, 4].filter((r) => openRoleFor(x.hero, [r], ctx[side]) != null),
    tag: Math.round(x.pick * 100), title: `${heroes.name(x.hero)}: ${pct(x.pick)} to win with it${who(x.player) ? `, played by ${who(x.player)}` : ""}`,
  }));
  const likely = heroes.ids.map((h) => {
    let j = 0, p = -1;
    ctx[side].forEach((pl, i) => { const v = pl.propensity(h); if (v > p) { p = v; j = i; } });
    return { h, p, j };
  }).sort((a, b) => b.p - a.p).map(({ h, p, j }) => ({ hero: heroes.name(h), tag: who(j)?.slice(0, 3) ?? "", title: `${heroes.name(h)}: ${who(j) ?? "a player"} plays it in about ${pct(p)} of their games` }));
  const banvs = ours.filter((x) => x.ban != null).sort((a, b) => b.ban - a.ban).map((x) => ({
    hero: heroes.name(x.hero), tag: `${x.ban >= 0 ? "+" : "−"}${Math.abs(x.ban * 100).toFixed(1)}`,
    title: `${heroes.name(x.hero)}: adds ${(x.ban * 100).toFixed(1)} points to their chance if left open`,
  }));
  const banEntry = ([h, v]) => ({ hero: heroes.name(h), tag: `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`, title: `${heroes.name(h)}: adds ${(v * 100).toFixed(1)} points to their chance if left open` });
  const banPhases = phases ? phaseBans(ctx, side, heroes).map((list) => list.map(banEntry)) : null;
  return { threats, likely, banvs, banPhases, vs };
}

// heroGridModel for `them` ({ div, id, five, name }) against my team (core.js myTeam), or without one
// (or when it's them) against `fallback` ({ div, five, name }), else five average players:
// { them, us (null against average players), vs }. null when the draft file hasn't synced.
// Kept per (them, me, fallback): the reads are many full drafts' work, and the Drafter asks
// again each time its grid switches team. Only the latest few are kept.
const gridModels = new Map();
const fiveKey = (t) => t && [t.div, t.id ?? "", ...(t.five ?? []).map((p) => p?.key ?? "")].join(",");
export function heroGridModelFor(them, me, fallback = null) {
  const key = JSON.stringify([fiveKey(them), me ? `${me.div}:${me.id}` : "", fiveKey(fallback)]);
  if (!gridModels.has(key)) {
    const run = gridModelRead(them, me, fallback).catch((e) => { gridModels.delete(key); throw e; });
    gridModels.set(key, run);
    if (gridModels.size > 8) gridModels.delete(gridModels.keys().next().value);
  }
  return gridModels.get(key);
}
async function gridModelRead(them, me, fallback) {
  let vs = fallback;
  if (me && !(me.div === them.div && String(me.id) === String(them.id))) {
    const dd = await divLite(me.div).catch(() => null);
    const t = dd?.teams.find((x) => String(x.id) === String(me.id));
    if (t) vs = { div: me.div, five: teamFive(t, dd.games), name: t.name };
  }
  const data = await draftDataFor([them.div, vs?.div].filter(Boolean));
  if (!data) return null;
  const average = Array.from({ length: 5 }, () => ({ key: null, name: "Average player", rank_tier: null }));
  const ctx = gameContext(data, { radiant: them.five, dire: vs?.five ?? average }, Date.now() / 1000);
  const heroes = heroIndex(data);
  return { them: heroGridModel(ctx, "radiant", heroes, vs?.name ?? null, { phases: true }), us: vs ? heroGridModel(ctx, "dire", heroes, them.name) : null, vs: vs?.name ?? null };
}

// The draft model on one series: `home` and `away` are teams, read as of now. Before the draft
// is the ten players alone, averaged over who takes Radiant; the model's draft has the
// first-pick team on Radiant. Both are a single game's chance for `home`.
export function seriesRead(home, away, games, data, now = Date.now() / 1000) {
  const H = teamFive(home, games), A = teamFive(away, games);
  const ctxHome = gameContext(data, { radiant: H, dire: A }, now), ctxAway = gameContext(data, { radiant: A, dire: H }, now);
  const empty = { radiant: [], dire: [] };
  const pre = (draftProbability(ctxHome, empty) + 1 - draftProbability(ctxAway, empty)) / 2;
  const heroes = Object.keys(data.heroes).map(Number);
  // The model's draft, for either team on first pick (and Radiant).
  const draft = (homeFirst) => {
    const ctx = homeFirst ? ctxHome : ctxAway;
    const order = CM_STEPS.map(([f, k]) => [f === "F" ? "radiant" : "dire", k]);
    const r = buildDraft(ctx, order, heroes);
    const forHome = (p) => (homeFirst ? p : 1 - p);
    const five = { radiant: homeFirst ? H : A, dire: homeFirst ? A : H };
    return {
      values: r.values.map(forHome),
      steps: r.steps.map((st) => ({ ...st, who: (st.side === "radiant") === homeFirst ? "X" : "Y", name: data.heroes[st.hero], playerName: st.player != null ? five[st.side][st.player]?.name : null })),
    };
  };
  return { pre, draft };
}

// The card's line: the draft model's pre-draft chance next to the ratings.
export const preDraftLine = (home, away, pre) => `<div class="pcm-line"><small>Draft model · one game, before the draft</small>
  <span class="td-us td-fit"><span class="td-nm">${esc(home.name)}</span> <b>${pct(pre)}</b></span><span class="td-track"><i style="width:${(pre * 100).toFixed(1)}%"></i><em></em></span><span class="td-them td-fit"><b>${pct(1 - pre)}</b> <span class="td-nm">${esc(away.name)}</span></span></div>`;

// The model's draft for a series, from the home team's side.
export function modelDraftHtml(home, away, d, width) {
  const last = d.values.at(-1);
  const chart = draftChart({ values: d.values, nameX: home.name, nameY: away.name, width,
    steps: d.steps.map((st) => ({ who: st.who, pick: st.pick, hero: st.name })) });
  const lineup = (w) => d.steps.filter((st) => st.pick && st.who === w).map((st) => `<span class="pcm-pick">${portrait(st.name)}<span>${esc(st.name)}<small>${esc(st.playerName ?? "")}</small></span></span>`).join("");
  const bans = (w) => d.steps.filter((st) => !st.pick && st.who === w).map((st) => portrait(st.name, "pcm-ban")).join("");
  return `${oddsBars(home.name, away.name, d.values[0], last)}
    ${chart}
    <div class="pcm-lineups">
      <div><div class="pcm-team s-a">${esc(home.name)}</div><div class="pcm-picks">${lineup("X")}</div><div class="pcm-bans">${bans("X")}</div></div>
      <div><div class="pcm-team s-b">${esc(away.name)}</div><div class="pcm-picks">${lineup("Y")}</div><div class="pcm-bans">${bans("Y")}</div></div>
    </div>`;
}
