// Game page: the gold lead with teamfights and item finishes on one clock. Team A's core items
// sit in a lane above the plot, team B's below; each teamfight is a band over its seconds with
// a circle on the lead line sized by its deaths and coloured by the side that lost fewer.
// Uses the same figure / data-chart shape as charts.js, so wireCharts() adds the crosshair.
import { itemImg, itemName, timingsOf, hasItems, clock, leadAt, itemSwing } from "./items.js";
import { deathsOf, hasDeaths } from "./deathmap.js";

const W = 800, L = 52, R = 14, PLOT = 220, IW = 22, IH = 16, ROW = IH + 4, MAX_ROWS = 4;
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const k = (v) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.round(Math.abs(v))}`;
const leadMax = (v) => {
  if (v <= 0) return 1000;
  const step = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 3, 4, 5, 6, 8, 10].map((m) => m * step).find((m) => m >= v * 1.08);
};

// Teamfights with deaths per side and the lead change across them (team A's view).
// m.fights is flat [start, end, deaths, ...].
export function fightsOf(m) {
  if (!Array.isArray(m.fights)) return [];
  const deaths = hasDeaths(m) ? deathsOf(m) : [];
  const out = [];
  for (let j = 0; j + 2 < m.fights.length; j += 3) {
    const [start, end, total] = [m.fights[j], m.fights[j + 1], m.fights[j + 2]];
    const inF = deaths.filter((d) => d.t >= start && d.t <= end);
    const a = inF.filter((d) => d.team === "a").length, b = inF.length - a;
    const l0 = leadAt(m.gold_adv, start), l1 = leadAt(m.gold_adv, Math.min(end + 30, (m.gold_adv?.length - 1) * 60));
    out.push({ start, end, deaths: inF.length || total, a, b, won: a < b ? "a" : b < a ? "b" : null, lead: l0 != null && l1 != null ? Math.round(l1 - l0) : null });
  }
  return out;
}

// Greedy rows: each icon goes in the first row with room at its x, up to MAX_ROWS (then the last).
function lanes(items, x) {
  const ends = [];
  return items.map((it) => {
    const cx = x(it.sec / 60);
    let r = ends.findIndex((e) => e + IW + 2 <= cx);
    if (r < 0) r = ends.length < MAX_ROWS ? ends.length : MAX_ROWS - 1;
    ends[r] = cx;
    return { ...it, cx, row: r };
  });
}

// Empty string without a lead series or any item timings.
export function itemLeadHtml(m, { id = "item-lead" } = {}) {
  const adv = m.gold_adv;
  if (!Array.isArray(adv) || adv.length < 2 || !m.players.some(hasItems)) return "";
  const n = adv.length, name = { a: m.team_a, b: m.team_b };
  const items = (t) => m.players.filter((p) => p.team === t).flatMap((p) => timingsOf(p).map(({ key, sec }) => ({ p, key, sec })))
    .filter((it) => it.sec >= 0 && it.sec <= (n - 1) * 60).sort((x, y) => x.sec - y.sec);
  const x = (min) => L + (min / (n - 1)) * (W - L - R);
  const top = lanes(items("a"), x), bottom = lanes(items("b"), x);
  const rowsA = Math.max(1, ...top.map((i) => i.row + 1)), rowsB = Math.max(1, ...bottom.map((i) => i.row + 1));
  const T = 8 + rowsA * ROW + 6, B = T + PLOT, H = B + 6 + rowsB * ROW + 26;
  const max = leadMax(Math.max(...adv.map(Math.abs)));
  const y = (v) => T + (1 - (v + max) / (2 * max)) * PLOT, y0 = y(0);
  const fights = fightsOf(m);

  let grid = "";
  for (const v of [max, max / 2, -max / 2, -max]) grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${k(v).replace("+", "")}</text>`;
  for (let mm = 0; mm < n; mm += n > 50 ? 10 : 5) grid += `<line class="grid" x1="${x(mm)}" x2="${x(mm)}" y1="${T}" y2="${B}"/><text class="tick" x="${x(mm)}" y="${H - 8}" text-anchor="middle">${mm}'</text>`;

  const line = adv.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(n - 1)},${y0}L${x(0)},${y0}Z`;
  const fightParts = fights.map((f) => {
    const x0 = x(f.start / 60), x1 = Math.max(x(f.end / 60), x0 + 3);
    const r = 3 + 2.2 * Math.sqrt(f.deaths), cy = y(leadAt(adv, Math.min((f.start + f.end) / 2, (n - 1) * 60)) ?? 0);
    const tip = `<title>${attr(`Teamfight ${clock(f.start)}–${clock(f.end)} · ${f.deaths} death${f.deaths === 1 ? "" : "s"}: ${name.a} lost ${f.a}, ${name.b} lost ${f.b}`
      + (f.lead != null ? ` · gold lead ${k(Math.abs(f.lead))} to ${f.lead >= 0 ? name.a : name.b} over the fight` : ""))}</title>`;
    const cls = f.won ? ` s-${f.won}` : "";
    return {
      band: `<rect class="fight-band${cls}" x="${x0.toFixed(1)}" y="${T}" width="${(x1 - x0).toFixed(1)}" height="${PLOT}">${tip}</rect>`,
      dot: `<circle class="fight-dot${cls}" cx="${((x0 + x1) / 2).toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}">${tip}</circle>`,
    };
  });
  const icon = (it, t) => {
    const yy = t === "a" ? T - 6 - (it.row + 1) * ROW + 4 : B + 6 + it.row * ROW;
    const sw = itemSwing(m, it.p.team, it.sec);
    const tip = `${it.p.name} (${it.p.hero}) · ${itemName(it.key)} at ${clock(it.sec)}`
      + (sw ? ` · gold lead for ${name[t]}: ${k(sw.after)} in the 3′ after, ${k(sw.before)} in the 3′ before (swing ${k(sw.swing)})` : "");
    const edge = t === "a" ? T : B;
    return `<g class="it s-${t}"><title>${attr(tip)}</title>
      <line class="it-tick" x1="${it.cx.toFixed(1)}" x2="${it.cx.toFixed(1)}" y1="${edge - 3}" y2="${edge + 3}"/>
      <image href="${attr(itemImg(it.key))}" x="${(it.cx - IW / 2).toFixed(1)}" y="${yy.toFixed(1)}" width="${IW}" height="${IH}" preserveAspectRatio="xMidYMid slice"/></g>`;
  };

  const svg = `<defs>
      <clipPath id="${id}-up"><rect x="0" y="0" width="${W}" height="${y0}"/></clipPath>
      <clipPath id="${id}-down"><rect x="0" y="${y0}" width="${W}" height="${H}"/></clipPath></defs>
    ${grid}
    <text class="side-label s-a" x="${L + 8}" y="${T + 13}">${attr(name.a)} ahead</text>
    <text class="side-label s-b" x="${L + 8}" y="${B - 7}">${attr(name.b)} ahead</text>
    ${fightParts.map((f) => f.band).join("")}
    <path class="area il-a" d="${area}" clip-path="url(#${id}-up)"/>
    <path class="area il-b" d="${area}" clip-path="url(#${id}-down)"/>
    <line class="zero" x1="${L}" x2="${W - R}" y1="${y0}" y2="${y0}"/>
    <path class="lead-line" d="${line}"/>
    ${fightParts.map((f) => f.dot).join("")}
    ${top.map((it) => icon(it, "a")).join("")}${bottom.map((it) => icon(it, "b")).join("")}
    <line class="cross" x1="0" x2="0" y1="${T}" y2="${B}" visibility="hidden"/><g class="hover-tags"></g>`;
  const caption = `Hover for the lead at any minute; hover an item or a fight for details. Items: ${attr(name.a)} above, ${attr(name.b)} below. Circles: teamfights, sized by deaths, coloured by the side that lost fewer (grey = even).`;
  const data = { kind: "lead", n, x: [L, W - R], nameA: name.a, nameB: name.b, series: [{ label: "Gold", values: adv }] };
  return `<figure class="chart item-lead" id="${id}" data-chart="${attr(JSON.stringify(data))}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(caption)}">${svg}</svg>
    <figcaption class="chart-read">${caption}</figcaption></figure>`;
}
