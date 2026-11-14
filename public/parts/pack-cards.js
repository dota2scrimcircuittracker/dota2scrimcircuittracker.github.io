// Winter pack cards on a profile (docs/superpowers/specs/2026-11-13-player-packs-design.md
// section 1, 1.1, 2.3). A player's first four designs are their pack cards automatically
// (lib/pack-card-list.js). The profile's cards stay clean: only the owner sees one line above them
// and a "Manage pack cards" button, which opens a dialog listing the four (rarity now, bonus stat,
// their own rating, lock), the designs sitting out (Card 5+, swap in) and any arcana pack cards from
// the Arcana Cup podium (lib/arcana-cup.js arcanaCards). After the Thanksgiving close the dialog is
// read-only. Visitors see nothing. Lives under parts/collection.js mountProfileCollection's cards.
import { esc } from "../core.js";
import { WINTER } from "../lib/winter.js";
import { statsFor, bonusText } from "../lib/card-bonus.js";
import { METRICS } from "../lib/tiers.js";
import { RATINGS, isPlainDesign } from "../lib/card-ratings.js";
import { mainOrDefault } from "../lib/pack-card-list.js";
import { packCardView, stripText, withMain, withArcanaMain, swapIn, swapTargets, lockable, arcanaPlaceText, rarityLabel } from "../lib/pack-card-view.js";

const statLabel = (s) => METRICS[s]?.label ?? s;
const ALL_STATS = [...new Set([1, 2, 3, 4, 5].flatMap(statsFor))];
const CLOSES = "Thanksgiving, Nov 26";
const HELP = "Votes set each card's rarity. Your rating breaks ties. Changing a pack card's design starts its votes over.";
const LOCK_CONFIRM = "Lock this card? You can't change its design, bonus or swap it out until packs open on Dec 1.";
const PADLOCK = `<svg class="pc-padlock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>`;

// The player's main position from the Winter player pool, or null if they aren't in it.
let pool = null;
export function poolPosition(account) {
  pool ??= fetch("data/player-pool.json").then((r) => (r.ok ? r.json() : { players: [] })).catch(() => ({ players: [] }));
  return pool.then((p) => p.players?.find((x) => x.account === Number(account))?.pos ?? null);
}

// One bonus option: "+14% Kill share" at this rarity for the player's position, else the stat name.
const optionText = (pos, stat, rarity) => (pos ? bonusText(pos, stat, rarity ?? "common") : statLabel(stat));
// A card's rarity as a small coloured word: "Epic now", "Epic" once frozen, or no slot.
const rarityText = (rarity, frozen) => (rarity ? `${rarityLabel(rarity)}${frozen || rarity === "arcana" ? "" : " now"}` : "No slot right now");

