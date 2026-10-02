// Laning fields per player from an OpenDota match player (see public/lib/lanes.js):
// lane_role 1 safe / 2 mid / 3 off / 4 jungle, roaming, last hits and denies at 10 minutes.
// Null when the replay isn't parsed.
export const laneFields = (p) => ({
  lane_role: p.lane_role ?? null,
  roaming: p.is_roaming ?? null,
  lh10: Array.isArray(p.lh_t) ? p.lh_t[10] ?? null : null,
  dn10: Array.isArray(p.dn_t) ? p.dn_t[10] ?? null : null,
});
