// A matchup's discussion thread (Gallery › Arcana Cup). While the match is live the Worker keeps
// the thread, and the live vote count with it, shut until you have voted in it; this draws the lock,
// then the count, the comments and the box to add one. Used under the voting stage and in the
// bracket's thread viewer. `act` is the cup's action function (the Worker, or practice).
import { esc } from '../core.js';
import { plainMentions } from '../lib/mentions.js';

const ago = (ms) => { const m = Math.floor(Math.max(0, ms) / 6e4); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`; };
export const MAX_THREAD_TEXT = 280;

// opts: act, category, match ({ id, a, b }), me (the viewer, null when signed out), fav, who(account,
// nicknames) → display name, label(entryId) → card label, signIn, onGoVote (offered on a shut live thread).
export async function drawThread(host, opts) {
  const { act, category, match, me, fav, who, label, signIn, onGoVote } = opts;
  if (me == null) {
    host.innerHTML = '<div class="cup-thread cup-locked"><p>Sign in to read and join the discussion.</p><button type="button" data-signin>Sign in with Steam</button></div>';
    host.querySelector('[data-signin]')?.addEventListener('click', signIn);
    return;
  }
  host.innerHTML = '<p class="cup-note">Loading the discussion…</p>';
  let r;
  try { r = await act('cup-thread', { category, match: match.id }); }
  catch (e) { host.innerHTML = `<p class="cup-note">${esc(e.message)}</p>`; return; }
  if (!host.isConnected) return;
  const redraw = () => drawThread(host, opts);
  if (r.locked) {
    host.innerHTML = `<div class="cup-thread cup-locked"><p><b>Vote to open the discussion.</b> The vote count and the ${r.count} comment${r.count === 1 ? '' : 's'} stay hidden until you pick a card.</p>${r.live && onGoVote ? '<button type="button" data-go-vote>Go vote in this matchup</button>' : ''}</div>`;
    host.querySelector('[data-go-vote]')?.addEventListener('click', onGoVote);
    return;
  }
  const a = r.counts[match.a] ?? 0, b = r.counts[match.b] ?? 0, total = a + b, pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const shown = r.comments.filter((c) => !c.removed);
  const side = (id, n, cls) => `<span class="cup-split-${cls}${r.mine === id ? ' cup-split-mine' : ''}" style="flex:${total ? n : 1}"><small>${esc(label(id))}</small><b>${n}</b></span>`;
  host.innerHTML = `<div class="cup-thread">
    <div class="cup-split${total ? '' : ' cup-split-empty'}" role="img" aria-label="${esc(label(match.a))} ${a} votes, ${esc(label(match.b))} ${b} votes">${side(match.a, a, 'a')}${side(match.b, b, 'b')}</div>
    <p class="cup-note">${r.live ? `${total ? `${pct(a)}% to ${pct(b)}%` : 'No votes yet'} · live count, final when the round closes.` : 'Final count.'}</p>
    <h5>Discussion (${shown.length})</h5>
    <ul class="cup-comments">${shown.map((c) => `<li data-comment="${esc(c.id)}"><div><b>${esc(who(c.account, r.nicknames))}</b> <time>${ago(r.serverNow - c.at)}</time>${String(c.account) === String(me) || fav ? ` <button type="button" class="linkish" data-del="${esc(c.id)}">Delete</button>` : ''}</div><p>${esc(plainMentions(c.text))}</p></li>`).join('') || '<li class="cup-note">Nobody has said anything yet.</li>'}</ul>
    ${r.canComment ? `<form class="cup-say"><input maxlength="${MAX_THREAD_TEXT}" placeholder="Say why you picked it…" aria-label="Add to the discussion" required><button type="submit">Post</button></form>` : `<p class="cup-note">${r.live ? 'Only people who voted in this matchup can post.' : 'Voting on this matchup is closed, so the thread is read-only.'}</p>`}
    <p class="cup-thread-status cup-status" role="status"></p>
  </div>`;
  const say = (msg) => { const s = host.querySelector('.cup-thread-status'); if (s) s.textContent = msg; };
  host.querySelector('.cup-say')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const input = ev.currentTarget.querySelector('input'), btns = ev.currentTarget.querySelectorAll('button, input');
    btns.forEach((x) => { x.disabled = true; });
    try { await act('cup-comment', { category, match: match.id, text: input.value }); await redraw(); }
    catch (e) { say(e.message); btns.forEach((x) => { x.disabled = false; }); }
  });
  host.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try { await act('cup-comment-delete', { category, match: match.id, comment: btn.dataset.del }); await redraw(); }
    catch (e) { say(e.message); btn.disabled = false; }
  }));
}
