// Arcana Cup launch notice: once per visitor, until entries close, a small card asks them to
// design a card and enter it. Dismissed (either button) it never shows again for this cup.
import { CUP } from "./arcana-cup.js";

const SEEN_KEY = `cup-notice-${CUP.id}`;
const DAY = 864e5;

// Shown only while entries are open and the visitor hasn't dismissed it.
export const shouldShowCupNotice = (now, seen, cup = CUP) => !seen && now < cup.votingAt;

// "7 days left" ... "2 days left", then "Last day" for the final 24 hours.
export function timeLeft(now, cup = CUP) {
  const days = Math.ceil((cup.votingAt - now) / DAY);
  return days >= 2 ? `${days} days left` : "Last day";
}

function seen() { try { return !!localStorage.getItem(SEEN_KEY); } catch { return false; } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* not remembered */ } }

let card = null;
function close() { markSeen(); card?.remove(); card = null; }

function show(go) {
  if (card || !shouldShowCupNotice(Date.now(), seen())) return;
  card = document.createElement("div");
  card.className = "tour-invite cup-notice";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "Arcana Cup");
  card.innerHTML = `<b>Arcana Cup is open</b><em>${timeLeft(Date.now())}</em>
    <span>Design a card and enter up to two in the Arcana Cup. Entries close Fri Oct 30, 9pm ET.
    The top 3 in each lane become Arcana player cards.</span>
    <div class="tour-btns"><button type="button" class="tour-btn cup-later">Later</button><button type="button" class="tour-btn tour-primary cup-go">Enter the Cup</button></div>`;
  card.querySelector(".cup-later").onclick = close;
  card.querySelector(".cup-go").onclick = () => { close(); go("#/gallery/cup"); };
  document.body.append(card);
}

// here() is the current "#/..." route; go(href) navigates in-app.
export function initCupNotice({ go, here }) {
  if (!shouldShowCupNotice(Date.now(), seen())) return;
  // After the first page renders, and never on top of the tour or its invite.
  const wait = Date.now() + 8000;
  const tick = () => {
    if (!shouldShowCupNotice(Date.now(), seen())) return;
    if (here().startsWith("#/gallery/cup")) return markSeen();
    const busy = document.querySelector(".tour-invite:not(.cup-notice)") || document.body.classList.contains("touring") || document.body.classList.contains("tour-pick");
    if (busy || (!document.getElementById("app")?.children.length && Date.now() < wait)) return void setTimeout(tick, 1000);
    setTimeout(() => show(go), 1500);
  };
  tick();
}
