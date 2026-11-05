// Scrim scheduler (#/scrims/schedule): a team asks for a scrim, other teams answer, the asking
// team picks one. Anyone on an AD2L roster acts for their team, signed in with Steam.
//
// A request is { id, team, team_name, div, open_to: [division keys], start: Date, best_of, note,
// account, status: "open" | "confirmed" | "cancelled" } plus, once confirmed, opp_team,
// opp_name, opp_div and fixture (the scrim_fixtures entry it became, which is what the
// Predict page and the upcoming list show). `div` is the poster's division; open_to the
// divisions whose teams may answer (the poster's own by default).
// An offer is { id: "<request>_<div>_<team>", request, team, team_name, div, start, account }:
// one per answering team per request. Its start is the request's or the time they'd rather.

import { isBye } from "./playoffs.js";

export const MAX_DAYS_AHEAD = 60;
export const NOTE_MAX = 140;
// Fixture team names are capped at 40 characters (rules).
export const fixtureName = (name) => String(name ?? "").trim().slice(0, 40);

export const offerId = (requestId, t) => `${requestId}_${t.div}_${t.id}`;
const same = (a, b) => a.div === b.div && String(a.id) === String(b.id);
const posterOf = (r) => ({ div: r.div, id: r.team });

// Every roster the account is on, as { div, id, name }: one per division it plays in. PlayOn's
// bye-week placeholders list real players, so they're left out.
// leagues: [{ key, data }] with each division's teams.
export function rosterTeams(account, leagues) {
  if (account == null) return [];
  const a = Number(account);
  return leagues.flatMap(({ key, data }) => (data?.teams ?? [])
    .filter((t) => !isBye(t) && t.players?.some((p) => Number(p.account_id) === a))
    .map((t) => ({ div: key, id: t.id, name: t.name })));
}

// Why a new request can't be posted, or null. start: Date; divs: the known division keys.
export function requestProblem({ start, open_to, best_of, note = "" }, divs, now = Date.now()) {
  if (!(start instanceof Date) || Number.isNaN(+start)) return "Pick a start time.";
  if (+start <= now) return "That time has already passed.";
  if (+start > now + MAX_DAYS_AHEAD * 864e5) return `Pick a time within ${MAX_DAYS_AHEAD} days.`;
  if (![1, 2, 3].includes(best_of)) return "Pick a format.";
  if (!open_to?.length) return "Open it to at least one division.";
  if (open_to.some((d) => !divs.includes(d))) return "Unknown division.";
  if (note.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters.`;
  return null;
}

export const isOpen = (r, now = Date.now()) => r.status === "open" && +r.start > now;

// Why team t can't answer request r, or null.
export function offerProblem(r, t, now = Date.now()) {
  if (!isOpen(r, now)) return "This request is closed.";
  if (same(posterOf(r), t)) return "That's your own request.";
  if (!r.open_to.includes(t.div)) return "Not open to your division.";
  return null;
}

// Requests still taking answers, soonest first.
export const openRequests = (requests, now = Date.now()) => requests.filter((r) => isOpen(r, now)).sort((a, b) => a.start - b.start);

// Requests posted by any of `teams` (open ones), with the offers they've had, soonest first.
export function myRequests(requests, offers, teams, now = Date.now()) {
  return openRequests(requests, now).filter((r) => teams.some((t) => same(posterOf(r), t)))
    .map((r) => ({ ...r, offers: offers.filter((o) => o.request === r.id).sort((a, b) => a.start - b.start) }));
}

// Offers `teams` have made, with the request each answers and where it stands:
// "waiting", "won" (confirmed with them), "lost" (confirmed with another team) or "closed".
export function myOffers(requests, offers, teams, now = Date.now()) {
  const byId = new Map(requests.map((r) => [r.id, r]));
  const team = (o) => ({ div: o.div, id: o.team });
  return offers.filter((o) => teams.some((t) => same(team(o), t)) && byId.has(o.request)).map((o) => {
    const r = byId.get(o.request);
    const state = r.status === "confirmed" ? (same({ div: r.opp_div, id: r.opp_team }, team(o)) ? "won" : "lost")
      : isOpen(r, now) ? "waiting" : "closed";
    return { ...o, req: r, state };
  }).filter((o) => o.state !== "closed").sort((a, b) => a.start - b.start);
}

// Scheduled scrims that haven't started yet (or started in the last 3 hours), soonest first.
export const upcomingScrims = (fixtures, now = Date.now()) =>
  fixtures.filter((f) => f.start && +f.start > now - 3 * 3600e3).sort((a, b) => a.start - b.start);
