// Player schedule (#/scrims/schedule?tab=players): each player's weekly availability and the
// team's own events, seen by the team's roster only (hidden on the site; see the rules).
//
// Availability is a weekly pattern saved as `slots`, 168 characters of "0"/"1": one per UTC hour
// of the week, Monday 00:00 UTC first. The page shows and edits it in the viewer's own time zone
// (rows Monday to Sunday, columns 0–23 local) at the viewer's current offset. Zones off the hour
// (India, +5:30) round to the hour.
// An event is { id, div, team, title, start: Date, minutes, account }.

export const HOURS = 168;
export const EVENT_TITLE_MAX = 60;
export const EVENT_MINUTES = [30, 60, 90, 120, 180, 240];
export const emptySlots = () => "0".repeat(HOURS);
export const validSlots = (s) => typeof s === "string" && /^[01]{168}$/.test(s);

// The viewer's offset from UTC in minutes, as getTimezoneOffset gives it (New York in summer:
// 240). One offset for the whole week keeps every local hour on its own slot, even in the week
// the clocks change.
export const zoneOffset = (now = new Date()) => now.getTimezoneOffset();

// The UTC slot for local day d (0 = Monday) and hour h, at offset `off`.
export function slotOf(d, h, off) {
  const m = (d * 24 + h) * 60 + off;
  return ((Math.floor(m / 60) % HOURS) + HOURS) % HOURS;
}

// slots → 7 × 24 booleans in local time.
export function localGrid(slots, off) {
  const s = validSlots(slots) ? slots : emptySlots();
  return [...Array(7)].map((_, d) => [...Array(24)].map((_, h) => s[slotOf(d, h, off)] === "1"));
}

// A 7 × 24 local grid back to slots.
export function fromGrid(grid, off) {
  const out = emptySlots().split("");
  grid.forEach((row, d) => row.forEach((on, h) => { if (on) out[slotOf(d, h, off)] = "1"; }));
  return out.join("");
}

// Who's free each local hour: 7 × 24 lists of names. players: [{ name, slots }].
export function overlap(players, off) {
  const grids = players.map((p) => ({ name: p.name, g: localGrid(p.slots, off) }));
  return [...Array(7)].map((_, d) => [...Array(24)].map((_, h) => grids.filter((x) => x.g[d][h]).map((x) => x.name)));
}

// The local hours most of the team is free, best first: [{ d, h, names }], at least `min` free.
export function bestHours(grid, min, n = 5) {
  return grid.flatMap((row, d) => row.map((names, h) => ({ d, h, names })))
    .filter((x) => x.names.length >= min)
    .sort((a, b) => b.names.length - a.names.length || a.d - b.d || a.h - b.h)
    .slice(0, n);
}

// Why an event can't be added, or null.
export function eventProblem({ title, start, minutes }, now = Date.now()) {
  if (!title?.trim()) return "Give it a title.";
  if (title.trim().length > EVENT_TITLE_MAX) return `Keep the title under ${EVENT_TITLE_MAX} characters.`;
  if (!(start instanceof Date) || Number.isNaN(+start)) return "Pick a start time.";
  if (+start <= now) return "That time has already passed.";
  if (+start > now + 60 * 864e5) return "Pick a time within 60 days.";
  if (!EVENT_MINUTES.includes(minutes)) return "Pick a length.";
  return null;
}

// The team's calendar: its own events and its confirmed scrims (scheduler requests it posted or
// won), not yet over, soonest first. team: { div, id }.
export function teamCalendar(events, requests, team, now = Date.now()) {
  const own = (div, id) => div === team.div && String(id) === String(team.id);
  const scrims = requests.filter((r) => r.status === "confirmed" && (own(r.div, r.team) || own(r.opp_div, r.opp_team)))
    .map((r) => ({ kind: "scrim", id: r.id, title: `Scrim vs ${own(r.div, r.team) ? r.opp_name : r.team_name}`, start: r.start, minutes: 60 * r.best_of }));
  const evs = events.filter((e) => own(e.div, e.team)).map((e) => ({ kind: "event", ...e }));
  return [...evs, ...scrims].filter((e) => e.start && +e.start + e.minutes * 6e4 > now).sort((a, b) => a.start - b.start);
}
