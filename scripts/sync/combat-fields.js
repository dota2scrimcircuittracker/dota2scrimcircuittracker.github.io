import { heroById } from "../../public/lib/hero-meta.js";

// Combat and fun stats from an OpenDota parsed match, shared by the sync and
// scripts/backfill/combat-backfill.js. All null when the replay wasn't parsed. See public/lib/combat.js
// for how the site reads them.

// OpenDota benchmarks kept, in this order (each the percentile, 0-100, of this game's number
// among public games on the same hero). Deaths, denies and healing are left out: their
// percentiles don't read one way (0 healing on a hero that can't heal ranks 95th).
export const BENCH_KEYS = ["gold_per_min", "xp_per_min", "kills_per_min", "assists_per_min", "last_hits_per_min", "hero_damage_per_min", "tower_damage"];

// Count maps keyed by number ("2": 4) -> fixed arrays. Multi-kills: [double, triple, ultra,
// rampage]; anything past 5 counts as a rampage. Streaks: how many times the player reached
// each in-game streak level, [3 killing spree … 10+ beyond godlike].
const counts = (obj, from, to) => {
  if (!obj || typeof obj !== "object") return null;
  const out = Array(to - from + 1).fill(0);
  for (const [k, n] of Object.entries(obj)) {
    const i = Math.min(Number(k), to) - from;
    if (i >= 0) out[i] += n;
  }
  return out;
};

const parsed = (p) => Array.isArray(p.kills_log) || p.actions_per_min != null;

// firstDeath: 1 if this player was first blood's victim, 0 if not (gameExtras works it out).
export function combatFields(p, firstDeath = null) {
  if (!parsed(p)) return { apm: null, tf_part: null, first_blood: null, first_death: null, multi: null, streaks: null, kill_t: null, runes: null, courier_kills: null, max_hit: null, pings: null, bench: null };
  const hit = p.max_hero_hit;
  return {
    apm: p.actions_per_min ?? null,
    // Share of the team's teamfights the player took part in (0-1).
    tf_part: p.teamfight_participation == null ? null : Math.round(p.teamfight_participation * 100) / 100,
    first_blood: p.firstblood_claimed == null ? null : p.firstblood_claimed ? 1 : 0,
    first_death: firstDeath,
    multi: counts(p.multi_kills, 2, 5),
    streaks: counts(p.kill_streaks, 3, 10),
    // Second of each hero kill (last hit), for the kill-streak chart.
    kill_t: Array.isArray(p.kills_log) ? p.kills_log.map((k) => k.time) : null,
    // Runes picked up, a count per type in OpenDota's order (RUNES in public/lib/combat.js).
    runes: p.runes && typeof p.runes === "object" ? counts(p.runes, 0, 9) : null,
    courier_kills: p.courier_kills ?? null,
    // Biggest single hit on an enemy hero: [damage, ability or item key (null = right-click),
    // target hero's image slug (HERO_META), e.g. "vengefulspirit"].
    max_hit: hit?.value ? [hit.value, hit.inflictor ?? null, hit.key?.replace(/^npc_dota_hero_/, "") ?? null] : null,
    pings: p.pings ?? null,
    bench: p.benchmarks ? BENCH_KEYS.map((k) => (p.benchmarks[k]?.pct == null ? null : Math.round(p.benchmarks[k].pct * 100))) : null,
  };
}

// First blood as [second, killer, victim] (indexes into the players in slot order; victim -1 if
// the kill log doesn't name a player's hero), or null without kill logs. The killer is the player
// OpenDota flags (firstblood_claimed), at their first kill; without a flag, the earliest kill.
// (OpenDota's first_blood_time reads 0 whenever the kill came before the horn, so it isn't used.)
export function firstBloodFrom(d) {
  const ps = [...(d.players ?? [])].sort((x, y) => x.player_slot - y.player_slot);
  if (!ps.some((p) => Array.isArray(p.kills_log) && p.kills_log.length)) return null;
  const first = (p) => [...(p.kills_log ?? [])].sort((a, b) => a.time - b.time)[0] ?? null;
  let i = ps.findIndex((p) => p.firstblood_claimed && first(p));
  if (i < 0) i = ps.reduce((b, p, j) => (first(p) && (b < 0 || first(p).time < first(ps[b]).time) ? j : b), -1);
  const k = first(ps[i]);
  const v = ps.findIndex((p) => p.isRadiant !== ps[i].isRadiant && `npc_dota_hero_${heroById(p.hero_id)?.slug}` === k.key);
  return [k.time, i, v];
}

// Game-level: first blood (above) and every pause as flat [second, length, ...].
export function gameExtras(d) {
  return { first_blood_at: firstBloodFrom(d), pauses: Array.isArray(d.pauses) ? d.pauses.flatMap((x) => [x.time, x.duration]) : null };
}
// Each player's first_death flag from a game's first_blood_at.
export const firstDeathOf = (fb, i) => (fb ? (fb[2] === i ? 1 : 0) : null);

// The per-division detail file (loaded on demand by game and hero pages): each player's
// purchases and skill build, per game, in slot order.
//   buy: flat [item key, second, ...]: everything bought except mid-game consumables (they
//        stay when bought before the horn, as the starting items)
//   skills: ability ids in level-up order (public/lib/abilities-data.js names them)
const CONSUMABLE = new Set(["tpscroll", "ward_observer", "ward_sentry", "ward_dispenser", "tango", "tango_single", "clarity", "flask", "smoke_of_deceit", "dust", "enchanted_mango", "faerie_fire", "blood_grenade", "famango", "great_famango", "greater_famango", "bottle_refill"]);
export function detailOf(d) {
  if (!Array.isArray(d.players) || !d.players.some((p) => Array.isArray(p.purchase_log))) return null;
  return [...d.players].sort((x, y) => x.player_slot - y.player_slot).map((p) => ({
    buy: Array.isArray(p.purchase_log) ? p.purchase_log.filter((b) => b.time <= 0 || !CONSUMABLE.has(b.key)).flatMap((b) => [b.key, b.time]) : null,
    skills: Array.isArray(p.ability_upgrades_arr) ? p.ability_upgrades_arr : null,
  }));
}

// The detail file's path next to a division file: ad2l.json -> ad2l-detail.json.
export const detailName = (file) => file.replace(/\.json$/, "-detail.json");
// The detail file's text, games in match id order (ids are past the size JSON sorts as numbers,
// so without this the order would follow whoever wrote the file, and every sync would churn it).
export const detailJson = (detail) => JSON.stringify(Object.fromEntries(Object.entries(detail).sort(([a], [b]) => Number(a) - Number(b)))) + "\n";
