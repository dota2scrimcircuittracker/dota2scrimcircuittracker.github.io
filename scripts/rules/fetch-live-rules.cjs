// Read-only: fetch the Firestore rules that are live now, save them to %TEMP%/live.rules, and
// say whether they match the Cookbook working copy (where the shared ruleset is deployed from).
// Run before deploying rules. Uses the Firebase CLI login.
// Usage: node scripts/rules/fetch-live-rules.cjs
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { Client } = require("firebase-tools/lib/apiv2");
const fs = require("fs");
(async () => {
  const acct = require("firebase-tools/lib/auth").getGlobalDefaultAccount(); console.log("as", acct?.user?.email); await requireAuth({ project: "pistachio-kitchen", user: acct.user, tokens: acct.tokens });
  const c = new Client({ urlPrefix: "https://firebaserules.googleapis.com", apiVersion: "v1" });
  const rel = (await c.get("/projects/pistachio-kitchen/releases/cloud.firestore")).body;
  const rs = (await c.get("/" + rel.rulesetName)).body;
  const live = rs.source.files[0].content.replace(/\r/g, "");
  const local = fs.readFileSync("C:/Users/Jonah/OneDrive/Desktop/Cookbook/firestore.rules", "utf8").replace(/\r/g, "");
  fs.writeFileSync(process.env.TEMP + "/live.rules", live);
  console.log("release", rel.rulesetName, "updated", rel.updateTime);
  console.log("live", live.length, "local", local.length, "identical:", live === local);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
