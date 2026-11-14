// "Winter pack cards" panel in the card editor (docs/superpowers/specs/2026-11-13-player-packs-design.md
// section 1.1, 2.3): choose up to 4 saved designs for Winter player packs, each with its bonus stat,
// rate your own, and see which rarity each would be right now.
import { esc } from "../core.js";
import { WINTER, PACK_CARDS_MAX } from "../lib/winter.js";
import { assignSlots, votesFromCounts } from "../lib/player-cards.js";
import { statsFor, bonusPct } from "../lib/card-bonus.js";
import { METRICS } from "../lib/tiers.js";
import { RATINGS, designKey } from "../lib/card-ratings.js";
import { DEFAULT_EQUIPMENT } from "../lib/cosmetics-catalog.js";

const label = (r) => r[0].toUpperCase() + r.slice(1);
const statLabel = (s) => METRICS[s]?.label ?? s;
const ALL_STATS = [...new Set([1, 2, 3, 4, 5].flatMap(statsFor))];
// The default card as saved (saving adds hue 0) can't be a pack card, as in the Worker.
const PLAIN_DESIGN = { ...DEFAULT_EQUIPMENT, hue: 0 }, PLAIN = designKey(PLAIN_DESIGN);
export const isPlainDesign = (d) => !d || designKey({ ...PLAIN_DESIGN, ...d }) === PLAIN;

// The player's main position from the Winter player pool, or null if they aren't in it.
let pool = null;
export function poolPosition(account) {
  pool ??= fetch("data/player-pool.json").then((r) => (r.ok ? r.json() : { players: [] })).catch(() => ({ players: [] }));
  return pool.then((p) => p.players?.find((x) => x.account === Number(account))?.pos ?? null);
}

// One rendered row's "Now:" line from the preview seats.
const nowText = (rarity, pos, main) =>
  `Now: ${label(rarity)}${pos && main ? ` · +${bonusPct(pos, main, rarity, "main")}% ${statLabel(main)}` : ""}`;

// el: container. ctx: { account, pos (1-5 or null), designs (slot -> design|null), slotName(slot),
//   packCards [{slot, main}], fetchCards(account) -> { designs }, act(body) -> { state } | { error } }
export async function renderPackCards(el, ctx) {
  if (Date.now() < WINTER.prepAt) { el.hidden = true; return; }
  el.hidden = false;
  let fetched = [], loadError = "";
  try { fetched = (await ctx.fetchCards(ctx.account)).designs ?? []; } catch (e) { loadError = e.message; }
  const chosen = new Map((ctx.packCards ?? []).map((c) => [c.slot, c.main]));
  // Only designs still nominated count toward the preview.
  const live = fetched.filter((x) => chosen.has(x.slot));
  const seats = assignSlots(live.map((x) => ({ slot: x.slot, votes: votesFromCounts(x.counts), self: x.self, savedAt: x.savedAt })));
  const rarityOf = (slot) => RATINGS.find((r) => seats[r] === slot) ?? null;
  const selfOf = (slot) => fetched.find((x) => x.slot === slot)?.self ?? null;
  const pos = ctx.pos, stats = pos ? statsFor(pos) : ALL_STATS, full = chosen.size >= PACK_CARDS_MAX;
  const rows = ctx.designs.map((d, slot) => {
    if (isPlainDesign(d)) return "";
    const on = chosen.has(slot), main = chosen.get(slot), rarity = rarityOf(slot);
    return `<li data-slot="${slot}">
      <label><input type="checkbox" class="pc-pick" ${on ? "checked" : full ? "disabled" : ""}> ${esc(ctx.slotName(slot))}</label>
      <select class="pc-main" aria-label="Bonus stat">${stats.map((s) => `<option value="${s}" ${main === s ? "selected" : ""}>${esc(statLabel(s))}</option>`).join("")}</select>
      ${on ? `<select class="pc-self" aria-label="Your rating"><option value="">Your rating</option>${RATINGS.map((r) => `<option value="${r}" ${selfOf(slot) === r ? "selected" : ""}>${label(r)}</option>`).join("")}</select>
      <span class="pc-now">${rarity ? nowText(rarity, pos, main) : "Not in a pack slot right now"}</span>` : ""}
    </li>`;
  }).join("");
  el.innerHTML = `<h3>Winter pack cards</h3>
    <p class="muted">Pick up to ${PACK_CARDS_MAX} of your saved designs for Winter player packs and choose each one's bonus stat. Votes decide each card's rarity; your own rating breaks ties.${pos ? "" : " Every stat is listed for now: you'll get a position once you've played league games."}</p>
    ${rows ? `<ul class="pack-cards">${rows}</ul>` : `<p class="muted">Save a card design first.</p>`}
    <p class="pc-default muted">${seats.common === "default" ? "Your common is the default card." : ""}</p>
    <p class="pc-error" role="alert">${esc(loadError)}</p>`;
  const error = (text) => { el.querySelector(".pc-error").textContent = text ?? ""; };
  const lock = () => el.querySelectorAll("input, select").forEach((x) => { x.disabled = true; });
  const save = async () => {
    const cards = [...el.querySelectorAll("li")].filter((li) => li.querySelector(".pc-pick").checked)
      .map((li) => ({ slot: +li.dataset.slot, main: li.querySelector(".pc-main").value }));
    lock();
    const r = await ctx.act({ action: "pack-cards", cards });
    if (r.error) { await renderPackCards(el, ctx); error(r.error); return; }
    ctx.packCards = r.state?.packCards ?? cards;
    renderPackCards(el, ctx);
  };
  el.querySelectorAll(".pc-pick").forEach((x) => x.addEventListener("change", save));
  el.querySelectorAll(".pc-main").forEach((x) => x.addEventListener("change", () => { if (x.closest("li").querySelector(".pc-pick").checked) save(); }));
  el.querySelectorAll(".pc-self").forEach((x) => x.addEventListener("change", async () => {
    lock();
    const r = await ctx.act({ action: "self-rate", cardSlot: +x.closest("li").dataset.slot, rating: x.value || null });
    await renderPackCards(el, ctx);
    if (r.error) error(r.error);
  }));
}
