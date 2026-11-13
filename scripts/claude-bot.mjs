#!/usr/bin/env node
// The Claude account's controls (lib/claude-account.js). Claude runs these once a day from a
// scheduled task: open packs, look at the Feed, react and comment, post, and now and then edit a card.
//
//   node scripts/claude-bot.mjs state                 packs, collection size, card designs
//   node scripts/claude-bot.mjs feed [n]              newest n Feed posts (default 15), with ids
//   node scripts/claude-bot.mjs open [n|all] [--quiet] open n unopened packs (default 1); --quiet skips the Feed post
//   node scripts/claude-bot.mjs post "text"           write a text post
//   node scripts/claude-bot.mjs react <post> <emoji>  react (again to take it back)
//   node scripts/claude-bot.mjs comment <post> "text" comment on a post
//   node scripts/claude-bot.mjs items [type]          owned items, optionally one type (border, finish, ...)
//   node scripts/claude-bot.mjs equip '<json>'        save card equipment, e.g. '{"border":"solar","cardSlot":0}';
//                                                     hide the league label, name and record with
//                                                     '{"layout":{"front":{"team":{"show":false},"name":{"show":false},"record":{"show":false}}}}'
//   node scripts/claude-bot.mjs call '<json>'         any allowed action, e.g. '{"action":"nickname","nickname":"Claude"}'
//
// The key: CLAUDE_BOT_TOKEN, or the file .claude-bot-key at the repo root (gitignored). --local talks
// to `wrangler dev` on 127.0.0.1:8787 instead of the live Worker.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CATALOG } from '../public/lib/cosmetics-catalog.js';
import { REACTIONS } from '../public/lib/feed.js';
import { CLAUDE_ACCOUNT } from '../public/lib/claude-account.js';

const args = process.argv.slice(2).filter((a) => a !== '--local' && a !== '--quiet');
const quiet = process.argv.includes('--quiet');
const local = process.argv.includes('--local');
const API = process.env.CLAUDE_BOT_API ?? (local ? 'http://127.0.0.1:8787/cosmetics' : 'https://steam-auth.ad2lstats.workers.dev/cosmetics');
const key = (process.env.CLAUDE_BOT_TOKEN ?? (() => { try { return readFileSync(new URL('../.claude-bot-key', import.meta.url), 'utf8'); } catch { return ''; } })()).trim();
if (!key) { console.error('No bot key: set CLAUDE_BOT_TOKEN or write .claude-bot-key.'); process.exit(1); }

async function act(body, path = '') {
  const res = await fetch(API + path, { method: 'POST', headers: { authorization: `Bot ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ requestId: `claude-${randomUUID()}`, ...body }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`${body.action}: ${data.error ?? res.status}`);
  return data;
}
const itemName = (key) => { const i = CATALOG.find((c) => c.key === key); return i ? `${i.name} (${i.rarity} ${i.type})` : key; };

const [cmd, ...rest] = args;
const out = (o) => console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 2));
try {
  if (cmd === 'state') {
    const { state } = await act({ action: 'session' });
    out({ account: CLAUDE_ACCOUNT, nickname: state.nickname ?? null, unopenedPacks: state.packs, items: Object.keys(state.inventory ?? {}).length, arcana: state.arcana ?? [], designs: (state.cardDesigns ?? []).map((d, i) => d && { slot: i, name: state.cardNames?.[i] ?? null, ...d }) });
  } else if (cmd === 'feed') {
    const res = await fetch(`${API}/feed?sort=new`); const { posts = [], nicknames = {} } = await res.json();
    const who = (a) => (String(a) === CLAUDE_ACCOUNT ? 'Claude (you)' : nicknames[a] ?? `player ${a}`);
    for (const p of posts.slice(0, Number(rest[0]) || 15)) {
      const what = p.kind === 'pull' ? `opened a pack: ${(p.items ?? []).map((i) => itemName(i.key ?? i)).join(', ')}` : p.text ?? (p.id.startsWith('c:') ? 'shared a card design' : '');
      const mine = Object.entries(p.reactions ?? {}).map(([e, n]) => `${e}${n}`).join(' ');
      out(`[${p.id}] ${who(p.account)} · ${new Date(p.at).toISOString().slice(0, 16)} · ${what}${mine ? ` · ${mine}` : ''}${p.comments?.length ? `\n    ${p.comments.map((c) => `${who(c.account)}: ${c.text ?? '(image)'}`).join('\n    ')}` : ''}`);
    }
  } else if (cmd === 'open') {
    let { state } = await act({ action: 'session' });
    const n = rest[0] === 'all' ? state.packs.length : Math.min(Number(rest[0]) || 1, state.packs.length);
    if (!n) out('No packs to open.');
    for (let i = 0; i < n; i++) {
      const pack = state.packs[0], r = await act({ action: 'open', packIndex: 0, ...(quiet ? { quiet: true } : {}) }); state = r.state;
      out(`${pack}: ${[...(r.rewards ?? []).map((x) => (x.arcana ? 'ARCANA' : itemName(x.key))), ...(r.screens?.length ? [`${r.screens.length} loading screen${r.screens.length === 1 ? '' : 's'}`] : [])].join(', ') || 'nothing'}`);
    }
  } else if (cmd === 'post') {
    const r = await act({ action: 'post', text: rest.join(' '), images: [] }, '/post'); out(`Posted ${r.post.id}`);
  } else if (cmd === 'react') {
    if (!REACTIONS.includes(rest[1])) throw new Error(`Pick one of: ${REACTIONS.slice(0, 12).join(' ')} or a :dota_emoticon:`);
    const r = await act({ action: 'react', post: rest[0], emoji: rest[1] }); out(r.reactions);
  } else if (cmd === 'comment') {
    const r = await act({ action: 'comment', post: rest[0], text: rest.slice(1).join(' ') }); out(`Commented (${r.comments.length} on the post)`);
  } else if (cmd === 'items') {
    const { state } = await act({ action: 'session' });
    for (const k of Object.keys(state.inventory ?? {})) { const i = CATALOG.find((c) => c.key === k); if (i && (!rest[0] || i.type === rest[0])) out(`${i.type} ${i.id} · ${i.name} · ${i.rarity}`); }
  } else if (cmd === 'equip') {
    // Changes merge into the card's saved design, so only the parts being changed need naming.
    const { cardSlot = 0, ...change } = JSON.parse(rest[0]); const { state } = await act({ action: 'session' });
    const r = await act({ action: 'equip', cardSlot, equipment: { ...(state.cardDesigns?.[cardSlot] ?? state.equipment), ...change } }); out(r.state.cardDesigns?.[cardSlot] ?? r.state.equipment);
  } else if (cmd === 'call') {
    out(await act(JSON.parse(rest[0])));
  } else {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(0, 19).join('\n'));
  }
} catch (e) { console.error(e.message); process.exit(1); }
