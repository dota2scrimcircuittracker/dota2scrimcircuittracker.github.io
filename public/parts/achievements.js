// A profile's Achievements tab (lib/achievements.js): every achievement with its reward pack. On
// your own profile: progress, and a Claim button once one is earned; on anyone else's: their
// progress and claims, read-only. The Worker counts progress and grants the pack. Loads the first time the tab shows.
import { esc } from '../core.js';
import { steamAccount } from '../lib/store.js';
import { collectionAction, publicAchievements } from '../lib/cosmetics.js';
import { achievementStatus, rewardLabel, rewardParts } from '../lib/achievements.js';
import { oddsText } from '../lib/pack-types.js';
import { startSteamSignIn } from './me.js';

// Your own facts and claims, asked of the Worker once per page and shared by the tab and the
// profile summary (it counts across the whole vault, so it isn't cheap).
let mineLoad = null;
const loadMine = (account) => {
  if (mineLoad?.account !== String(account)) mineLoad = { account: String(account), promise: collectionAction('achievements') };
  mineLoad.promise.catch(() => { mineLoad = null; });
  return mineLoad.promise;
};
// A claim from the summary or the tab redraws the other.
const announce = (claims) => dispatchEvent(new CustomEvent('achievements-change', { detail: { claims } }));

export async function mountProfileAchievements(box, account) {
  const panel = box.closest('.pp-panel');
  if (panel?.hidden) {
    await new Promise((resolve) => { const watch = new MutationObserver(() => { if (!panel.hidden) { watch.disconnect(); resolve(); } }); watch.observe(panel, { attributes: true, attributeFilter: ['hidden'] }); });
    if (!box.isConnected) return;
  }
  box.innerHTML = '<p>Loading achievements…</p>';
  const viewer = await steamAccount().catch(() => null);
  const mine = viewer != null && String(viewer) === String(account);
  let facts = null, claims = {};
  try {
    if (mine) ({ facts, claims } = await loadMine(account));
    else ({ facts, claims } = await publicAchievements(account));
  } catch (e) { if (box.isConnected) box.innerHTML = `<p>${esc(e.message || 'Achievements are unavailable. Try again shortly.')}</p>`; return; }
  if (!box.isConnected) return;

  const draw = (note = '') => {
    const list = achievementStatus(facts ?? {}, claims), done = list.filter((a) => a.claimed).length, groups = [...new Set(list.map((a) => a.group))];
    box.innerHTML = `<section class="achievements">
      <p class="ach-total"><b>${done}</b> of ${list.length} claimed${mine ? '' : ''}${viewer == null ? ' · <button type="button" class="linkish" data-signin>Sign in with Steam to earn rewards</button>' : ''}</p>
      <p class="ach-note" role="status" aria-live="polite">${esc(note)}</p>
      ${groups.map((g) => `<h3>${esc(g)}</h3><ul class="ach-list">${list.filter((a) => a.group === g).map((a) => `<li class="ach${a.claimed ? ' claimed' : a.done && a.payable && mine ? ' ready' : ''}${a.soon ? ' soon' : ''}">
        <div class="ach-body"><b>${esc(a.title)}</b><span>${esc(a.text)}</span>
          ${!a.soon ? `<progress max="${a.goal}" value="${a.value}" aria-label="${esc(a.title)} progress"></progress><small>${a.value} / ${a.goal}</small>` : ''}</div>
        <div class="ach-reward"><span class="ach-pack ach-${rewardParts(a.reward).tier ?? 'screens'}" title="${esc(a.reward === 'screens' ? '5 new loading screens' : 'Each item: ' + oddsText(a.reward))}">${rewardLabel(a.reward)}</span><small class="ach-odds">${esc(a.reward === 'screens' ? '5 new loading screens' : oddsText(a.reward))}</small>
          ${a.claimed ? '<em>Claimed</em>' : a.soon ? '<em>Coming soon</em>' : a.done && mine && !a.payable ? '<em>Pack coming soon</em>' : a.done && mine ? `<button type="button" data-claim="${esc(a.id)}">Claim</button>` : ''}</div></li>`).join('')}</ul>`).join('')}</section>`;
    box.querySelector('[data-signin]')?.addEventListener('click', startSteamSignIn);
    box.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const data = await collectionAction('claim-achievement', { id: b.dataset.claim });
        claims = data.state.achievementClaims ?? claims;
        announce(claims);
        draw(`Claimed: a ${rewardLabel(list.find((a) => a.id === b.dataset.claim).reward)} is waiting in your packs.`);
      } catch (e) { b.disabled = false; box.querySelector('.ach-note').textContent = e.message; }
    }));
  };
  draw();
  addEventListener('achievements-change', (e) => { if (box.isConnected && e.detail.claims !== claims) { claims = e.detail.claims; draw(); } });
}

