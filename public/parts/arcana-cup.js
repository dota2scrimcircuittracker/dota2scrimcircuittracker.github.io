// Gallery › Arcana Cup (lib/arcana-cup.js has the rules, the collection Worker the data). Two
// brackets, Artistic and Funny, each with its own sub-tab. While entries are open: how it works,
// your entries and your saved cards to enter. Once voting starts: this round's matchups, each card
// with a Vote button and the usual rarity rating under it, then the whole bracket. When the grand
// final is settled: the bracket's top 3, who become Arcana player cards. Fav sees every entry and
// can remove one (it counts as a strike against its owner).
import { esc, SOURCES, allLoad } from '../core.js';
import { divisionTiers } from './tiers.js';
import { listCards } from '../lib/store.js';
import { collectionState, collectionAction, cupView, myCardVotes, galleryCards } from '../lib/cosmetics.js';
import { cardDesignState, cardSlotName } from '../lib/cosmetics-engine.js';
import { ARCANA_PLACES, CATEGORIES, MAX_STRIKES, matchLabel, CUP, seedBracket, buildBracket, dueMatches, forfeits, isVotable, decideMatch, placings, phaseAt, threadAccess } from '../lib/arcana-cup.js';
import { isAdmin } from '../lib/pack-gifts.js';
import { castVote, tally } from '../lib/card-ratings.js';
import { createPlayerCards, PAINT_FILTER, wirePlayerCards, fitDesignCards } from './player-card.js';
import { steamName } from './me.js';
import { strangerNames } from '../lib/scout.js';
import { mountRating } from './card-rating.js';
import { drawThread, MAX_THREAD_TEXT } from './arcana-cup-thread.js';
import { zoomBetween } from './arcana-cup-zoom.js';

