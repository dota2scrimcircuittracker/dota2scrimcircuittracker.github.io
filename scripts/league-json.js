// The division files' JSON layout: pretty-printed, but flat arrays of numbers (the per-minute
// series) and of item keys / numbers / nulls (items, item_times) stay on one line.
export function leagueJson(out) {
  const el = String.raw`(?:-?\d+(?:\.\d+)?|"[a-z0-9_]*"|null)`;
  const flat = new RegExp(String.raw`\[\s*(${el}(?:\s*,\s*${el})*)\s*\]`, "g");
  return JSON.stringify(out, null, 1).replace(flat, (_, xs) => `[${xs.replace(/\s+/g, "")}]`) + "\n";
}
