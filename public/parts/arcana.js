// Arcana in the Collection and Shop: the Double finish item (the Arcana upgrade) as a tile in the
// Collection, the arcana card for sale in the Shop, and the full-screen reveal when the sealed
// Double finish box is opened in Packs.
import { esc } from '../core.js';
import { MAX_FINISH_LAYERS, finishStackLimit, arcanaCount, hasArcanaUpgrade } from '../lib/cosmetics-engine.js';

export const ARCANA_COLOR = '#ff5ab4';
// How many finish layers a card can wear, main finish included, e.g. "3 of 5 layers".
export const layersText = (state) => `${finishStackLimit(state) + 1} of ${MAX_FINISH_LAYERS} layers`;
export const LAYERS_RULE = `Each arcana card you own adds one finish layer, up to ${MAX_FINISH_LAYERS}.`;
// Two card faces sliding over each other, each wearing its own moving finish: the item's picture.
export const doubleArt = (cls = '') => `<span class="arcana-double ${cls}" aria-hidden="true"><i class="arcana-double-back"></i><i class="arcana-double-front"></i><b></b></span>`;

// The Double finish tile: owned, sealed in Packs, or not collected yet.
export const upgradeStatus = (state) => (hasArcanaUpgrade(state) ? 'owned' : state?.arcanaSealed ? 'sealed' : 'missing');
export function upgradeTileHtml(state) {
  const status = upgradeStatus(state);
  const line = status === 'owned' ? `Unlocked · ${layersText(state)}` : status === 'sealed' ? 'Sealed · open it in Packs' : 'Not collected';
  return `<article class="dex-item arcana-upgrade-item ${status === 'missing' ? 'uncollected' : 'collected'}" style="--rarity:${ARCANA_COLOR}">
    <button type="button" class="arcana-upgrade-pic" data-arcana-upgrade="${status}" aria-label="Double finish, ${line}">${doubleArt()}<span class="arcana-upgrade-tag">ARCANA</span></button>
    <small>Arcana upgrade</small><strong>Double finish</strong><span>${line}</span>
    <p class="arcana-upgrade-note">Stack finishes on one card. ${LAYERS_RULE} Comes with your first arcana card.</p>
  </article>`;
}

// The arcana card in the Shop (lib/shop.js buyArcana): a buy button, asked twice like the items.
export function arcanaShopTileHtml(state, { editable, price, sure }) {
  const owned = arcanaCount(state), tokens = state?.tokens ?? 0;
  const line = owned ? `Owned ×${owned}${state?.arcanaSealed ? ' · Double finish sealed in Packs' : hasArcanaUpgrade(state) ? ` · ${layersText(state)}` : ''}` : 'Not owned';
  return `<article class="dex-item arcana-upgrade-item arcana-shop-item ${owned ? 'collected' : ''}" style="--rarity:${ARCANA_COLOR}">
    <div class="arcana-card-pic" aria-hidden="true"><span class="arcana-seal"><i></i></span><span class="arcana-upgrade-tag">ARCANA</span></div>
    <small>Arcana card</small><strong>Arcana card</strong><span>${line}</span>
    <p class="arcana-upgrade-note">One of the Arcana Cup's top designs, owed until they're released. Your first one unlocks Double finish. ${LAYERS_RULE}</p>
    ${editable ? `<button type="button" data-buy-arcana class="${sure ? 'confirm' : ''}" ${tokens < price ? 'disabled' : ''}>${sure ? `Spend ${price}?` : `${price} tokens`}</button>` : `<b class="shop-price">${price} tokens</b>`}
  </article>`;
}

// The sealed box opening: the screen dims, light breaks out of the gem, and the Double finish card
// lands. Resolves when it's closed (a click, Escape, or the button).
export function playArcanaReveal() {
  return new Promise((resolve) => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.createElement('div');
    el.className = `arcana-reveal${calm ? ' calm' : ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Arcana upgrade unlocked: Double finish');
    el.innerHTML = `<div class="arcana-reveal-rays"></div><div class="arcana-reveal-flash"></div>
      <div class="arcana-reveal-sparks">${Array.from({ length: 24 }, (_, i) => `<i style="--a:${i * 15}deg;--d:${(i % 5) * 60}ms"></i>`).join('')}</div>
      <div class="arcana-reveal-seal"><i></i></div>
      <div class="arcana-reveal-card">${doubleArt('big')}<small>Arcana upgrade unlocked</small><strong>Double finish</strong><p>Stack a second finish over your main one, each moving on its own layer. ${LAYERS_RULE}</p><button type="button" data-reveal-close>Continue</button></div>`;
    const close = () => { el.classList.add('closing'); document.removeEventListener('keydown', key); setTimeout(() => { el.remove(); resolve(); }, calm ? 0 : 260); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    document.body.append(el);
    // Clicks only close once the card has landed, so the opening can't be skipped by accident.
    setTimeout(() => { el.classList.add('landed'); el.querySelector('[data-reveal-close]').focus(); el.onclick = (e) => { if (e.target.closest('[data-reveal-close]') || !e.target.closest('.arcana-reveal-card')) close(); }; }, calm ? 0 : 2300);
  });
}