const when = (at) => new Date(at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const left = (ms) => { const h = Math.max(0, Math.floor(ms / 36e5)), d = Math.floor(h / 24); return d ? `${d}d ${h % 24}h` : h ? `${h}h` : `${Math.max(1, Math.ceil(ms / 6e4))}m`; };
const PLACE = ['1st', '2nd', '3rd'];
const CATS = Object.keys(CATEGORIES);
let tab = CATS[0]; // the open sub-tab; kept while the page redraws
const stageAt = {}; // the matchup the voting stage shows in each bracket; kept while the page redraws
// The rules start open every visit; fold them away and they stay folded while the page redraws.
let introOpen = true;

function introHtml(cup, phase) {
  return `<details class="cup-intro"${introOpen ? ' open' : ''}>
    <summary><span class="cup-intro-title">${esc(cup.name)}</span> <small>How it works and what you win</small></summary>
    <p>Make the best card you can and enter up to ${cup.maxEntries}, each as <b>Artistic</b> or <b>Funny</b>, two at most in one. They're separate brackets, so a joke card never has to beat a carefully made one. Entries close <b>${esc(when(cup.votingAt))}</b>. Then each bracket is double elimination: two cards at a time, 24 hours a round. A card that loses once drops to the losers bracket, and a second loss knocks it out. You can't vote in a matchup with your card in it.</p>
    <ul class="cup-prizes"><li>In each bracket: <b data-rarity="legendary">1st</b> Legendary pack</li><li><b data-rarity="epic">2nd</b> Epic pack</li><li><b data-rarity="rare">3rd</b> Rare pack</li><li><b class="cup-arcana">Top 3 of each</b> become Arcana player cards</li></ul>
    <p>The top 3 in each bracket also design a signature, border or finish that goes into the game. Fav removes troll entries from Artistic, and three removals means no more entries.</p>
    <p class="cup-why"><b>This is for player packs in the next mini.</b> While you vote, rate each card Common to Legendary too. Those ratings help set which player cards are which rarity.</p>
    <p>Every matchup has a discussion thread. Vote first: the vote count and the comments stay hidden until you do. Once a round closes, every thread is open to read from the bracket.</p>
    ${phase === 'cancelled' ? '<p class="cup-note">Fewer than two cards were entered here, so this bracket did not run.</p>' : ''}
  </details>`;
}

// The live cup: the collection Worker.
const LIVE = {
  view: cupView,
  mine: (viewer) => viewer == null ? null : collectionAction('cup-mine').catch(() => null),
  all: (viewer) => viewer != null && isAdmin(viewer) ? collectionAction('cup-all').catch(() => null) : null,
  act: collectionAction,
};

// Practice (localhost only, ?cupPractice=1): both brackets from up to 32 of the Gallery's current
// cards, three per player at most, run in this browser. Voting is open from the start, other voters
// are made up, and "Next round" closes the round. You can try Fav's removal too. Nothing is saved,
// ratings included.
export const isPractice = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('cupPractice');
let practice = null;
async function practiceStart() {
  const cards = await galleryCards(), perPlayer = new Map(), count = Object.fromEntries(CATS.map((c) => [c, 0])), entries = [];
  for (const c of [...cards].sort(() => Math.random() - 0.5)) {
    const n = (perPlayer.get(c.account) ?? 0) + 1, category = CATS.reduce((a, b) => (count[a] <= count[b] ? a : b));
    if (n > CUP.maxEntries || count[category] >= 16 || entries.filter((e) => e.account === String(c.account) && e.category === category).length >= CUP.maxPerCategory) continue;
    perPlayer.set(c.account, n); count[category]++;
    entries.push({ id: `${c.account}-${n}`, account: String(c.account), category, slot: c.slot, name: c.name, design: c.design, key: c.key, at: c.at ?? 0, votes: {}, nickname: c.nickname });
  }
  if (CATS.some((c) => count[c] < 2)) throw new Error('Practice needs at least four custom cards in the Gallery.');
  const now = Date.now(), cup = { ...CUP, name: `${CUP.name} (practice)`, votingAt: now };
  practice = { cup, now: now + 6e4, entries, strikes: {}, mine: {}, threads: {}, cats: Object.fromEntries(CATS.map((c) => [c, { seeds: seedBracket(entries.filter((e) => e.category === c)), results: {}, bots: {} }])) };
}
function practiceRounds(category) {
  const p = practice, c = p.cats[category], mine = p.entries.filter((e) => e.category === category);
  const info = Object.fromEntries(mine.map((e) => [e.id, { at: e.at, removed: !!e.removed, ratings: tally(e.votes).total }]));
  // Made-up voters for each matchup the first time it has both cards: 0 to 8 a side.
  const fill = (rounds) => { for (const m of rounds.flat()) if (m.a && m.b && !c.bots[m.id]) { c.bots[m.id] = {}; let i = 0; for (const side of [m.a, m.b]) for (let k = Math.floor(Math.random() * 9); k > 0; k--) c.bots[m.id][`bot${i++}`] = side; } };
  let rounds = buildBracket(c.seeds, c.results, p.cup), due;
  fill(rounds);
  while ((due = [...new Map([...dueMatches(rounds, p.now), ...forfeits(rounds, info)].map((m) => [m.id, m])).values()]).length) {
    for (const m of due) c.results[m.id] = decideMatch(m, { ...c.bots[m.id], ...(p.mine[`${category}:${m.id}`] ? { you: p.mine[`${category}:${m.id}`] } : {}) }, info);
    rounds = buildBracket(c.seeds, c.results, p.cup); fill(rounds);
  }
  return { rounds, info };
}
const BOT_LINES = ['The colours work together.', 'Funnier than it has any right to be.', 'That border is doing a lot.', 'Clean layout, easy pick.', 'I laughed. Vote locked.', 'Close one, both are good.'];
// A thread for a practice matchup, with a few made-up voters in it the first time it is needed.
function practiceThread(category, m) {
  const p = practice, key = `${category}:${m.id}`;
  if (!p.threads[key]) p.threads[key] = Array.from({ length: Math.floor(Math.random() * 4) }, (_, i) => ({ id: `${key}-bot${i}`, account: `bot${i}`, text: BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)], at: p.now - (i + 1) * 6e4 }));
  return p.threads[key];
}
const PRACTICE = {
  async view() {
    if (!practice) await practiceStart();
    const p = practice, categories = {}, threadCounts = {};
    for (const category of CATS) {
      const { rounds, info } = practiceRounds(category), entries = p.entries.filter((e) => e.category === category);
      threadCounts[category] = Object.fromEntries(rounds.flat().filter((m) => m.a && m.b).map((m) => [m.id, practiceThread(category, m).filter((c) => !c.removed).length]));
      categories[category] = { phase: phaseAt(p.now, rounds, p.cup), count: entries.length, rounds, order: placings(rounds, info), entries: entries.map((e) => ({ ...e, removed: e.removed ? 1 : 0, ...tally(e.votes) })) };
    }
    return { cup: p.cup, categories, threadCounts, serverNow: p.now, nicknames: Object.fromEntries(p.entries.filter((e) => e.nickname).map((e) => [e.account, e.nickname])) };
  },
  mine: () => ({ entries: [], votes: { ...practice.mine }, strikes: 0, maxStrikes: MAX_STRIKES }),
  all: () => ({ entries: practice.entries.filter((e) => !e.removed), strikes: practice.strikes, nicknames: {}, maxStrikes: MAX_STRIKES }),
  async act(action, details) {
    const p = practice, viewer = 'you';
    if (action === 'cup-vote') {
      const { rounds } = practiceRounds(details.category), m = rounds.flat().find((x) => x.id === details.match);
      if (!m || !isVotable(m, p.now)) throw new Error('That matchup is not open for votes.');
      const key = `${details.category}:${m.id}`;
      if (details.pick == null) delete p.mine[key]; else p.mine[key] = details.pick;
      return {};
    }
    if (['cup-thread', 'cup-comment', 'cup-comment-delete'].includes(action)) {
      const { rounds } = practiceRounds(details.category), m = rounds.flat().find((x) => x.id === details.match);
      if (!m || !m.a || !m.b) throw new Error('That matchup is not in the bracket yet.');
      const key = `${details.category}:${m.id}`, list = practiceThread(details.category, m), pick = p.mine[key] ?? null, access = threadAccess(m, p.now, { pick });
      if (action === 'cup-comment') {
        const text = String(details.text ?? '').replace(/\s+/g, ' ').trim();
        if (!text) throw new Error('Write a comment first.');
        if (text.length > MAX_THREAD_TEXT) throw new Error(`Keep comments to ${MAX_THREAD_TEXT} characters.`);
        if (!access.write) throw new Error(isVotable(m, p.now) ? 'Vote in this matchup to join its thread.' : 'This matchup is closed, so its thread is read-only.');
        list.push({ id: `${key}-you${list.length}`, account: viewer, text, at: p.now });
        return { comments: list };
      }
      if (action === 'cup-comment-delete') { p.threads[key] = list.filter((c) => c.id !== details.comment); return { comments: p.threads[key] }; }
      if (!access.read) return { locked: true, count: list.length, live: isVotable(m, p.now), serverNow: p.now };
      const counts = { [m.a]: 0, [m.b]: 0 };
      if (m.result) Object.assign(counts, m.result.votes);
      else for (const v of Object.values({ ...practice.cats[details.category].bots[m.id], ...(pick ? { you: pick } : {}) })) if (v in counts) counts[v]++;
      return { comments: list, nicknames: { you: 'You', ...Object.fromEntries(list.map((c) => [c.account, `Voter ${c.account.replace('bot', '')}`])) }, counts, mine: pick, canComment: access.write, live: isVotable(m, p.now), serverNow: p.now };
    }
    if (action === 'cup-rate') {
      const e = p.entries.find((x) => x.id === details.entry);
      e.votes = castVote(e.votes, viewer, details.rating ?? null);
      return { rating: { slot: e.slot, key: e.key, mine: e.votes[viewer] ?? null, ...tally(e.votes) } };
    }
    if (action === 'cup-remove') {
      const e = p.entries.find((x) => x.id === details.entry);
      if (!e || e.removed) throw new Error('Choose an entry that is still in.');
      e.removed = true; p.strikes[e.account] = (p.strikes[e.account] ?? 0) + 1;
      return {};
    }
    if (action === 'next-round') {
      const open = CATS.flatMap((c) => practiceRounds(c).rounds.flat()).filter((m) => !m.result && p.now < m.closesAt).map((m) => m.closesAt);
      p.now = open.length ? Math.min(...open) : p.now + p.cup.roundMs; return {};
    }
    if (action === 'restart') { practice = null; return {}; }
    throw new Error('Not in practice.');
  },
};

