// Game page: the gold lead with teamfights and item finishes on one clock. Team A's core items
// sit in a lane above the plot, team B's below; each teamfight is a band over its seconds with
// a circle on the lead line sized by its deaths and coloured by the side that lost fewer.
// Uses the same figure / data-chart shape as charts.js, so wireCharts() adds the crosshair.
import { itemImg, itemName, timingsOf, hasItems, clock, leadAt, itemSwing } from "./items.js";
import { deathsOf, hasDeaths } from "./deathmap.js";
import { firstBloodOf } from "./combat.js";
import { heroImg } from "./hero-meta.js";
import { leadScale } from "./charts.js";
import { BUILDING_ICONS } from "./building-icons.js";

// Chart units: `width` (default 800) is chosen by the page so a unit is about 1.2 screen pixels
// at any size; icons and portraits stay small on a wide screen, and only the time axis stretches.
const L = 52, R = 14, IW = 21.6, IH = 15.6, ROW = IH + 4, MAX_ROWS = 4;
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const k = (v) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.round(Math.abs(v))}`;

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
    out.push({ start, end, deaths: inF.length || total, dead: inF, a, b, won: a < b ? "a" : b < a ? "b" : null, lead: l0 != null && l1 != null ? Math.round(l1 - l0) : null });
  }
  return out;
}

// Rows: each icon goes in the first row with room at its x, up to MAX_ROWS (then the last).
// Icons placed first (objectives) get the rows nearest the plot.
function lanes(items, x) {
  const rows = [];
  return items.map((it) => {
    const cx = x(it.sec / 60);
    let r = rows.findIndex((row) => row.every((c) => Math.abs(c - cx) >= IW + 2));
    if (r < 0) r = rows.length < MAX_ROWS ? rows.length : MAX_ROWS - 1;
    (rows[r] ??= []).push(cx);
    return { ...it, cx, row: r };
  });
}
// Roshan and Tormentor kills as lane icons: the Aegis for Roshan, and Aghanim's Shard (what a
// Tormentor drops; there's no Tormentor icon on the CDN) for Tormentor.
const OBJ = { roshan: ["aegis", "Roshan"], tormentor: ["aghanims_shard", "Tormentor"] };
// Buildings: which icon (tower, barracks, Ancient) and a full name for the tooltip.
const bIcon = (b) => (/^t\d/.test(b) ? "tower" : b === "fort" ? "ancient" : "barracks");
const bName = (b) => (b === "fort" ? "Ancient" : /^t\d_/.test(b) ? `T${b[1]} ${b.slice(3)}` : b === "t4" ? "T4" : `${b[0].toUpperCase()}${b.slice(1).replace("_", " rax ")}`);
// Layers the chart can show; all on unless `show` turns one off.
export const LAYERS = [["items", "Items"], ["fights", "Teamfights"], ["xp", "XP lead"], ["deaths", "Hero deaths"], ["objectives", "Roshan & Tormentor"], ["towers", "Towers"], ["buybacks", "Buybacks"], ["firstblood", "First blood"]];

// Empty string without a lead series or any item timings.
// show: { items, fights, xp, deaths, objectives, towers, buybacks, firstblood } — false leaves that layer out (an empty
// lane takes no height), for a simpler chart.
export function itemLeadHtml(m, { id = "item-lead", show = {}, width = 800 } = {}) {
  const W = Math.max(800, Math.round(width));
  // The plot keeps the height it would have had stretched from 800 units (220 there), so a wide
  // screen gets a tall, readable lead line while the icons stay small. Capped so it fits a screen.
  const PLOT = Math.round(Math.min(220 * (W / 800), 440));
  const on = { ...Object.fromEntries(LAYERS.map(([k]) => [k, true])), ...show };
  const adv = m.gold_adv;
  if (!Array.isArray(adv) || adv.length < 2 || !m.players.some(hasItems)) return "";
  const n = adv.length, name = { a: m.team_a, b: m.team_b };
  const items = (t) => m.players.filter((p) => p.team === t).flatMap((p) => timingsOf(p).map(({ key, sec }) => ({ p, key, sec })))
    .filter((it) => it.sec >= 0 && it.sec <= (n - 1) * 60).sort((x, y) => x.sec - y.sec);
  const x = (min) => L + (min / (n - 1)) * (W - L - R);
  const objs = (t) => (m.objectives ?? []).filter((o) => OBJ[o.type] && o.side === t && o.time >= 0 && o.time <= (n - 1) * 60)
    .map((o) => ({ obj: o.type, sec: o.time })).sort((p, q) => p.sec - q.sec);
  // Buildings a team destroyed go in that team's lane.
  const towers = (t) => (m.buildings ?? []).filter((b) => (b.by ?? (b.side === "a" ? "b" : "a")) === t && b.time >= 0 && b.time <= (n - 1) * 60)
    .map((b) => ({ bld: b, sec: b.time })).sort((p, q) => p.sec - q.sec);
  // Buybacks go on the buyer's side, with when that player next died (a "dieback" if soon).
  const allDeaths = hasDeaths(m) ? deathsOf(m) : null;
  const buybacks = (t) => m.players.flatMap((p, i) => (p.team === t && Array.isArray(p.buybacks) ? p.buybacks : [])
    .filter((sec) => sec >= 0 && sec <= Math.max(m.duration_sec, (n - 1) * 60))
    // Drawn at the lead series' last minute if later (the series stops before the game ends).
    .map((sec) => ({ bb: p, sec: Math.min(sec, (n - 1) * 60), at: sec, next: allDeaths ? allDeaths.filter((d) => d.i === i && d.t > sec).sort((a, b) => a.t - b.t)[0] ?? null : undefined })))
    .sort((p, q) => p.sec - q.sec);
  // First blood, on the side that drew it (the killer's hero), from the players' kill logs.
  const fb = on.firstblood ? firstBloodOf(m) : null;
  const firstBlood = (t) => (fb && fb.team === t && fb.t <= (n - 1) * 60 ? [{ fb, sec: Math.max(0, fb.t) }] : []);
  const lane = (t) => lanes(on.items ? items(t) : [], x);
  const top = lane("a"), bottom = lane("b");
  const rows = (list) => (list.length ? Math.max(...list.map((i) => i.row + 1)) : on.items ? 1 : 0);
  const rowsA = rows(top), rowsB = rows(bottom);
  const T = 8 + rowsA * ROW + 6, B = T + PLOT, H = B + 6 + rowsB * ROW + 26;
  // XP lead as a second, dashed line on the same scale (when the replay has it).
  const xp = on.xp && Array.isArray(m.xp_adv) && m.xp_adv.length >= 2 ? m.xp_adv.slice(0, n) : null;
  const sc = leadScale(xp ? [...adv, ...xp] : adv); // each side scaled to its own biggest lead
  const y = sc.y(T, PLOT), y0 = y(0);
  const fights = fightsOf(m);

  let grid = "";
  for (const v of sc.ticks) grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${k(v).replace("+", "")}</text>`;
  for (let mm = 0; mm < n; mm += n > 50 ? 10 : 5) grid += `<line class="grid" x1="${x(mm)}" x2="${x(mm)}" y1="${T}" y2="${B}"/><text class="tick" x="${x(mm)}" y="${H - 8}" text-anchor="middle">${mm}'</text>`;

  const line = adv.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const xpLine = xp ? xp.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("") : "";
  const area = `${line}L${x(n - 1)},${y0}L${x(0)},${y0}Z`;
  // Who died in a fight: a small anchor on the line, team A's dead stacked above it and team B's
  // below (each side's own half of the chart), portraits ringed in their team's colour. More than
  // FACE_COL on a side starts another column; columns stay inside the plot.
  const FACE = 8.4, STEP = 2 * FACE + 2, FACE_COL = 3;
  const faces = (f, cx, cy, cls, tip, group = "") => {
    const one = (d, t, j, total) => {
      const col = Math.floor(j / FACE_COL), row = j % FACE_COL, p = m.players[d.i];
      // Extra columns alternate right and left, and stay inside the plot.
      let dx = col ? (col % 2 ? 1 : -1) * Math.ceil(col / 2) * STEP : 0;
      if (cx + dx > W - R - FACE || cx + dx < L + FACE) dx = -dx;
      // A column that won't fit between the line and the plot edge slides back as a whole.
      const rows = Math.min(FACE_COL, total - col * FACE_COL), far = 5 + FACE + (rows - 1) * STEP;
      const fy = t === "a" ? Math.max(cy, T + FACE + far) - 5 - FACE - row * STEP : Math.min(cy, B - FACE - far) + 5 + FACE + row * STEP;
      const img = heroImg(p.hero), fx = cx + dx;
      return `<g class="fight-face s-${t}"><title>${attr(`${p.name} (${p.hero}) died at ${clock(d.t)}`)}</title>
        ${img ? `<image href="${attr(img)}" x="${(fx - FACE).toFixed(1)}" y="${(fy - FACE).toFixed(1)}" width="${2 * FACE}" height="${2 * FACE}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-face)"/>` : ""}
        <circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${FACE}"/></g>`;
    };
    const side = (t) => { const ds = f.dead.filter((d) => d.team === t); return ds.map((d, j) => one(d, t, j, ds.length)).join(""); };
    return `<g class="fight-dead${group}">${side("a")}${side("b")}<circle class="fight-dot anchor${cls}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5">${tip}</circle></g>`;
  };
  const fightParts = fights.map((f) => {
    const x0 = x(f.start / 60), x1 = Math.max(x(f.end / 60), x0 + 3);
    const r = 3 + 2.2 * Math.sqrt(f.deaths), cy = y(leadAt(adv, Math.min((f.start + f.end) / 2, (n - 1) * 60)) ?? 0);
    const tip = `<title>${attr(`Teamfight ${clock(f.start)}–${clock(f.end)} · ${f.deaths} death${f.deaths === 1 ? "" : "s"}: ${name.a} lost ${f.a}, ${name.b} lost ${f.b}`
      + (f.lead != null ? ` · gold lead ${k(Math.abs(f.lead))} to ${f.lead >= 0 ? name.a : name.b} over the fight` : ""))}</title>`;
    const cls = f.won ? ` s-${f.won}` : "";
    return {
      band: !on.fights ? "" : `<rect class="fight-band${cls}" x="${x0.toFixed(1)}" y="${T}" width="${(x1 - x0).toFixed(1)}" height="${PLOT}">${tip}</rect>`,
      dot: on.deaths && f.dead.length ? faces(f, (x0 + x1) / 2, cy, cls, tip) : on.fights ? `<circle class="fight-dot${cls}" cx="${((x0 + x1) / 2).toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}">${tip}</circle>` : "",
    };
  });
  // Deaths outside every teamfight (pickoffs, lane deaths), grouped when within 20s of each other.
  const dkey = (d) => `${d.i}:${d.t}`, inFight = new Set(fights.flatMap((f) => f.dead.map(dkey)));
  const loose = on.deaths && hasDeaths(m) ? deathsOf(m).filter((d) => !inFight.has(dkey(d)) && d.t <= (n - 1) * 60) : [];
  const groups = [];
  for (const d of loose) { const g = groups.at(-1); if (g && d.t - g.at(-1).t <= 20) g.push(d); else groups.push([d]); }
  const pickParts = groups.map((g) => {
    const t0 = g[0].t, t1 = g.at(-1).t, mid = (t0 + t1) / 2, a = g.filter((d) => d.team === "a").length, b = g.length - a;
    const tip = `<title>${attr(`${g.length > 1 ? `${g.length} deaths` : g[0].kind === "lane" ? "Lane death" : "Pickoff"} at ${clock(t0)}${t1 > t0 ? `–${clock(t1)}` : ""}: ${name.a} lost ${a}, ${name.b} lost ${b}`)}</title>`;
    return faces({ dead: g }, x(mid / 60), y(leadAt(adv, mid) ?? 0), a < b ? " s-a" : b < a ? " s-b" : "", tip);
  });
  // Roshan, Tormentor and buildings as small circles on the lead line at the moment they fell,
  // ringed in the colour of the team that took them. Ones that would overlap stack away from the
  // line on the taker's side (team A up, team B down).
  const MK = 7.8;
  const marks = ["a", "b"].flatMap((t) => [...(on.objectives ? objs(t) : []), ...(on.towers ? towers(t) : []), ...(on.buybacks ? buybacks(t) : []), ...firstBlood(t)].map((mk) => ({ ...mk, t })))
    .sort((p, q) => p.sec - q.sec);
  const placed = [];
  const markParts = marks.map((mk) => {
    const cx = x(mk.sec / 60), base = y(leadAt(adv, mk.sec) ?? 0);
    let lvl = 0;
    while (placed.some((q) => q.t === mk.t && q.lvl === lvl && Math.abs(q.cx - cx) < 2 * MK + 1)) lvl++;
    placed.push({ t: mk.t, lvl, cx });
    const cy = Math.min(B - MK, Math.max(T + MK, base + (mk.t === "a" ? -1 : 1) * lvl * (2 * MK + 1)));
    if (mk.obj) {
      const [key, label] = OBJ[mk.obj];
      return `<g class="mk obj s-${mk.t}"><title>${attr(`${label} killed by ${name[mk.t]} at ${clock(mk.sec)}`)}</title>
        <circle class="mk-bg" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK}"/>
        <image href="${attr(itemImg(key))}" x="${(cx - MK).toFixed(1)}" y="${(cy - MK).toFixed(1)}" width="${2 * MK}" height="${2 * MK}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-face)"/>
        <circle class="mk-ring" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK}"/></g>`;
    }
    if (mk.bb) {
      const p = mk.bb, img = heroImg(p.hero);
      const after = mk.next === undefined ? "" : mk.next ? ` · died again ${clock(mk.next.t - mk.at)} later` : " · didn't die again";
      return `<g class="mk bb s-${mk.t}"><title>${attr(`${p.name} (${p.hero}) bought back at ${clock(mk.at)}${after}`)}</title>
        <circle class="mk-bb" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK + 1.6}"/>
        <circle class="mk-bg" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK}"/>
        ${img ? `<image href="${attr(img)}" x="${(cx - MK).toFixed(1)}" y="${(cy - MK).toFixed(1)}" width="${2 * MK}" height="${2 * MK}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-face)"/>` : ""}
        <circle class="mk-ring" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK}"/></g>`;
    }
    if (mk.fb) {
      const p = m.players[mk.fb.i], img = heroImg(p.hero), v = mk.fb.victim != null ? m.players[mk.fb.victim] : null;
      return `<g class="mk fb s-${mk.t}"><title>${attr(`First blood: ${p.name} (${p.hero})${v ? ` on ${v.name} (${v.hero})` : ""} at ${clock(mk.fb.t)}`)}</title>
        <circle class="mk-fb" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK + 1.6}"/>
        <circle class="mk-bg" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK}"/>
        ${img ? `<image href="${attr(img)}" x="${(cx - MK).toFixed(1)}" y="${(cy - MK).toFixed(1)}" width="${2 * MK}" height="${2 * MK}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-face)"/>` : ""}
        <circle class="mk-ring" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK}"/></g>`;
    }
    const b = mk.bld;
    return `<g class="mk bld s-${mk.t}"><title>${attr(`${bName(b.b)} (${name[b.side] ?? ""}) destroyed by ${b.hero ? `${b.hero} (${name[mk.t]})` : name[mk.t]} at ${clock(mk.sec)}`)}</title>
      <circle class="mk-bg" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK}"/>
      <svg class="mk-icon" x="${(cx - 5.4).toFixed(1)}" y="${(cy - 5.4).toFixed(1)}" width="10.8" height="10.8" viewBox="0 0 512 512"><path d="${BUILDING_ICONS[bIcon(b.b)]}"/></svg>
      <circle class="mk-ring" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${MK}"/></g>`;
  });
  // The buyer's hero as a small round badge on the item's bottom-right corner.
  const BADGE = 4.8;
  const badge = (hero, bx, by) => {
    const img = heroImg(hero);
    return img ? `<image class="it-hero" href="${attr(img)}" x="${(bx - BADGE).toFixed(1)}" y="${(by - BADGE).toFixed(1)}" width="${2 * BADGE}" height="${2 * BADGE}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-face)"/>
      <circle class="it-hero-ring" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${BADGE}"/>` : "";
  };
  const icon = (it, t) => {
    const yy = t === "a" ? T - 6 - (it.row + 1) * ROW + 4 : B + 6 + it.row * ROW;
    const edge = t === "a" ? T : B;
    const sw = itemSwing(m, it.p.team, it.sec);
    const tip = `${it.p.name} (${it.p.hero}) · ${itemName(it.key)} at ${clock(it.sec)}`
      + (sw ? ` · gold lead for ${name[t]}: ${k(sw.after)} in the 3′ after, ${k(sw.before)} in the 3′ before (swing ${k(sw.swing)})` : "");
    return `<g class="it s-${t}"><title>${attr(tip)}</title>
      <line class="it-tick" x1="${it.cx.toFixed(1)}" x2="${it.cx.toFixed(1)}" y1="${edge - 3}" y2="${edge + 3}"/>
      <image href="${attr(itemImg(it.key))}" x="${(it.cx - IW / 2).toFixed(1)}" y="${yy.toFixed(1)}" width="${IW}" height="${IH}" preserveAspectRatio="xMidYMid slice"/>
      ${badge(it.p.hero, it.cx + IW / 2 - 1, yy + IH - 1)}</g>`;
  };

  const svg = `<defs>
      <clipPath id="${id}-up"><rect x="0" y="0" width="${W}" height="${y0}"/></clipPath>
      <clipPath id="${id}-down"><rect x="0" y="${y0}" width="${W}" height="${H}"/></clipPath>
      <clipPath id="${id}-face" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath></defs>
    ${grid}
    <text class="side-label s-a" x="${L + 8}" y="${T + 13}">${attr(name.a)} ahead</text>
    <text class="side-label s-b" x="${L + 8}" y="${B - 7}">${attr(name.b)} ahead</text>
    ${fightParts.map((f) => f.band).join("")}
    <path class="area il-a" d="${area}" clip-path="url(#${id}-up)"/>
    <path class="area il-b" d="${area}" clip-path="url(#${id}-down)"/>
    <line class="zero" x1="${L}" x2="${W - R}" y1="${y0}" y2="${y0}"/>
    ${xp ? `<path class="xp-line" d="${xpLine}"/>` : ""}
    <path class="lead-line" d="${line}"/>
    ${pickParts.join("")}
    ${fightParts.map((f) => f.dot).join("")}
    ${markParts.join("")}
    ${top.map((it) => icon(it, "a")).join("")}${bottom.map((it) => icon(it, "b")).join("")}
    <line class="cross" x1="0" x2="0" y1="${T}" y2="${B}" visibility="hidden"/><g class="hover-tags"></g>`;
  const caption = [
    `Hover for the exact gold${xp ? " and XP" : ""} lead at any minute, or any marker for details.${xp ? " Solid line: gold; dashed: XP." : ""}`,
    on.items && `Items: ${attr(name.a)}'s above the plot, ${attr(name.b)}'s below.`,
    (on.objectives || on.towers) && "Circles on the line, ringed in the colour of the team that took it:",
    on.objectives && "Aegis = Roshan, Shard = Tormentor;",
    on.towers && "tower, barracks or Ancient icons for buildings (hover for which).",
    on.buybacks && m.players.some((p) => p.buybacks?.length) && "A hero in a gold ring on the line is a buyback, on the buyer's side (hover for when they died next).",
    fb && "A hero in a red ring is first blood, on the killer's side.",
    on.deaths && `Portraits are the heroes who died (${attr(name.a)}'s above the line, ${attr(name.b)}'s below), teamfights and pickoffs alike; the dot is coloured by the side that lost fewer.${on.fights ? " Shaded bands are teamfights." : ""}`,
    !on.deaths && on.fights && "Shaded bands are teamfights; the dot is sized by deaths and coloured by the side that lost fewer.",
  ].filter(Boolean).join(" ");
  const data = { kind: "lead", w: W, n, x: [L, W - R], nameA: name.a, nameB: name.b, tip: true, ys: [T, PLOT, sc.top, sc.bot],
    series: [{ label: "Gold", values: adv }, ...(xp ? [{ label: "XP", values: xp }] : [])] };
  return `<figure class="chart item-lead" id="${id}" data-chart="${attr(JSON.stringify(data))}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(caption)}">${svg}</svg>
    <figcaption class="chart-read">${caption}</figcaption></figure>`;
}
