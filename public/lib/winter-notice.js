// Winter player packs notice: once per visitor, from the prep launch until voting closes. It never claims packs are open; Phase 1 adds that back.
// Same card and timing as the Arcana Cup notice (cup-notice.js), and it waits for that one to go.
import { WINTER, PACK_CARDS_MAX } from "./winter.js";

const SEEN_KEY = "winter-packs-notice-1";

export const shouldShowWinterNotice = (now, seen, w = WINTER) => !seen && now >= w.prepAt && now < w.votesCloseAt;

function seen() { try { return !!localStorage.getItem(SEEN_KEY); } catch { return false; } }
function markSeen() { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* not remembered */ } }

let card = null;
function close() { markSeen(); card?.remove(); card = null; }

function show(go) {
  if (card || !shouldShowWinterNotice(Date.now(), seen())) return;
  card = document.createElement("div");
  card.className = "tour-invite cup-notice winter-notice";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "Winter player packs");
  card.innerHTML = `<b>Coming for Winter: player packs</b>
    <span>Winter Fantasy uses player cards. Your first ${PACK_CARDS_MAX} card designs are your Winter pack cards. Choose each one's bonus on your profile. Votes set their rarity. Voting closes on Thanksgiving.</span>
    <div class="tour-btns"><button type="button" class="tour-btn winter-later">Later</button><button type="button" class="tour-btn tour-primary winter-go">See my pack cards</button></div>`;
  card.querySelector(".winter-later").onclick = close;
  // Pack cards are managed from your own profile (Manage pack cards, above your cards). Signed out: the Gallery asks you to sign in.
  card.querySelector(".winter-go").onclick = async () => { close(); go(await import("../parts/me.js").then((m) => m.myProfileHref()).catch(() => null) ?? "#/gallery/customize"); };
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
    // Checked again when it shows: the tour invite may have appeared in the meantime.
    setTimeout(() => (document.querySelector(".tour-invite") ? tick() : show(go)), 1500);
  };
  tick();
}
