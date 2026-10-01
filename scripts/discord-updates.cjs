// Post a short "site updated" note to Discord after a push to main deploys (pages.yml, announce job).
// One bullet per commit in the push: its subject line, or the text of a "Discord: ..." line in the
// commit body when there is one. Data syncs (github-actions[bot]) and commits with
// [skip announce] in the message are left out. Nothing to say → nothing posted.
//
//   node scripts/discord-updates.cjs [--dry-run] [BEFORE AFTER]
//
// In Actions: BEFORE/AFTER from the push event, DISCORD_UPDATES_WEBHOOK from the repo secret.
// Locally: the webhook from .env.local; --dry-run prints the message instead of posting.
const { execFileSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://dota2scrimcircuittracker.github.io/";
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const [argBefore, argAfter] = args.filter((a) => !a.startsWith("--"));

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });
const esc = (x) => String(x).replace(/[\\`*_~|>#\[\]()<@-]/g, "\\$&");
const clip = (x, n) => (x.length > n ? x.slice(0, n - 1) + "…" : x);

function commits(before, after) {
  // A new branch or force push has no usable "before": announce the head commit alone.
  let range = [`${before}..${after}`];
  try { if (/^0+$/.test(before)) throw 0; git("cat-file", "-e", `${before}^{commit}`); } catch { range = ["-1", after]; }
  return git("log", "--reverse", "--format=%an%x1f%s%x1f%b%x1e", ...range)
    .split("\x1e").map((r) => r.trim()).filter(Boolean)
    .map((r) => { const [author, subject, body = ""] = r.split("\x1f"); return { author, subject, body }; });
}

function bullets(list) {
  const out = [];
  for (const c of list) {
    if (c.author === "github-actions[bot]" || /^Sync AD2L data/.test(c.subject)) continue;
    if (/\[(skip|no) announce\]/i.test(c.subject + c.body)) continue;
    const custom = c.body.split("\n").map((l) => l.match(/^Discord:\s*(.+)/i)?.[1]).filter(Boolean);
    out.push(...(custom.length ? custom : [c.subject]));
  }
  return out;
}

async function main() {
  const before = argBefore ?? process.env.BEFORE;
  const after = argAfter ?? process.env.AFTER ?? "HEAD";
  if (!before) throw new Error("usage: discord-updates.cjs [--dry-run] BEFORE AFTER (or BEFORE/AFTER env)");
  const lines = bullets(commits(before, after));
  if (!lines.length) return console.log("Nothing to announce (data syncs or [skip announce] only).");

  let desc = "";
  for (const [i, l] of lines.entries()) {
    const next = (desc ? desc + "\n" : "") + `• ${clip(esc(l), 300)}`;
    if (next.length > 3800) { desc += `\n…and ${lines.length - i} more.`; break; }
    desc = next;
  }
  const body = {
    embeds: [{ title: "Site updated", url: SITE, description: desc, color: 0x57f287, timestamp: new Date().toISOString() }],
    allowed_mentions: { parse: [] },
  };
  if (dry) return console.log(JSON.stringify(body, null, 2));

  if (!process.env.DISCORD_UPDATES_WEBHOOK) { try { process.loadEnvFile(path.join(ROOT, ".env.local")); } catch {} }
  const hook = process.env.DISCORD_UPDATES_WEBHOOK?.trim();
  if (!hook) return console.log("No DISCORD_UPDATES_WEBHOOK; not posting.");
  if (!/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(hook)) throw new Error("DISCORD_UPDATES_WEBHOOK isn't a Discord webhook URL.");
  const r = await fetch(hook + "?wait=true", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Discord webhook ${r.status}: ${clip(await r.text(), 300)}`);
  console.log(`Posted ${lines.length} update${lines.length === 1 ? "" : "s"}.`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
