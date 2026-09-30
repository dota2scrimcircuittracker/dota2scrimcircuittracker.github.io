// Names the site shows in place of a player's own, everywhere (a league joke): rosters, games,
// search, link previews. By account id. The names they go by in game are in aliases.js, so
// uploads and scrims under those names get this one too; search finds them by this name only.
export const NICKNAMES = { 19192564: "[REDACTED]" };

const nick = (p) => (p?.account_id != null && NICKNAMES[p.account_id]) || null;

// A division data file with the nicknames in: roster players and players in games. In place.
export function withNicknames(d) {
  for (const t of d.teams ?? []) for (const p of t.players ?? []) p.name = nick(p) ?? p.name;
  for (const g of d.games ?? []) for (const p of g.players ?? []) p.name = nick(p) ?? p.name;
  return d;
}
