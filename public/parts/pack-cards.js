// Winter pack cards on a profile (docs/superpowers/specs/2026-11-13-player-packs-design.md
// section 1, 1.1, 2.3), beside each saved card. A player's first four designs are their pack cards
// automatically (lib/pack-card-list.js); an arcana design is a 5th card. Everyone sees which cards
// are pack cards and the rarity each holds now; the owner picks each one's bonus stat, rates their
// own, and can swap a later design in. Lives under parts/collection.js mountProfileCollection's cards.
import { esc } from "../core.js";
import { WINTER } from "../lib/winter.js";
import { statsFor, bonusText } from "../lib/card-bonus.js";
import { METRICS } from "../lib/tiers.js";
import { RATINGS, isPlainDesign } from "../lib/card-ratings.js";
import { isArcanaDesign, mainOrDefault } from "../lib/pack-card-list.js";
import { packCardView, chipText, stripText, withMain, swapIn, swapArcana, rarityLabel } from "../lib/pack-card-view.js";

const statLabel = (s) => METRICS[s]?.label ?? s;
const ALL_STATS = [...new Set([1, 2, 3, 4, 5].flatMap(statsFor))];
const CLOSES = "Thanksgiving, Nov 26";
const HELP = "Votes set each card's rarity. Your own rating breaks ties. Changing a pack card's design starts its votes over.";

// The player's main position from the Winter player pool, or null if they aren't in it.
let pool = null;
export function poolPosition(account) {
  pool ??= fetch("data/player-pool.json").then((r) => (r.ok ? r.json() : { players: [] })).catch(() => ({ players: [] }));
  return pool.then((p) => p.players?.find((x) => x.account === Number(account))?.pos ?? null);
}

// One bonus option: "+14% Kill share" at this rarity for the player's position, else the stat name.
const optionText = (pos, stat, rarity) => (pos ? bonusText(pos, stat, rarity ?? "common") : statLabel(stat));

