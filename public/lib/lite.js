// A division file trimmed for the pages that only need its ranks: the overall stat leaders,
// player and hero ranks across every league, and the header search. Drops what only that
// division's own pages draw (timelines, ward and building maps, items, pubs) and keeps every
// field the stat and rating code reads. test/lite.test.js checks the ranks come out the same.
// Written at deploy by scripts/deploy/lite-data.js as data/<division>-lite.json.
import { LANE_END_MIN } from "./lanes.js";

const GAME_DROP = ["buildings", "objectives", "xp_adv", "gold_adv", "fights", "pauses", "vision", "fight_smokes"];
const PLAYER_DROP = ["sen_pos", "items", "item_times", "networth_t", "max_hit", "bench", "smoke_kill_t", "xp_t", "tf_dmg"];

export function liteDivision(d) {
  const { pubs, ...rest } = d;
  return {
    ...rest,
    games: d.games.map((g) => {
      const out = { ...g };
      for (const k of GAME_DROP) delete out[k];
      if (g.players) out.players = g.players.map((p) => {
        const q = { ...p };
        for (const k of PLAYER_DROP) delete q[k];
        // The laning numbers read gold at the end of the laning stage only.
        if (Array.isArray(q.gold_t)) q.gold_t = q.gold_t.slice(0, LANE_END_MIN + 1);
        return q;
      });
      return out;
    }),
  };
}

// A division file trimmed for Wrapped (pages/wrapped.js): drops what no Wrapped card reads
// (pubs, per-minute XP and net worth, teamfight damage, final items, XP lead, pauses). Teamfight
// damage is swapped for the estimated assists by five minutes the most-active-time card reads
// (assist_bins: up to 9 counts, the last 40:00+).
// Wrapped loads every division at once, so this is most of its download. Item timings,
// biggest hits, maps and the draft stay. Written at deploy as data/<division>-wrapped.json
// (scripts/deploy/lite-data.js); test/lite.test.js checks every Wrapped comes out the same.
const WRAP_GAME_DROP = ["xp_adv", "pauses", "fight_smokes"];
const WRAP_PLAYER_DROP = ["xp_t", "networth_t", "tf_dmg", "items"];
// A player's assists by five minutes of game time (9 counts, the last 40:00+), estimated: OpenDota
// logs who got each kill, not who assisted, so an assist is a teammate's kill inside a teamfight
// they dealt damage in (tf_dmg windows, 3s either side). That finds about 85% of their real
// assists (S48: Champion, Heroic, Warrior). Reads assist_bins when the Wrapped copy already worked
// it out. Null without teamfights. m: the game, p: one of its players.
export function assistBins(m, p) {
  if (Array.isArray(p.assist_bins)) return p.assist_bins;
  const f = p.tf_dmg;
  if (!Array.isArray(f)) return null;
  const win = [], bins = Array(9).fill(0);
  for (let i = 0; i + 2 < f.length; i += 3) win.push([f[i] - 3, f[i + 1] + 3]);
  for (const q of m.players ?? []) if (q !== p && q.team === p.team) for (const t of q.kill_t ?? []) if (win.some(([x, y]) => t >= x && t <= y)) bins[Math.min(8, Math.max(0, Math.floor(t / 300)))]++;
  return bins;
}
export function wrappedDivision(d) {
  const { pubs, ...rest } = d;
  return {
    ...rest,
    games: d.games.map((g) => {
      const out = { ...g };
      for (const k of WRAP_GAME_DROP) delete out[k];
      if (g.players) out.players = g.players.map((p) => {
        const q = { ...p };
        // Trailing empty five minutes dropped (most games end before 40:00).
        if (Array.isArray(p.tf_dmg)) { const b = assistBins(g, p); while (b.length && !b[b.length - 1]) b.pop(); q.assist_bins = b; }
        for (const k of WRAP_PLAYER_DROP) delete q[k];
        return q;
      });
      return out;
    }),
  };
}
