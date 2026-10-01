// Sync every division in public/lib/divisions.js, one after another. A division that fails
// (PlayOn down, OpenDota rate limit) doesn't stop the others; the failed ones are listed at
// the end and the exit code is 1. In GitHub Actions each division's log is a collapsible
// group, and the failed keys go to $GITHUB_ENV as FAILED for a later step to report.
// Usage: npm run sync:all
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DIVISIONS } from "../../public/lib/divisions.js";

const sync = fileURLToPath(new URL("./ad2l-sync.js", import.meta.url));
const failed = [];
for (const { key } of DIVISIONS) {
  console.log(`::group::${key}`);
  const r = spawnSync(process.execPath, [sync, "--division", key], { stdio: "inherit" });
  console.log("::endgroup::");
  if (r.status !== 0) failed.push(key);
}
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `FAILED=${failed.join(" ")}\n`);
if (failed.length) { console.error(`Sync failed for: ${failed.join(", ")}`); process.exit(1); }