// section: the profile's .profile-collection. own: the viewer is this player.
// designs: their saved designs by slot. nameOf(slot): a slot's card name ("Card 2").
// fetchCards(account) -> /player-cards answer. act(action, details) -> Worker reply; throws with a message.
export async function mountPackCards(section, { account, own, designs, nameOf = (s) => `Card ${s + 1}`, fetchCards, act }) {
  if (Date.now() < WINTER.prepAt) return;
  const figOf = (slot) => section.querySelector(`[data-design-slot="${slot}"]`)?.closest("figure");
  let res, loadError = "";
  try { res = await fetchCards(account); } catch (e) { loadError = e.message; }
  if (!section.isConnected) return;
  const pos = own ? await poolPosition(account) : null;
  let view = res ? packCardView(res, designs) : null;
  let strip = null;
  if (own) {
    strip = document.createElement("div");
    strip.className = "pc-strip";
    section.querySelector(".profile-card-designs")?.before(strip);
  }

  const clear = () => {
    section.querySelectorAll(".pc-chip, .pc-foot").forEach((x) => x.remove());
    section.querySelectorAll("figure.pc-picked").forEach((x) => x.classList.remove("pc-picked"));
  };
  // A chip above the rating block (the rating redraws itself at the figure's end).
  const putChip = (fig, card, locked) => {
    const chip = document.createElement("p");
    chip.className = "pc-chip";
    chip.innerHTML = `<b data-rarity="${card.rarity ?? ""}">${esc(chipText(card, { locked, own: false }))}</b>`;
    const before = fig.querySelector(".card-rating");
    if (before) before.before(chip); else fig.append(chip);
  };
  // The bonus select. With no stat and no position yet, it asks.
  const bonusSelect = (card, stats) => {
    const main = mainOrDefault(card.main, pos), off = main && !stats.includes(main);
    return `<label class="pc-bonus"><span>Bonus</span><select aria-label="Bonus stat">${main ? "" : `<option value="" selected disabled>Choose a bonus</option>`}${stats.map((s) => `<option value="${esc(s)}" ${main === s ? "selected" : ""}>${esc(optionText(pos, s, card.rarity))}</option>`).join("")}${off ? `<option value="${esc(main)}" selected>${esc(optionText(pos, main, card.rarity))}</option>` : ""}</select></label>`;
  };

  const draw = () => {
    clear();
    const locked = view?.locked || (!view && Date.now() >= WINTER.votesCloseAt);
    if (strip) {
      const line = view ? stripText(view, { closesText: CLOSES }) : locked ? "Winter pack cards are locked." : "Winter pack cards";
      strip.innerHTML = `<p class="pc-strip-line"><b>${esc(line)}</b>${view?.defaultCommon ? " · Your common is the default card." : ""}</p>
        ${!locked && view ? `<p class="pc-strip-help">${esc(HELP)}${pos ? "" : " Every stat is listed for now: you'll get a position once you've played league games."}</p>` : ""}
        <p class="pc-error" role="alert">${esc(loadError)}</p>`;
    }
    if (!view) return;
    const all = [...view.cards, ...(view.arcana ? [[view.arcana.slot, view.arcana]] : [])];
    // Visitors, and everyone once locked: chips only.
    if (!own || locked) {
      for (const [slot, card] of all) { const fig = figOf(slot); if (fig) putChip(fig, card, locked); }
      return;
    }
    const stats = pos ? statsFor(pos) : ALL_STATS;
    designs.forEach((d, slot) => {
      const fig = figOf(slot);
      if (!fig || isPlainDesign(d)) return;
      const card = view.cards.get(slot) ?? (view.arcana?.slot === slot ? view.arcana : null);
      const foot = document.createElement("div");
      foot.className = "pc-foot";
      foot.dataset.slot = slot;
      if (card) {
        fig.classList.add("pc-picked");
        const voted = card.rarity !== "arcana";
        foot.innerHTML = `<p class="pc-rarity"><b data-rarity="${card.rarity ?? ""}">${esc(chipText(card, { locked: false, own: true }))}</b></p>
          ${bonusSelect(card, stats)}
          ${voted ? `<div class="pc-self-wrap"><span>Your rating</span><div class="card-rating-votes pc-self" role="group" aria-label="Your rating">${RATINGS.map((r) => `<button type="button" data-self="${r}" data-rarity="${r}" aria-pressed="${card.self === r}" title="${card.self === r ? "Clear your rating" : `Rate it ${rarityLabel(r)}`}">${rarityLabel(r)}</button>`).join("")}</div></div>` : ""}
          <p class="pc-error" role="alert"></p>`;
        foot.querySelector("select").onchange = (e) => e.target.value && save(foot, withMain(view, slot, e.target.value));
        foot.querySelectorAll("[data-self]").forEach((b) => b.onclick = () =>
          send(foot, "self-rate", { cardSlot: slot, rating: b.getAttribute("aria-pressed") === "true" ? null : b.dataset.self }));
      } else if (isArcanaDesign(d)) {
        foot.innerHTML = `<button type="button" class="pc-swap">Swap in as arcana</button><p class="pc-error" role="alert"></p>`;
        foot.querySelector(".pc-swap").onclick = () => save(foot, swapArcana(view, slot));
      } else if (view.order.length) {
        // Sits out (Card 5 and above): swap it in for one of the four, picked inline.
        foot.innerHTML = `<button type="button" class="pc-swap" aria-expanded="false">Swap in…</button>
          <div class="pc-swap-pick" hidden><span>Replace</span>${view.order.map((s) => `<button type="button" data-replace="${s}">${esc(nameOf(s))}</button>`).join("")}<button type="button" class="pc-swap-cancel">Cancel</button></div>
          <p class="pc-error" role="alert"></p>`;
        const toggle = foot.querySelector(".pc-swap"), pick = foot.querySelector(".pc-swap-pick");
        const open = (on) => { pick.hidden = !on; toggle.hidden = on; toggle.setAttribute("aria-expanded", String(on)); };
        toggle.onclick = () => { open(true); pick.querySelector("button")?.focus(); };
        foot.querySelector(".pc-swap-cancel").onclick = () => { open(false); toggle.focus(); };
        pick.querySelectorAll("[data-replace]").forEach((b) => b.onclick = () => save(foot, swapIn(view, slot, Number(b.dataset.replace))));
      } else return;
      fig.append(foot);
    });
  };

  // Every change saves straight away; afterwards every chip is refreshed, since one contest can move others.
  const send = async (foot, action, details) => {
    section.querySelectorAll(".pc-foot button, .pc-foot select").forEach((x) => { x.disabled = true; });
    let error = "";
    try { await act(action, details); } catch (e) { error = e.message; }
    try { res = await fetchCards(account); view = packCardView(res, designs); loadError = ""; } catch (e) { error ||= e.message; }
    if (!section.isConnected) return;
    draw();
    if (error) {
      const at = section.querySelector(`.pc-foot[data-slot="${foot.dataset.slot}"] .pc-error`) ?? strip?.querySelector(".pc-error");
      if (at) at.textContent = error;
    }
  };
  const save = (foot, payload) => send(foot, "pack-cards", payload);
  draw();
}
