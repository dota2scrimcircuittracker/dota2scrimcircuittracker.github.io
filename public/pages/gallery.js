// The Gallery tab (#/gallery/<sub-tab>, in the league you were last in; #/<league>/gallery and /cards still work): the Feed first, then everyone's
// custom cards, then your own packs, card dex, customizing and recycling as sub-tabs, on a full
// page with the site's header and sub-tab bar. The same code as the collection dialog
// (parts/collection.js); the address follows the open sub-tab.
import { app, pageHead, addressOf, setRoutedAt } from "../core.js";
import { openCollection } from "../parts/collection.js";
import {localCosmeticsReview} from '../lib/local-cosmetics-review.js';
import { GALLERY_TABS as TABS } from "../lib/pagetabs.js";

// bare: opened at #/gallery, so the address keeps no league in it.
export function renderGallery(src, segment, bare = false) {
  if (segment === "log") segment = ""; // the Feed replaced the Log
  const open = (TABS.find(([, , s]) => s === (segment ?? "")) ?? TABS[0])[0];
  const bar = `<div class="pp-tabs" role="tablist" aria-label="Gallery sections">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === open}" tabindex="${id === open ? 0 : -1}">${label}</button>`).join("")}</div>`;
  app.innerHTML = `${pageHead(src.kicker, "Gallery", "What the league is pulling and saving, everyone's custom cards, and your own packs and collection.", bar)}<div class="collection-host"></div>`;
  // ?slot=<n> (1-based, from a profile's empty "Add card" slot) opens Customize on that card.
  const slot = Number(new URLSearchParams(location.search).get("slot"));
  const review=localCosmeticsReview();
  if(review)app.querySelector('.collection-host').insertAdjacentHTML('beforebegin','<p class="local-collection-review">Local cosmetics review · New borders, finishes &amp; signatures only. Saved designs stay in this browser.</p>');
  return openCollection({
    ...review,
    slot: slot >= 1 ? slot - 1 : null,
    page: app.querySelector(".collection-host"), tabBar: app.querySelector(".pp-tabs"), tab: open,
    onTab: (t) => { const s = TABS.find(([id]) => id === t)[2]; const url=new URL(addressOf(`${bare ? "#" : src.root}/gallery${s ? `/${s}` : ""}`),location.href);if(review)url.searchParams.set('reviewCosmetics','1');history.replaceState(history.state, "", url.pathname+url.search+url.hash); setRoutedAt(location.href); },
  });
}