export async function drawCup(body, { viewer, signIn }) {
  body.innerHTML = '<p>Loading the Arcana Cup…</p>';
  const practicing = isPractice(), src = practicing ? PRACTICE : LIVE;
  const me = practicing ? (viewer ?? 'you') : viewer; // practice lets anyone vote
  let view, mine, votes, teams, matches, overrides, admin;
  try {
    view = await src.view();
    [mine, admin, votes, teams, matches, overrides] = await Promise.all([src.mine(viewer), practicing ? src.all() : src.all(viewer),
      viewer == null || practicing ? {} : myCardVotes().catch(() => ({})), SOURCES.all.data().then((d) => d.teams).catch(() => []), allLoad().catch(() => []), listCards().catch(() => new Map())]);
  } catch (e) { body.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  if (!body.isConnected) return;
  const skew = view.serverNow - Date.now(), now = () => Date.now() + skew; // the Worker's clock decides
  const roster = new Map(teams.flatMap((t) => t.players.map((p) => [String(p.account_id), { name: p.name, team: t.name, league: t.league }])));
  const renderer = createPlayerCards(matches, { cards: overrides, teams, tiers: await divisionTiers().catch(() => new Map()) });
  const nicknames = { ...view.nicknames, ...(admin?.nicknames ?? {}) };
  const everyone = [...CATS.flatMap((c) => view.categories[c].entries), ...(mine?.entries ?? []), ...(admin?.entries ?? [])];
  const strangers = await strangerNames([...new Set(everyone.map((e) => String(e.account)))].filter((a) => !roster.has(a))).catch(() => new Map());
  if (!body.isConnected) return;
  const nameOf = (e) => nicknames[e.account] ?? roster.get(String(e.account))?.name ?? strangers.get(String(e.account)) ?? steamName(Number(e.account)) ?? `Player ${e.account}`;
  const cat = view.categories[tab], byId = new Map(cat.entries.map((e) => [e.id, e]));
  // The card's name, or #1/#2 when a player has two unnamed entries here, so the bracket tells them apart.
  const cardTag = (e) => e.name ? ` · ${esc(e.name)}` : cat.entries.filter((x) => x.account === e.account).length > 1 ? ` · #${esc(e.id.split('-')[1])}` : '';
  // data-cup-entry, not data-pick: a pick re-applies your live card (lib/cosmetics.js), and an entry is a frozen copy.
  const cardHtml = (e) => {
    const r = roster.get(String(e.account));
    return renderer.card({ account: Number(e.account), name: nameOf(e), team: r?.team ?? 'AD2L' }, null, { own: true, equipmentOverride: e.design }).replace('data-pick=', 'data-cup-entry=');
  };
  const cardOf = (e, caption = '') => {
    const r = roster.get(String(e.account)), player = { account: Number(e.account), name: nameOf(e), team: r?.team ?? 'AD2L' };
    const link = `${SOURCES[r?.league]?.root ?? '#/all'}/player/${e.account}`;
    return `<figure data-entry="${esc(e.id)}">${renderer.card(player, null, { own: true, equipmentOverride: e.design }).replace('data-pick=', 'data-cup-entry=')}<figcaption><a href="${link}">${esc(player.name)}</a>${cardTag(e)}${caption}</figcaption></figure>`;
  };
  const finish = (host) => { wirePlayerCards(host); fitDesignCards(host); };
  const say = (msg) => { const p = body.querySelector('.cup-status'); if (p) p.textContent = msg; };
  const act = async (action, details, done) => {
    body.querySelectorAll('.cup button').forEach((b) => { b.disabled = true; });
    try { await src.act(action, details); await drawCup(body, { viewer, signIn }); done && say(done); }
    catch (e) { say(e.message); body.querySelectorAll('.cup button').forEach((b) => { b.disabled = false; }); }
  };
  const fav = practicing || (viewer != null && isAdmin(viewer));
  const removeBtn = (e) => fav ? `<br><button type="button" class="cup-remove" data-remove="${esc(e.id)}" title="Fav: remove this entry. It counts as a strike against ${esc(nameOf(e))}.">Remove (Fav)</button>` : '';

  const myIds = new Set(cat.entries.filter((e) => me != null && String(e.account) === String(me)).map((e) => e.id));
  const threadCounts = view.threadCounts?.[tab] ?? {};
  const labelOf = (id) => { const e = byId.get(id); return e ? `${nameOf(e)}${e.name ? ` · ${e.name}` : ''}` : ''; };
  // Which bracket a matchup is in: the lane (Artistic or Funny), then winners or losers, then the round.
  const whereHtml = (m) => { const round = matchLabel(m, bracket.size).replace(/^(Winners|Losers) /, ''); return `<div class="cup-where"><span class="cup-chip cup-chip-cat cup-lane-${tab}">${esc(CATEGORIES[tab].name)}</span><span class="cup-chip cup-chip-br cup-br-${m.bracket}">${m.bracket === 'w' ? 'Winners bracket' : m.bracket === 'l' ? 'Losers bracket' : 'Grand final'}</span>${m.bracket === 'gf' ? '' : `<b>${esc(round[0].toUpperCase() + round.slice(1))}</b>`}</div>`; };
  const pickOf = (m) => mine?.votes?.[`${tab}:${m.id}`];
  const ownsMatch = (m) => myIds.has(m.a) || myIds.has(m.b);
  let live = [], bracket = null, stageApi = null;
  const cup = view.cup, entriesOpen = cat.phase === 'entries';
  const bar = `<div class="pp-tabs cup-tabs" role="tablist" aria-label="Arcana Cup brackets">${CATS.map((c) => `<button type="button" role="tab" data-cat="${c}" aria-selected="${c === tab}" tabindex="${c === tab ? 0 : -1}">${CATEGORIES[c].name} <small>${view.categories[c].count}</small></button>`).join('')}</div>`;
  const parts = [`<div class="cup">${PAINT_FILTER}${introHtml(cup, cat.phase)}${practicing ? `<p class="cup-practice"><b>Practice bracket.</b> Today's Gallery cards, made-up voters, nothing saved, Fav's removal included. <button type="button" data-practice="next-round"${CATS.every((c) => view.categories[c].phase === 'done') ? ' disabled' : ''}>Next round</button> <button type="button" class="linkish" data-practice="restart">Restart with new cards</button></p>` : ''}${bar}<p class="cup-lane"><b>${CATEGORIES[tab].name}.</b> ${esc(CATEGORIES[tab].blurb)}</p><p class="cup-status" role="status"></p>`];
  if (entriesOpen) {
    const entered = mine?.entries ?? [], strikes = mine?.strikes ?? 0, banned = strikes >= (mine?.maxStrikes ?? MAX_STRIKES);
    parts.push(`<p class="cup-clock">Entries close in <b>${left(cup.votingAt - now())}</b> · ${cat.count} card${cat.count === 1 ? '' : 's'} in ${CATEGORIES[tab].name} so far. Entries stay hidden until voting starts.</p>`);
    if (viewer == null) parts.push('<p><button type="button" data-signin>Sign in with Steam to enter</button></p>');
    else {
      const tag = (e) => `<br><small class="cup-badge">${CATEGORIES[e.category]?.name ?? ''}</small> <button type="button" class="linkish" data-withdraw="${esc(e.id)}">Withdraw</button>`;
      parts.push(`<h4>Your entries (${entered.length}/${cup.maxEntries})</h4>${strikes ? `<p class="cup-note cup-warn">Fav has removed ${strikes} of your entries. At ${mine?.maxStrikes ?? MAX_STRIKES}, you can't enter any more.${banned ? ' You can no longer enter.' : ''}</p>` : ''}<div class="gallery-grid cup-mine">${entered.map((e) => cardOf(e, tag(e))).join('') || '<p>None yet. Enter a card below.</p>'}</div>`);
      const state = collectionState(), designs = state ? cardDesignState(state).cardDesigns : [];
      const full = entered.length >= cup.maxEntries || banned, laneFull = (c) => entered.filter((e) => e.category === c).length >= cup.maxPerCategory;
      parts.push(`<h4>Enter one of your cards</h4><p class="cup-note">This saves a copy of the card as it is now. Changes you make later in Customize won't change your entry; withdraw it and enter it again. Pick Artistic or Funny for each card; you can enter up to ${cup.maxEntries} in all, two at most in one category.</p>
        <div class="gallery-grid cup-slots">${designs.map((d, slot) => d && `<figure data-slot="${slot}">${renderer.card({ account: Number(viewer), name: nameOf({ account: viewer }), team: roster.get(String(viewer))?.team ?? 'AD2L' }, null, { own: true, equipmentOverride: d }).replace('data-pick=', 'data-cup-entry=')}<figcaption>${esc(cardSlotName(designs, slot))}<div class="cup-enter-btns">${CATS.map((c) => `<button type="button" data-enter="${slot}" data-category="${c}"${full || laneFull(c) ? ` disabled title="${banned ? 'Too many removals' : full ? 'Withdraw an entry first' : `${cup.maxPerCategory} in ${CATEGORIES[c].name} already`}"` : ''}>Enter ${CATEGORIES[c].name}</button>`).join('')}</div></figcaption></figure>`).filter(Boolean).join('') || '<p>Save a card in Customize first.</p>'}</div>`);
    }
  } else if (cat.rounds) {
    const rounds = cat.rounds, size = rounds[0].filter((m) => m.bracket === 'w').length * 2, all = rounds.flat(), done = cat.phase === 'done';
    live = all.filter((m) => !m.result && m.a && m.b && now() >= m.opensAt && now() < m.closesAt);
    bracket = { rounds, size };
    if (done) {
      const top = cat.order.map((id) => byId.get(id)).filter((e) => e && !e.removed).slice(0, ARCANA_PLACES);
      // How each card got there: every match it played, with the votes, each one opening its thread.
      const path = (id) => all.filter((m) => m.result && m.a && m.b && (m.a === id || m.b === id)).sort((x, y) => x.step - y.step).map((m) => {
        const other = m.a === id ? m.b : m.a, won = m.result.winner === id;
        return `<li><button type="button" class="linkish" data-thread="${esc(m.id)}" title="Read this matchup's thread"><b class="${won ? 'cup-w' : 'cup-l'}">${won ? 'W' : 'L'}</b> ${m.result.votes[id] ?? 0}–${m.result.votes[other] ?? 0} vs ${esc(labelOf(other))} <small>${esc(matchLabel(m, size))}</small></button></li>`;
      }).join('');
      parts.push(`<h4>Results</h4><p class="cup-note">The top ${ARCANA_PLACES} in ${CATEGORIES[tab].name} are Arcana player cards for the next mini. ${practicing ? 'In the real cup, prize packs go out now.' : 'Prize packs have been sent.'} Tap a result under a card to read that matchup's thread.</p><div class="cup-podium">${top.map((e, i) => `<div class="cup-place cup-p${i + 1}"><p class="cup-medal">${PLACE[i]} · <b class="cup-arcana">Arcana</b></p>${cardOf(e)}<ul class="cup-path">${path(e.id)}</ul></div>`).join('')}</div>`);
    } else if (live.length) {
      // The voting stage: one matchup at a time. Vote, and its count and thread open under it.
      const votable = live.filter((m) => !ownsMatch(m)), voted = votable.filter((m) => pickOf(m)).length;
      const firstOpen = live.findIndex((m) => !ownsMatch(m) && !pickOf(m)), kept = live.findIndex((m) => m.id === stageAt[tab]), idx = kept >= 0 ? kept : Math.max(0, firstOpen);
      stageAt[tab] = live[idx].id;
      parts.push(`<h4>${CATEGORIES[tab].name} bracket · Round ${live[0].step + 1} of ${rounds.length}</h4><p class="cup-clock">Voting closes in <b>${left(live[0].closesAt - now())}</b>. Vote in each matchup, then read what others said.</p>`);
      if (me == null) parts.push('<p><button type="button" data-signin>Sign in with Steam to vote</button></p>');
      const dot = (m) => ownsMatch(m) ? 'own' : pickOf(m) ? 'done' : 'todo';
      const section = (m, i) => {
        const a = byId.get(m.a), b = byId.get(m.b), ownMatch = ownsMatch(m), pick = pickOf(m);
        const side = (e) => cardOf(e, `<br><button type="button" class="cup-vote-btn" data-vote="${esc(m.id)}" data-pick="${esc(e.id)}" aria-pressed="${pick === e.id}"${me == null || ownMatch ? ' disabled' : ''}>${pick === e.id ? 'Your vote' : 'Vote'}</button>${removeBtn(e)}`);
        return `<section class="cup-match cup-${m.bracket}" data-match="${esc(m.id)}"${i === idx ? '' : ' hidden'}>${whereHtml(m)}<div class="cup-pair">${side(a)}<span class="cup-vs">vs</span>${side(b)}</div>${ownMatch ? '<p class="cup-note">Your card is in this one, so you can\'t vote here. You can read the thread.</p>' : ''}<div class="cup-thread-host" data-thread-host></div></section>`;
      };
      parts.push(`<div class="cup-stage" data-stage>
        <div class="cup-progress"><div class="cup-bar" role="progressbar" aria-label="Matchups you have voted in" aria-valuemin="0" aria-valuemax="${votable.length}" aria-valuenow="${voted}"><i style="width:${votable.length ? (voted / votable.length) * 100 : 0}%"></i></div>
          <p><b data-pos>Matchup ${idx + 1} of ${live.length}</b> · <span data-voted>${voted} of ${votable.length} voted</span></p>
          <div class="cup-dots">${live.map((m, i) => `<button type="button" class="cup-dot ${dot(m)}" data-goto="${i}" aria-label="Matchup ${i + 1}${ownsMatch(m) ? ', your card' : pickOf(m) ? ', voted' : ', not voted'}"${i === idx ? ' aria-current="true"' : ''}>${i + 1}</button>`).join('')}</div></div>
        <nav class="cup-nav" aria-label="Change matchup"><button type="button" class="cup-back" data-step="-1">← Back</button><span class="cup-swipe">Swipe to change matchup</span><button type="button" class="cup-next" data-step="1">Next matchup →</button></nav>
        ${live.map(section).join('')}
      </div>`);
    } else parts.push('<p class="cup-clock">The next round is about to open.</p>');
    const slot = (m, label = '') => {
      const row = (id) => { const e = byId.get(id); if (id === null) return '<li class="cup-bye">Bye</li>'; if (!e) return '<li class="cup-tbd">To be decided</li>'; const won = m.result?.winner === id; return `<li class="${won ? 'cup-won' : m.result ? 'cup-lost' : ''}${e.removed ? ' cup-removed' : ''}${myIds.has(id) ? ' cup-mine-row' : ''}"><span>${esc(nameOf(e))}${cardTag(e)}${e.removed ? ' · removed' : ''}</span>${m.result && m.a && m.b ? `<small>${m.result.votes[id] ?? 0}</small>` : ''}</li>`; };
      const open = m.a && m.b; // both cards known: the thread can be opened
      return `<ol class="cup-slot${m.bracket === 'gf' ? ' cup-gf' : ''}${ownsMatch(m) ? ' cup-own' : ''}${open ? ' cup-click' : ''}"${open ? ` data-thread="${esc(m.id)}" tabindex="0" role="button" aria-label="Open the thread: ${esc(labelOf(m.a))} vs ${esc(labelOf(m.b))}"` : ''}>${label ? `<li class="cup-tbd">${label}</li>` : ''}${row(m.a)}${row(m.b)}${open ? `<li class="cup-chat"><small>💬 ${threadCounts[m.id] ?? 0}</small></li>` : ''}</ol>`;
    };
    // The winners bracket two-sided, like March Madness: the top half runs in from the left, the
    // bottom half from the right, and the winners final and grand final sit in the middle. The
    // losers bracket runs left to right under it. Display only. Two byes meeting isn't shown. The
    // matches that decide the top 3 (winners final, grand final, losers final) are outlined.
    const k = Math.log2(size), shown = (ms) => ms.filter((m) => !(m.a === null && m.b === null));
    const column = (ms, title, side, extra = '') => ms.length ? `<div class="cup-round${side ? ` cup-${side}` : ''}${extra}"><h5>${title}</h5><div class="cup-slots-col">${ms.map((m) => slot(m)).join('')}</div></div>` : '';
    const wb = (r) => all.filter((m) => m.bracket === 'w' && m.round === r), half = (ms, right) => ms.slice(right ? ms.length / 2 : 0, right ? ms.length : ms.length / 2);
    const early = Array.from({ length: k - 1 }, (_, r) => wb(r)), label = (r) => matchLabel({ bracket: 'w', round: r }, size).replace('Winners ', '');
    const finals = `<div class="cup-round cup-center cup-prize"><h5>Finals</h5><div class="cup-slots-col">${slot(wb(k - 1)[0], 'Winners final')}${slot(all.find((m) => m.id === 'gf'), 'Grand final')}</div></div>`;
    const losers = Array.from({ length: 2 * k - 2 }, (_, r) => column(shown(all.filter((m) => m.bracket === 'l' && m.round === r)), matchLabel({ bracket: 'l', round: r }, size).replace('Losers ', ''), '', r === 2 * k - 3 ? ' cup-prize' : '')).join('');
    const nextOwn = !done && myIds.size ? all.filter((m) => !m.result && ownsMatch(m)).sort((x, y) => x.step - y.step)[0] : null;
    const yours = me != null && myIds.size && !done ? `<p class="cup-yours"><b>Your cards:</b> ${nextOwn ? `${esc(matchLabel(nextOwn, size))}, ${nextOwn.a && nextOwn.b ? (now() < nextOwn.opensAt ? `opens in ${left(nextOwn.opensAt - now())}` : `closes in ${left(nextOwn.closesAt - now())}`) : 'waiting on an opponent'}.` : 'all out.'} <button type="button" data-jump>Find them in the bracket</button></p>` : '';
    parts.push(`<h4>Winners bracket</h4><p class="cup-note">Tap any matchup to open its thread. <span class="cup-arcana">Arcana path:</span> the outlined matches decide the top 3.</p>${yours}<div class="cup-bracket">${early.map((ms, r) => column(shown(half(ms, false)), label(r), 'left')).join('')}${finals}${early.map((ms, r) => column(shown(half(ms, true)), label(r), 'right')).reverse().join('')}</div>${losers ? `<h4>Losers bracket</h4><p class="cup-note">Lose once and you drop here. Lose again and you're out. The winner meets the winners bracket's winner in the grand final.</p><div class="cup-bracket cup-losers">${losers}</div>` : ''}`);
  }
  // Fav: every entry in this bracket, seen even before voting starts, with each owner's strikes.
  if (fav && admin) {
    const list = admin.entries.filter((e) => e.category === tab && !e.removed);
    parts.push(`<details class="cup-fav" open><summary>Fav: review ${CATEGORIES[tab].name} entries (${list.length})</summary><p class="cup-note">Remove an entry that doesn't belong. It counts as a strike against its owner, and at ${admin.maxStrikes ?? MAX_STRIKES} strikes they can't enter. Before voting the entry is deleted; during voting it forfeits its match.</p>${!practicing && live.length ? '<p class="cup-note">Round running long? <button type="button" data-extend="24">Extend 24h</button> <button type="button" data-extend="48">Extend 48h</button> Every later round moves back by the same time.</p>' : ''}<div class="gallery-grid">${list.map((e) => cardOf(e, ` · ${admin.strikes?.[e.account] ?? 0}/${admin.maxStrikes ?? MAX_STRIKES} strikes${removeBtn(e)}`)).join('') || '<p>No entries.</p>'}</div></details>`);
  }
  parts.push('</div>');
  body.innerHTML = parts.join('');
  body.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.cat; drawCup(body, { viewer, signIn }); }));
  body.querySelectorAll('[data-signin]').forEach((b) => b.addEventListener('click', signIn));
  body.querySelectorAll('[data-enter]').forEach((b) => b.addEventListener('click', () => act('cup-enter', { cardSlot: Number(b.dataset.enter), category: b.dataset.category }, `Entered as ${CATEGORIES[b.dataset.category].name}. Good luck.`)));
  body.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', () => act('cup-withdraw', { entry: b.dataset.withdraw }, 'Withdrawn.')));
  body.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => confirm('Remove this entry? It counts as a strike against its owner.') && act('cup-remove', { entry: b.dataset.remove }, 'Removed. That is a strike against its owner.')));
  body.querySelector('.cup-intro')?.addEventListener('toggle', (ev) => { introOpen = ev.currentTarget.open; });
  body.querySelectorAll('[data-extend]').forEach((b) => b.addEventListener('click', () => confirm(`Give this round ${b.dataset.extend} more hours? Every later round moves back too.`) && act('cup-extend', { hours: Number(b.dataset.extend) }, 'Round extended.')));
  body.querySelector('[data-jump]')?.addEventListener('click', () => body.querySelector('.cup-bracket .cup-own')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));

  // Threads. The voting stage shows one matchup at a time and loads its thread when you land on it;
  // the bracket (and the results) open any matchup's thread in a dialog. A live thread stays shut
  // until you have voted in it, which the Worker decides.
  const threadOpts = (m, extra = {}) => ({ act: (action, details) => src.act(action, details), category: tab, match: m, me, fav, signIn, label: labelOf, who: (account, nick) => nick?.[account] ?? nicknames[account] ?? nameOf({ account }), ...extra });
  const stageEl = body.querySelector('[data-stage]');
  if (stageEl) {
    const sections = [...stageEl.querySelectorAll('.cup-match')], dots = [...stageEl.querySelectorAll('.cup-dot')], loaded = new Set();
    const prev = stageEl.querySelector('[data-step="-1"]'), next = stageEl.querySelector('[data-step="1"]');
    let at = Math.max(0, live.findIndex((m) => m.id === stageAt[tab]));
    const loadThread = (i) => { loaded.add(i); return drawThread(sections[i].querySelector('[data-thread-host]'), threadOpts(live[i], { onGoVote: () => sections[i].querySelector('[data-vote]:not(:disabled)')?.focus() })); };
    const refreshNav = () => { prev.disabled = at === 0; next.disabled = at === live.length - 1; next.classList.toggle('cup-next-primary', !!(pickOf(live[at]) || ownsMatch(live[at]))); };
    const show = (i) => {
      at = Math.max(0, Math.min(live.length - 1, i)); stageAt[tab] = live[at].id;
      sections.forEach((s, j) => { s.hidden = j !== at; });
      dots.forEach((d, j) => (j === at ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
      stageEl.querySelector('[data-pos]').textContent = `Matchup ${at + 1} of ${live.length}`;
      refreshNav();
      if (!loaded.has(at)) loadThread(at);
    };
    // Moving to another matchup zooms out to the bracket and back in on the next one (skipped for reduced motion).
    // The two cards of a matchup for the zoomed-out map, or null while a side is still to be decided.
    const zoomCards = (id) => { const m = bracket.rounds.flat().find((x) => x.id === id), a = byId.get(m?.a), b = byId.get(m?.b); return a && b ? `<div class="cup-zoom-card">${cardHtml(a)}</div><div class="cup-zoom-card">${cardHtml(b)}</div>` : null; };
    let busy = false;
    const go = async (i) => {
      i = Math.max(0, Math.min(live.length - 1, i));
      if (busy || i === at) return;
      busy = true; stageEl.classList.add('cup-busy');
      const played = !matchMedia('(prefers-reduced-motion: reduce)').matches && await zoomBetween(live[at].id, live[i].id, () => { show(i); stageEl.scrollIntoView({ block: 'start' }); }, { voted: live.filter((m) => pickOf(m)).map((m) => m.id), cards: zoomCards, title: CATEGORIES[tab].name });
      if (!played) { show(i); stageEl.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      busy = false; stageEl.classList.remove('cup-busy');
    };
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    stageEl.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => go(at + Number(b.dataset.step))));
    stageApi = {
      show,
      // A vote (or a taken-back one) updates the dots and the bar, and opens or shuts that thread.
      voted(id) {
        const i = live.findIndex((m) => m.id === id), votable = live.filter((m) => !ownsMatch(m)), n = votable.filter((m) => pickOf(m)).length, bar = stageEl.querySelector('.cup-bar');
        dots[i].className = `cup-dot ${pickOf(live[i]) ? 'done' : 'todo'}`;
        stageEl.querySelector('[data-voted]').textContent = `${n} of ${votable.length} voted`;
        bar.setAttribute('aria-valuenow', String(n)); bar.firstElementChild.style.width = `${votable.length ? (n / votable.length) * 100 : 0}%`;
        refreshNav(); loadThread(i);
      },
    };
    // Swipe on a touch screen: left for the next matchup, right for the one before. Ignored when the
    // gesture is mostly vertical (scrolling) or starts in the comments or the box.
    let t0 = null;
    stageEl.addEventListener('touchstart', (ev) => { t0 = ev.touches.length === 1 && !ev.target.closest('.cup-comments, input, .cup-dots, .cup-bar') ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null; }, { passive: true });
    stageEl.addEventListener('touchend', (ev) => {
      if (!t0) return;
      const dx = ev.changedTouches[0].clientX - t0.x, dy = ev.changedTouches[0].clientY - t0.y; t0 = null;
      if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(at + (dx < 0 ? 1 : -1));
    }, { passive: true });
    show(at);
  }
  const openThread = (id) => {
    const m = bracket?.rounds.flat().find((x) => x.id === id);
    if (!m || !m.a || !m.b) return;
    const dlg = document.createElement('dialog');
    dlg.className = 'cup-dialog'; dlg.setAttribute('aria-label', `Thread: ${matchLabel(m, bracket.size)}`);
    dlg.innerHTML = `<div class="cup-dialog-head"><h4>${esc(CATEGORIES[tab].name)} · ${esc(matchLabel(m, bracket.size))}</h4><button type="button" class="cup-close" aria-label="Close">✕</button></div><div class="cup-pair">${cardOf(byId.get(m.a))}<span class="cup-vs">vs</span>${cardOf(byId.get(m.b))}</div><div class="cup-thread-host"></div>`;
    document.body.append(dlg);
    dlg.querySelector('.cup-close').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
    dlg.showModal(); finish(dlg.querySelector('.cup-pair'));
    const i = live.findIndex((x) => x.id === m.id);
    drawThread(dlg.querySelector('.cup-thread-host'), threadOpts(m, { onGoVote: i >= 0 && stageApi ? () => { dlg.close(); stageApi.show(i); stageEl.scrollIntoView({ block: 'start', behavior: 'smooth' }); } : null }));
  };
  body.querySelectorAll('[data-thread]').forEach((el) => {
    el.addEventListener('click', () => openThread(el.dataset.thread));
    if (el.tagName !== 'BUTTON') el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openThread(el.dataset.thread); } });
  });
  // A vote only changes its own matchup's buttons, so it updates them in place: no reload, no jump.
  body.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', async () => {
    const pair = body.querySelectorAll(`[data-vote="${CSS.escape(b.dataset.vote)}"]`), pick = b.getAttribute('aria-pressed') === 'true' ? null : b.dataset.pick;
    pair.forEach((x) => { x.disabled = true; });
    try {
      await src.act('cup-vote', { category: tab, match: b.dataset.vote, pick });
      if (mine) (mine.votes ??= {})[`${tab}:${b.dataset.vote}`] = pick;
      pair.forEach((x) => { const on = x.dataset.pick === pick; x.setAttribute('aria-pressed', String(on)); x.textContent = on ? 'Your vote' : 'Vote'; });
      stageApi?.voted(b.dataset.vote);
      say(pick ? 'Vote saved. The count and the discussion are open below.' : 'Vote taken back. The discussion is shut again.');
    } catch (e) { say(e.message); }
    pair.forEach((x) => { x.disabled = false; });
  }));
  body.querySelectorAll('[data-practice]').forEach((b) => b.addEventListener('click', () => act(b.dataset.practice, {}, b.dataset.practice === 'restart' ? 'New practice bracket.' : 'Round closed.')));
  body.querySelectorAll('.gallery-grid, .cup-pair, .cup-podium').forEach(finish);
  // Rarity ratings under every card in a live matchup: the same votes as the Gallery's.
  if (cat.phase === 'voting') for (const fig of body.querySelectorAll('.cup-match figure[data-entry]')) {
    const e = byId.get(fig.dataset.entry);
    mountRating(fig, e.account, { slot: e.slot, key: e.key, counts: e.counts, total: e.total, pick: e.pick }, { viewer: me, votes, send: (rating) => src.act('cup-rate', { entry: e.id, rating }) });
  }
}
