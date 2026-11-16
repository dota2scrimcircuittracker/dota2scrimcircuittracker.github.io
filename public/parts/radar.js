// Radar of 0–100 tier stats: one outline per player. Used by the Compare tab, the tier
// breakdown and the player overview. `shapes`: [{ name, cls, scores: metric -> 0–100 }], each
// coloured by its class's --pc; `metrics`: the spokes, in order (3 or more).
import { METRICS } from "../lib/tiers.js";
import { esc } from "../core.js";

const R = 100;
const clamp = (v) => Math.max(0, Math.min(100, v));
const xy = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

export function radarSvg(shapes, metrics, label = "Tier stats, 0 to 100") {
  const n = metrics.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [Math.cos(a) * R * v / 100, Math.sin(a) * R * v / 100]; };
  const ring = (v) => metrics.map((_, i) => xy(pt(i, v))).join(" ");
  const grid = [25, 50, 75, 100].map((v) => `<polygon class="radar-grid" points="${ring(v)}"/>`).join("")
    + metrics.map((_, i) => { const [x, y] = pt(i, 100); return `<line class="radar-grid" x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("");
  const labels = metrics.map((m, i) => {
    const [x, y] = pt(i, 116), anchor = Math.abs(x) < 8 ? "middle" : x > 0 ? "start" : "end";
    const label = METRICS[m].label;
    // Long labels ("Damage taken share") break before their last word, so the side spokes
    // stay inside the card on a phone.
    const cut = label.length > 12 ? label.lastIndexOf(" ") : -1;
    const text = cut > 0
      ? `<tspan x="${x.toFixed(1)}" dy="-4">${esc(label.slice(0, cut))}</tspan><tspan x="${x.toFixed(1)}" dy="10">${esc(label.slice(cut + 1))}</tspan>`
      : esc(label);
    return `<text class="radar-label" x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" aria-label="${esc(label)}">${text}</text>`;
  }).join("");
  const shape = ({ name, cls, scores }) => `<g class="${cls}"><polygon class="radar-shape" points="${metrics.map((m, i) => xy(pt(i, clamp(scores[m])))).join(" ")}"/>${metrics.map((m, i) => {
    const [x, y] = pt(i, clamp(scores[m]));
    return `<circle class="radar-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5"><title>${esc(name)} · ${esc(METRICS[m].label)}: ${Math.round(scores[m])}</title></circle>`;
  }).join("")}</g>`;
  return `<svg class="radar" viewBox="-190 -135 380 270" role="img" aria-label="${esc(label)}">${grid}${shapes.map(shape).join("")}${labels}</svg>`;
}

// One player's main-role stats (a tier-list result), metric -> 0–100, in the scoring's order.
export const roleScores = (tp, role = null) => Object.fromEntries(((role ? tp?.roles?.find((r) => r.role === role || r.unit === role) : tp?.roles?.[0])?.stats ?? []).map((s) => [s.metric, s.score]));