// section: the profile's .profile-collection. own: the viewer is this player (visitors get nothing).
// designs: their saved designs by slot. nameOf(slot): a slot's card name ("Card 2").
// cardHtml(design) -> a card's HTML, for the dialog's thumbnails (optional); fit(el) sizes them.
// fetchCards(account) -> /player-cards answer. act(action, details) -> Worker reply; throws with a message.
export async function mountPackCards(section, { account, own, designs, nameOf = (s) => `Card ${s + 1}`, cardHtml = null, fit = () => {}, fetchCards, act }) {
  if (!own || Date.now() < WINTER.prepAt) return;
  let res, loadError = "";
  try { res = await fetchCards(account); } catch (e) { loadError = e.message; }
  if (!section.isConnected) return;
  const pos = await poolPosition(account);
  let view = res ? packCardView(res, designs) : null;
  let dialog = null;

  const line = document.createElement("div");
  line.className = "pc-line";
  section.querySelector(".profile-card-designs")?.before(line);

  const isLocked = () => view?.locked || (!view && Date.now() >= WINTER.votesCloseAt);
  const drawLine = () => {
    const locked = isLocked();
    const text = view ? stripText(view, { closesText: CLOSES }) : locked ? "Winter pack cards are locked." : "Winter pack cards";
    line.innerHTML = `<p>${esc(text)}</p>${view ? `<button type="button" class="pc-manage">${locked ? "View pack cards" : "Manage pack cards"}</button>` : ""}<p class="pc-error" role="alert">${esc(loadError)}</p>`;
    const b = line.querySelector(".pc-manage");
    if (b) b.onclick = openDialog;
  };

  // A small card picture for a row, or an empty box without a renderer.
  const thumb = (design) => (cardHtml && design ? `<div class="pc-thumb" aria-hidden="true">${cardHtml(design)}</div>` : `<div class="pc-thumb pc-thumb-empty" aria-hidden="true"></div>`);
  // The bonus select. With no stat and no position yet, it asks. disabled: a locked card. After the
  // close (editable false): the stat as text.
  const bonus = (card, stats, editable, disabled = false) => {
    const main = mainOrDefault(card.main, pos);
    if (!editable) return main ? `<p class="pc-bonus-text">Bonus: ${esc(optionText(pos, main, card.rarity))}</p>` : "";
    const off = main && !stats.includes(main);
    return `<label class="pc-bonus"><span>Bonus</span><select aria-label="Bonus stat"${disabled ? " disabled" : ""}>${main ? "" : `<option value="" selected disabled>Choose a bonus</option>`}${stats.map((s) => `<option value="${esc(s)}" ${main === s ? "selected" : ""}>${esc(optionText(pos, s, card.rarity))}</option>`).join("")}${off ? `<option value="${esc(main)}" selected>${esc(optionText(pos, main, card.rarity))}</option>` : ""}</select></label>`;
  };

  const drawBody = () => {
    const body = dialog.querySelector(".tm-body");
    const locked = isLocked(), stats = pos ? statsFor(pos) : ALL_STATS;
    dialog.querySelector(".tm-title small").textContent = locked ? "Locked" : `Voting closes ${CLOSES}`;
    const now = Date.now(), targets = locked ? [] : swapTargets(view);
    const help = locked
      ? `<p class="pc-help">Winter pack cards are locked. These are the cards and bonuses going into packs.</p>`
      : `<p class="pc-help">${esc(HELP)}${pos ? "" : " Every stat is listed for now: you'll get a position once you've played league games."}${view.defaultCommon ? " Your common is the default card." : ""}</p>`;
    const packRows = view.order.map((slot) => {
      const card = view.cards.get(slot), cardLocked = view.locks.has(slot);
      const canLock = !locked && lockable(view, slot, now, WINTER.opensAt);
      return `<li class="pc-row" data-slot="${slot}">
        ${thumb(designs[slot])}
        <div class="pc-info"><strong>${esc(nameOf(slot))}</strong><span class="pc-rarity" data-rarity="${card.rarity ?? ""}">${esc(rarityText(card.rarity, locked))}</span>${locked && card.changed ? `<small>Design changed since</small>` : ""}${cardLocked && !locked ? `<span class="pc-locked">${PADLOCK}Locked</span>` : ""}</div>
        <div class="pc-controls">
          ${bonus(card, stats, !locked, cardLocked)}
          ${locked ? "" : `<div class="pc-self-wrap"><span>Your rating</span><div class="card-rating-votes pc-self" role="group" aria-label="Your rating for ${esc(nameOf(slot))}">${RATINGS.map((r) => `<button type="button" data-self="${r}" data-rarity="${r}" aria-pressed="${card.self === r}" title="${card.self === r ? "Clear your rating" : `Rate it ${rarityLabel(r)}`}">${rarityLabel(r)}</button>`).join("")}</div></div>`}
          ${canLock ? `<button type="button" class="pc-lock">${PADLOCK}Lock</button>` : ""}
          <p class="pc-error" role="alert"></p>
        </div></li>`;
    }).join("");
    // Designs sitting out (Card 5 and above), while they can still swap in.
    const out = locked ? [] : designs.map((d, slot) => [d, slot]).filter(([d, slot]) => d && !isPlainDesign(d) && !view.cards.has(slot));
    const outRows = out.map(([d, slot]) => `<li class="pc-row" data-slot="${slot}">
        ${thumb(d)}
        <div class="pc-info"><strong>${esc(nameOf(slot))}</strong><span class="pc-muted">Not in packs</span></div>
        <div class="pc-controls">${targets.length ? `<button type="button" class="pc-swap" aria-expanded="false">Swap in…</button>
          <div class="pc-swap-pick" hidden><span>Replace</span>${targets.map((s) => `<button type="button" data-replace="${s}">${esc(nameOf(s))}</button>`).join("")}<button type="button" class="pc-swap-cancel">Cancel</button></div>` : `<span class="pc-muted">All four are locked</span>`}
          <p class="pc-error" role="alert"></p></div></li>`).join("");
    const arcanaRows = view.arcana.map((a) => `<li class="pc-row" data-entry="${esc(a.entry)}">
        ${thumb(a.design)}
        <div class="pc-info"><strong>${esc(arcanaPlaceText(a))}</strong><span class="pc-rarity" data-rarity="arcana">Arcana</span></div>
        <div class="pc-controls">${bonus(a, stats, !locked)}<p class="pc-error" role="alert"></p></div></li>`).join("");
    body.innerHTML = `${help}<p class="pc-error pc-body-error" role="alert"></p>
      <h4>Pack cards</h4><ul class="pc-rows">${packRows}</ul>
      ${outRows ? `<h4>Not in packs</h4><ul class="pc-rows">${outRows}</ul>` : ""}
      ${arcanaRows ? `<h4>Arcana pack cards</h4><ul class="pc-rows">${arcanaRows}</ul>` : ""}`;
    body.querySelectorAll(".pc-thumb").forEach((t) => { t.querySelectorAll("button").forEach((b) => b.remove()); fit(t); });
    if (locked) return;
    body.querySelectorAll(".pc-row[data-slot]").forEach((row) => {
      const slot = Number(row.dataset.slot);
      const select = row.querySelector("select");
      if (select && !select.disabled) select.onchange = (e) => e.target.value && send(row, "pack-cards", withMain(view, slot, e.target.value));
      row.querySelectorAll("[data-self]").forEach((b) => b.onclick = () =>
        send(row, "self-rate", { cardSlot: slot, rating: b.getAttribute("aria-pressed") === "true" ? null : b.dataset.self }));
      const lock = row.querySelector(".pc-lock");
      if (lock) lock.onclick = () => { if (confirm(LOCK_CONFIRM)) send(row, "pack-lock", { slot }); };
      const toggle = row.querySelector(".pc-swap"), pick = row.querySelector(".pc-swap-pick");
      if (toggle && pick) {
        const open = (on) => { pick.hidden = !on; toggle.hidden = on; toggle.setAttribute("aria-expanded", String(on)); };
        toggle.onclick = () => { open(true); pick.querySelector("button")?.focus(); };
        row.querySelector(".pc-swap-cancel").onclick = () => { open(false); toggle.focus(); };
        pick.querySelectorAll("[data-replace]").forEach((b) => b.onclick = () => send(row, "pack-cards", swapIn(view, slot, Number(b.dataset.replace))));
      }
    });
    body.querySelectorAll(".pc-row[data-entry]").forEach((row) => {
      const select = row.querySelector("select");
      if (select) select.onchange = (e) => e.target.value && send(row, "pack-cards", withArcanaMain(view, row.dataset.entry, e.target.value));
    });
  };

  // The site's modal (style.css dialog.tier-modal): a head with the title and ×, a scrolling body.
  // The page can't scroll behind it; Escape, × or a click on the backdrop closes it.
  function openDialog() {
    document.getElementById("pc-dialog")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<dialog class="tier-modal pc-dialog" id="pc-dialog" aria-labelledby="pc-dialog-h">
      <div class="tm-head"><div class="tm-title"><h3 id="pc-dialog-h">Winter pack cards</h3><small></small></div><button type="button" class="tm-close" aria-label="Close">×</button></div>
      <div class="tm-body"></div></dialog>`);
    const dlg = document.getElementById("pc-dialog"), root = document.documentElement;
    dialog = dlg;
    // Cleanup follows the `open` attribute (as pages/player.js does): the close event can wait for a repaint.
    new MutationObserver(() => { if (dlg.open) return; root.classList.remove("modal-open"); dlg.remove(); if (dialog === dlg) dialog = null; })
      .observe(dlg, { attributes: true, attributeFilter: ["open"] });
    dlg.querySelector(".tm-close").onclick = () => dlg.close();
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    drawBody();
    root.classList.add("modal-open");
    dlg.showModal();
  }

  // Every change saves straight away; afterwards the whole list is refreshed, since one contest can move
  // others. at: the row the change came from (its error line shows a refusal).
  const send = async (at, action, details) => {
    dialog?.querySelectorAll(".tm-body button, .tm-body select").forEach((x) => { x.disabled = true; });
    let error = "";
    try { await act(action, details); } catch (e) { error = e.message; }
    try { res = await fetchCards(account); view = packCardView(res, designs); loadError = ""; } catch (e) { error ||= e.message; }
    if (section.isConnected) drawLine();
    if (!dialog) return;
    drawBody();
    if (error) {
      const sel = at.dataset.entry != null ? `.pc-row[data-entry="${CSS.escape(at.dataset.entry)}"] .pc-error` : `.pc-row[data-slot="${at.dataset.slot}"] .pc-error`;
      const where = dialog.querySelector(sel) ?? dialog.querySelector(".pc-body-error");
      if (where) where.textContent = error;
    }
  };
  drawLine();
}
