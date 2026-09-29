// Items and item timings (AD2L only: scrims come from OCR, which can't read item icons).
// Each game player carries `items` (final 6 slots + neutral, as item keys, null = empty) and
// `item_times` (flat [key, second, ...]: the first purchase of each core item, in order).
import { ITEMS, ITEM_IDS } from "./items-data.js";

const CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/";
// Raw shop items that are builds in their own right; everything else core is built from parts.
const RAW_CORE = new Set(["blink", "aghanims_shard"]);
const KEEP = new Set([...RAW_CORE, "ultimate_scepter"]);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const clock = (sec) => `${sec < 0 ? "-" : ""}${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, "0")}`;

export const itemName = (key) => ITEMS[key]?.[0] ?? key;
export const itemCost = (key) => ITEMS[key]?.[1] ?? 0;
export const itemImg = (key) => (ITEMS[key] ? `${CDN}${ITEMS[key][2] || key}.png` : null);
// A build worth timing: built from components for 1000+ gold, or Blink / Aghanim's Shard.
export const isCore = (key) => RAW_CORE.has(key) || (ITEMS[key]?.[3] === "b" && ITEMS[key][1] >= 1000);

// OpenDota match player -> { items, item_times }; nulls when the replay wasn't parsed.
export function itemsFrom(p) {
  const slot = (id) => (id ? ITEM_IDS[id] ?? null : null);
  const items = "item_0" in p ? [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5, p.item_neutral].map(slot) : null;
  if (!Array.isArray(p.purchase_log)) return { items, item_times: null };
  const seen = new Set(), picks = [];
  for (const { key, time } of p.purchase_log) {
    if (!isCore(key) || seen.has(key)) continue;
    seen.add(key);
    picks.push({ key, time });
  }
  // A part built into something bigger later (Yasha -> Manta, Crystalys -> Daedalus) isn't a
  // build of its own; Blink, Scepter and Shard keep their timing even when upgraded.
  const upgraded = new Set(picks.flatMap(({ key }) => ITEMS[key]?.[4] ?? []).filter((k) => !KEEP.has(k)));
  return { items, item_times: picks.filter(({ key }) => !upgraded.has(key)).flatMap(({ key, time }) => [key, time]) };
}

// [{ key, sec }] from a player's flat item_times.
export function timingsOf(p) {
  const t = p.item_times ?? [], out = [];
  for (let i = 0; i < t.length; i += 2) out.push({ key: t[i], sec: t[i + 1] });
  return out;
}

export const hasItems = (p) => Array.isArray(p.item_times);

// An item icon; with a second, the finish time is printed under it.
export function itemIcon(key, sec = null, cls = "") {
  const src = itemImg(key);
  const title = `${itemName(key)}${sec != null ? ` · ${clock(sec)}` : ""}`;
  const img = src ? `<img src="${src}" alt="${esc(itemName(key))}" loading="lazy">` : `<span class="missing">${esc(itemName(key).slice(0, 2))}</span>`;
  return `<span class="item ${cls}" title="${esc(title)}">${img}${sec != null ? `<b>${clock(sec)}</b>` : ""}</span>`;
}

// Team A's gold lead at a second, read off the per-minute series (linear between minutes);
// null outside the game.
export function leadAt(adv, sec) {
  if (!Array.isArray(adv) || sec < 0 || sec > (adv.length - 1) * 60) return null;
  const i = Math.floor(sec / 60), f = sec / 60 - i;
  return i + 1 < adv.length ? adv[i] + (adv[i + 1] - adv[i]) * f : adv[i];
}

export const SWING_WINDOW = 180;
// How the gold lead moved around an item finish, from the buyer's team's side: the change over
// the `win` seconds after, the change over the `win` seconds before, and swing = after − before
// (the lead's turn, not its trend). Null when the game has no lead series or the window runs
// past either end. A correlation: teams that are ahead also finish items sooner.
export function itemSwing(m, team, sec, win = SWING_WINDOW) {
  const at = (t) => leadAt(m.gold_adv, t);
  const [b, now, a] = [at(sec - win), at(sec), at(sec + win)];
  if (b == null || now == null || a == null) return null;
  const s = team === "a" ? 1 : -1;
  const after = Math.round(s * (a - now)) + 0, before = Math.round(s * (now - b)) + 0; // + 0: no −0
  return { before, after, swing: after - before };
}

// Per core item over a set of game players ({ p, m } with m.winner): how many built it, share
// of games, average and fastest second (with who), win rate when built, and the average lead
// swing around finishing it (null when no game had the lead series). Most built first.
export function itemStats(rows) {
  const games = rows.filter(({ p }) => hasItems(p));
  const by = new Map();
  for (const { p, m } of games) {
    for (const { key, sec } of timingsOf(p)) {
      const s = by.get(key) ?? { key, n: 0, total: 0, wins: 0, best: null, swing: 0, swings: 0 };
      s.n++;
      s.total += sec;
      if (m.winner === p.team) s.wins++;
      if (!s.best || sec < s.best.sec) s.best = { sec, p, m };
      const sw = itemSwing(m, p.team, sec);
      if (sw) { s.swing += sw.swing; s.swings++; }
      by.set(key, s);
    }
  }
  return [...by.values()]
    .map((s) => ({ key: s.key, n: s.n, share: s.n / games.length, avg: Math.round(s.total / s.n), best: s.best, winRate: s.wins / s.n,
      swing: s.swings ? Math.round(s.swing / s.swings) : null, swings: s.swings }))
    .sort((a, b) => b.n - a.n || a.avg - b.avg);
}

// Average finish second per key (optionally per `hero|key`) over every game player.
export function averageTimes(matches, { perHero = false } = {}) {
  const sums = new Map();
  for (const m of matches) for (const p of m.players) for (const { key, sec } of timingsOf(p)) {
    const k = perHero ? `${p.hero}|${key}` : key;
    const s = sums.get(k) ?? [0, 0];
    s[0] += sec; s[1]++;
    sums.set(k, s);
  }
  return new Map([...sums].map(([k, [t, n]]) => [k, { avg: Math.round(t / n), n }]));
}

// The finish furthest ahead of the league average for the same item on the same hero, among
// that hero's usual builds (2000+ gold, finished in at least `minShare` of the hero's parsed
// league games, `minSamples`+ builds), so a situational item bought early doesn't count:
// { p, m, key, sec, avg, ahead }, or null.
export function fastestCore(games, league, { minSamples = 3, minShare = 0.5 } = {}) {
  const avg = averageTimes(league, { perHero: true });
  const heroGames = new Map();
  for (const m of league) for (const p of m.players) if (hasItems(p)) heroGames.set(p.hero, (heroGames.get(p.hero) ?? 0) + 1);
  let top = null;
  for (const m of games) for (const p of m.players) for (const { key, sec } of timingsOf(p)) {
    const a = avg.get(`${p.hero}|${key}`);
    if (!a || a.n < minSamples || a.n < minShare * heroGames.get(p.hero) || itemCost(key) < 2000) continue;
    const ahead = a.avg - sec;
    if (!top || ahead > top.ahead) top = { p, m, key, sec, avg: a.avg, ahead };
  }
  return top && top.ahead > 0 ? top : null;
}