// Your own profile, beside the card collection: how many you've claimed, the ones ready to claim
// (with a Claim button), and the next six closest to done. Anyone else's: their six closest to
// done, then what they've claimed, newest first. See all opens the Achievements tab.
export async function mountAchievementSummary(host, account, mine = true) {
  host.className = 'ach-summary';
  host.innerHTML = '<h3>Achievements</h3><p>Loading…</p>';
  let facts, claims;
  try { ({ facts, claims } = await (mine ? loadMine(account) : publicAchievements(account))); } catch { host.remove(); return; }
  const draw = (note = '') => {
    if (!host.isConnected) return;
    // The total counts every achievement, coming-soon ones too (as the tab does); only live ones are listed.
    const all = achievementStatus(facts ?? {}, claims ?? {}), list = all.filter((a) => !a.soon);
    const done = all.filter((a) => a.claimed).length;
    const ready = mine ? list.filter((a) => a.done && !a.claimed && a.payable) : [];
    const next = list.filter((a) => !a.done).sort((a, b) => b.value / b.goal - a.value / a.goal).slice(0, 6);
    const claimed = mine ? [] : all.filter((a) => a.claimed).sort((a, b) => (claims[b.id] || 0) - (claims[a.id] || 0));
    const row = (a, end) => `<li><div><b>${esc(a.title)}</b><span>${esc(a.text)}</span>${a.done ? '' : `<progress max="${a.goal}" value="${a.value}" aria-label="${esc(a.title)} progress"></progress>`}</div><div class="ach-summary-end"><span class="ach-pack ach-${rewardParts(a.reward).tier ?? 'screens'}">${rewardLabel(a.reward)}</span>${end}</div></li>`;
    host.innerHTML = `<div class="ach-summary-head"><h3>Achievements</h3><button type="button" data-all>See all</button></div><strong>${done} / ${all.length} claimed</strong><progress value="${done}" max="${all.length}" aria-label="Achievements claimed"></progress>
      <p class="ach-note" role="status" aria-live="polite">${esc(note)}</p>
      <div class="ach-summary-lists">${ready.length ? `<h5>Ready to claim</h5><ul>${ready.map((a) => row(a, `<button type="button" data-claim="${esc(a.id)}">Claim</button>`)).join('')}</ul>` : ''}
      ${next.length ? `<h5>Up next</h5><ul>${next.map((a) => row(a, `<small>${a.value} / ${a.goal}</small>`)).join('')}</ul>` : ''}
      ${claimed.length ? `<h5>Claimed</h5><ul>${claimed.map((a) => row(a, '')).join('')}</ul>` : ''}</div>`;
    fit();
    host.querySelector('[data-all]').addEventListener('click', () => document.getElementById('pp-tab-achievements')?.click());
    host.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const data = await collectionAction('claim-achievement', { id: b.dataset.claim });
        claims = data.state.achievementClaims ?? claims;
        announce(claims);
        draw(`Claimed: a ${rewardLabel(list.find((a) => a.id === b.dataset.claim).reward)} is waiting in your packs.`);
      } catch (e) { b.disabled = false; host.querySelector('.ach-note').textContent = e.message; }
    }));
  };
  // Never scrolls: beside the collection the column only has the panel's height, so tiles that don't
  // fit are hidden from the end (Up next goes first), along with a heading left with none.
  const fit = () => {
    const area = host.querySelector('.ach-summary-lists');
    if (!area) return;
    area.querySelectorAll('h5,ul,li').forEach((e) => { e.hidden = false; });
    const tiles = [...area.querySelectorAll('li')];
    while (area.scrollHeight > area.clientHeight + 1 && tiles.length) {
      tiles.pop().hidden = true;
      area.querySelectorAll('ul').forEach((u) => { const empty = ![...u.children].some((li) => !li.hidden); u.hidden = empty; u.previousElementSibling.hidden = empty; });
    }
  };
  draw();
  new ResizeObserver(fit).observe(host);
  addEventListener('achievements-change', (e) => { if (host.isConnected && e.detail.claims !== claims) { claims = e.detail.claims; draw(); } });
}
