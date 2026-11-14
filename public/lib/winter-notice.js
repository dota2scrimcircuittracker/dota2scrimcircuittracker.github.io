// Winter player packs notice: once per visitor, from the prep launch until a week after packs open.
// Same card and timing as the Arcana Cup notice (cup-notice.js), and it waits for that one to go.
import { WINTER } from "./winter.js";

const SEEN_KEY = "winter-packs-notice-1";

export const shouldShowWinterNotice = (now, seen, w = WINTER) => !seen && now >= w.prepAt && now < w.opensAt + 7 * 864e5;

function seen() { try { return !!localStorage.getItem(SEEN_KEY); } catch { return false; } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* not remembered */ } }

let card = null;
function close() { markSeen(); card?.remove(); card = null; }

function show(go) {
  if (card || !shouldShowWinterNotice(Date.now(), seen())) return;
  const open = Date.now() >= WINTER.opensAt;
  card = document.createElement("div");
  card.className = "tour-invite cup-notice winter-notice";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "Winter player packs");
  card.innerHTML = `<b>${open ? "Player packs are here" : "Coming for Winter: player packs"}</b>
    <span>${open ? "Open your free packs and build your Winter Fantasy team."
      : "Winter Fantasy uses player cards. Pick up to 4 of your card designs as your pack cards and choose each one's bonus. Votes set their rarity."}</span>
    <div class="tour-btns"><button type="button" class="tour-btn winter-later">Later</button><button type="button" class="tour-btn tour-primary winter-go">${open ? "Open packs" : "Choose my pack cards"}</button></div>`;
  card.querySelector(".winter-later").onclick = close;
  card.querySelector(".winter-go").onclick = () => { close(); go(open ? "#/gallery/packs" : "#/gallery/customize"); };
  document.body.append(card);
}

// go(href) navigates in-app.
export function initWinterNotice({ go }) {
  if (!shouldShowWinterNotice(Date.now(), seen())) return;
  // After the first page renders, and never on top of the tour, its invite or the Cup notice.
  const wait = Date.now() + 8000;
  const tick = () => {
    if (!shouldShowWinterNotice(Date.now(), seen())) return;
    const busy = document.querySelector(".tour-invite") || document.body.classList.contains("touring") || document.body.classList.contains("tour-pick");
    if (busy || (!document.getElementById("app")?.children.length && Date.now() < wait)) return void setTimeout(tick, 1000);
    setTimeout(() => show(go), 1500);
  };
  tick();
}
