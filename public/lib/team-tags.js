// Short team tags ("NI", "SMD"), unique within a league: initials first, then other
// three-letter spellings for teams that would share one. Phones show them where a full name
// won't fit (crosstable, race legend, bracket slots, game facts); desktop keeps the names.

export const teamInitials = (n) => {
  const w = String(n ?? "").split(/[\s-]+/).filter(Boolean);
  return (w.length > 1 ? w.map((x) => x[0]).join("") : String(n ?? "")).slice(0, 3).toUpperCase();
};

// Every league's tags by lowercased name, for spots that only know a name (a fantasy card).
const byName = new Map();
const cache = new WeakMap();

// teams: [{ id, name }]. Returns Map id → tag.
export function teamTags(teams) {
  if (!teams) return new Map();
  if (cache.has(teams)) return cache.get(teams);
  const opts = (n) => {
    const w = n.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    if (!w.length) return ["??"];
    const [a, b = "", c = ""] = w, init = w.map((x) => x[0]).join("");
    return [...new Set([teamInitials(n), init.slice(0, 3), a[0] + b.slice(0, 2), a.slice(0, 2) + (b[0] ?? a[2] ?? ""),
      a.slice(0, 3), a[0] + (b[0] ?? "") + (c[0] ?? b[1] ?? ""), a[0] + a.slice(1).replace(/[AEIOU]/g, "").slice(0, 2)])]
      .filter((t) => t.length >= 2);
  };
  const list = teams.map((t) => [t.id, opts(t.name ?? ""), t.name]);
  const count = new Map(), tags = new Map(), used = new Set();
  for (const [, o] of list) count.set(o[0], (count.get(o[0]) ?? 0) + 1);
  // A team whose initials no one else shares keeps them; the rest take their next free spelling.
  for (const [id, o] of list) if (count.get(o[0]) === 1) { tags.set(id, o[0]); used.add(o[0]); }
  for (const [id, o] of list) {
    if (tags.has(id)) continue;
    let t = o.find((x) => !used.has(x));
    for (let i = 2; !t; i++) if (!used.has(o[0].slice(0, 2) + i)) t = o[0].slice(0, 2) + i;
    tags.set(id, t); used.add(t);
  }
  for (const [id, , name] of list) if (name) byName.set(name.trim().toLowerCase(), tags.get(id));
  cache.set(teams, tags);
  return tags;
}

// The tag for one team: by id within `teams` when given, else any league's tag for that name.
export function tagOf(name, id = null, teams = null) {
  const t = teams && id != null ? teamTags(teams).get(id) : null;
  return t ?? byName.get(String(name ?? "").trim().toLowerCase()) ?? teamInitials(name);
}
