// "Draft by phase": a grid of heroes per draft phase (rows: bans, picks…), each chip carrying three
// readings (count, % of drafts, win %) that a toggle above the grid picks between. Used by the team
// page's Draft tab and the league's Heroes › Draft tab. ph: lib/draft.js teamDraftPhases or
// leagueDraftPhases. rows: [[key, label]]. tip(key, x, i): a chip's hover text.
import { esc, portrait, heroLink } from "../core.js";
import { PHASES } from "../lib/draft.js";
import { info } from "../lib/glossary.js";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const pct0 = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const SHOW = 6;

export function phaseGridHtml(src, ph, rows, { tip, glossary = "draft_by_phase", note } = {}) {
  if (!ph) return "";
  const n = ph.drafted, rec = (x) => `${x.wins}–${x.n - x.wins}`;
  const wr = (x) => x.wins / x.n, tone = (x) => (wr(x) > 0.5 ? "up" : wr(x) < 0.5 ? "down" : "");
  const chip = (key, x, i, j) => `<div class="hero-chip ph-chip${j >= SHOW ? " ph-extra" : ""}" title="${esc(tip(key, x, i))}">
      ${portrait(x.hero)}<span>${heroLink(src, x.hero)}</span>
      <b class="pv pv-n">${key === "picks" ? rec(x) : `×${x.n}`}</b>
      <b class="pv pv-r">${pct0(x.n / n)}</b>
      <b class="pv pv-w ${tone(x)}">${pct0(wr(x))}<small>${rec(x)}</small></b></div>`;
  const cell = (key, list, i) => {
    const t = ph.totals[key][i], heroes = list.length;
    const sum = t.n ? `${plural(t.n, key === "picks" ? "pick" : "ban")} · ${(t.n / n).toFixed(1)} per draft · ${heroes} hero${heroes === 1 ? "" : "es"}` : "None";
    return `<div class="ph-cell"><div class="ph-sum"><b class="ph-mob">Phase ${i + 1} · </b>${sum}</div>
      ${list.length ? `<div class="hero-chips">${list.map((x, j) => chip(key, x, i, j)).join("")}</div>` : ""}
      ${list.length > SHOW ? `<button type="button" class="link-btn ph-more" data-more="${list.length - SHOW}">+${list.length - SHOW} more</button>` : ""}</div>`;
  };
  const line = ([key, label]) => `<div class="ph-row"><div class="ph-label">${label}</div>${ph[key].map((l, i) => cell(key, l, i)).join("")}</div>`;
  const shape = (l) => (l ? `${plural(l.bans, "ban")} · ${plural(l.picks, "pick")}` : "");
  const view = (() => { try { return localStorage.getItem("phaseView") || "n"; } catch { return "n"; } })();
  const seg = ([id, label]) => `<button type="button" class="seg${id === view ? " on" : ""}" data-ph-view="${id}" aria-pressed="${id === view}">${label}</button>`;
  return `<h2>Draft by phase${info(glossary)}</h2>
    <div class="ph-bar">
      <div class="row segs ph-segs" role="group" aria-label="Show">${[["n", "Count"], ["r", "% of drafts"], ["w", "Win %"]].map(seg).join("")}</div>
      <span class="ph-note">${note ?? plural(n, "draft")}</span>
    </div>
    <div class="phase-grid reveal" data-view="${view}">
      <div class="ph-row ph-top"><div class="ph-label"></div>${PHASES.map((p, i) => `<div class="ph-head">Phase ${p}<small>${shape(ph.layout?.[i])} in the whole draft</small></div>`).join("")}</div>
      ${rows.map(line).join("")}
    </div>
`;
}

// The Count / % of drafts / Win % toggle (remembered) and each cell's "+N more".
export function wirePhaseGrid(root) {
  root.querySelector(".ph-segs")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-ph-view]");
    if (!b) return;
    root.querySelector(".phase-grid").dataset.view = b.dataset.phView;
    for (const x of root.querySelectorAll(".ph-segs .seg")) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }
    try { localStorage.setItem("phaseView", b.dataset.phView); } catch {}
  });
  root.querySelectorAll(".ph-more").forEach((b) => (b.onclick = () => {
    const open = b.closest(".ph-cell").classList.toggle("open");
    b.textContent = open ? "Show less" : `+${b.dataset.more} more`;
  }));
}
