// The Gallery tab (#/gallery/<sub-tab>, in the league you were last in; #/<league>/gallery and /cards still work): the Feed first, then everyone's
// custom cards, then your own packs, card dex, customizing and recycling as sub-tabs, on a full
// page with the site's header and sub-tab bar. The same code as the collection dialog
// (parts/collection.js); the address follows the open sub-tab.
import { app, pageHead, addressOf, setRoutedAt } from "../core.js";
import { openCollection } from "../parts/collection.js";
import {localCosmeticsReview} from '../lib/local-cosmetics-review.js';
import {localShopTest} from '../lib/local-shop-test.js';
import {localClaudeCards} from '../lib/claude-cards.js';
import {localArcanaIdeas} from '../lib/arcana-ideas.js';
import {localWave3Review} from '../lib/wave3-review.js';
import {applyEquipment} from '../lib/cosmetics.js';
import { GALLERY_TABS as TABS } from "../lib/pagetabs.js";

// bare: opened at #/gallery, so the address keeps no league in it.
export function renderGallery(src, segment, bare = false) {
  if (segment === "log") segment = ""; // the Feed replaced the Log
  // ?arcanaIdeas=1 on loopback: prototypes of arcana ideas (lib/arcana-ideas.js), in place of the Gallery.
  const ideas=localArcanaIdeas();
  if(ideas){
    app.innerHTML=`${pageHead(src.kicker,ideas.round==="2"?"Arcana ideas, round 2":"Arcana ideas",ideas.round==="2"?"Five takes each on Split Frame, Twin Card and Living Border. Local preview only: nothing here is live or saved.":"Nine prototypes on real cards. Local preview only: nothing here is live or saved.")}${ideas.html}`;
    ideas.wire(app);
    return;
  }
  // ?wave3=1 on loopback: the November 3 wave on real cards (lib/wave3-review.js), in place of the Gallery.
  const wave3=localWave3Review();
  if(wave3){
    app.innerHTML=`${pageHead(src.kicker,"Wave 3 cosmetics",`${wave3.count} new items on real cards. Approve, ask for changes or cut each one, with a note if you like. Local only: nothing here is live.`)}${wave3.html}`;
    wave3.wire(app);
    return;
  }
  // ?claudeCards=1 on loopback: the ten cards Claude designed (lib/claude-cards.js), in place of the Gallery.
  const claude=localClaudeCards();
  if(claude){
    app.innerHTML=`${pageHead(src.kicker,"Claude's cards","Ten cards designed with every cosmetic unlocked, all signed Claude. Local preview only: nothing is saved to an account.")}${claude.html}`;
    app.querySelectorAll('[data-claude-card]').forEach(f=>applyEquipment(f.querySelector('.ft-card'),claude.cards[f.dataset.claudeCard].equipment,'Claude'));
    return;
  }
  const open = (TABS.find(([, , s]) => s === (segment ?? "")) ?? TABS[0])[0];
  const bar = `<div class="pp-tabs" role="tablist" aria-label="Gallery sections">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === open}" tabindex="${id === open ? 0 : -1}">${label}</button>`).join("")}</div>`;
  app.innerHTML = `${pageHead(src.kicker, "Gallery", "What the league is pulling and saving, everyone's custom cards, and your own packs and collection.", bar)}<div class="collection-host"></div>`;
  // ?slot=<n> (1-based, from a profile's empty "Add card" slot) opens Customize on that card.
  const slot = Number(new URLSearchParams(location.search).get("slot"));
  const shopTest=localShopTest(), review=shopTest?null:localCosmeticsReview();
  if(shopTest)app.querySelector('.collection-host').insertAdjacentHTML('beforebegin','<p class="local-collection-review">Local shop test · Fake account with test tokens, saved in this browser only. Nothing reaches a real account. <a href="?testShop=reset#/gallery/shop">Reset to 30</a></p>');
  if(review)app.querySelector('.collection-host').insertAdjacentHTML('beforebegin','<p class="local-collection-review">Local cosmetics review · New borders, finishes &amp; signatures only. Saved designs stay in this browser.</p>');
  return openCollection({
    ...(shopTest??review),
    slot: slot >= 1 ? slot - 1 : null,
    page: app.querySelector(".collection-host"), tabBar: app.querySelector(".pp-tabs"), tab: open,
    onTab: (t) => { const s = TABS.find(([id]) => id === t)[2]; const url=new URL(addressOf(`${bare ? "#" : src.root}/gallery${s ? `/${s}` : ""}`),location.href);if(review)url.searchParams.set('reviewCosmetics','1');if(shopTest)url.searchParams.set('testShop','1');history.replaceState(history.state, "", url.pathname+url.search+url.hash); setRoutedAt(location.href); },
  });
}
