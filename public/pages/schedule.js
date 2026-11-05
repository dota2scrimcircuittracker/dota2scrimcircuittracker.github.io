// Scrim scheduler (#/scrims/schedule): teams ask for scrims, others answer, the asking team
// confirms one, and confirmed scrims list as upcoming (they're scrim fixtures, so Predict shows
// them too). Acting for a team takes a Steam sign-in on that team's AD2L roster. Loaded on demand.
// Player schedule (?tab=players): your weekly availability, when your team is free, and the
// team's calendar, for the teams whose roster has you.
import { esc, app, pageHead, teamLink, SOURCES, DIVISIONS, ALL_DIVS, divLite, playerTabs, wirePlayerTabs } from "../core.js";
import { loading, errorBox } from "../parts/lanes.js";
import { SCHEDULE_TABS, pageTabs } from "../lib/pagetabs.js";
import { steamAccount, steamLoginUrl, listFixtures, listScrimRequests, listScrimOffers, postScrimRequest, cancelScrimRequest, offerScrim, withdrawScrimOffer, confirmScrim, listAvailability, saveAvailability, listTeamEvents, addTeamEvent, deleteTeamEvent } from "../lib/store.js";
import { rosterTeams, requestProblem, offerProblem, openRequests, myRequests, myOffers, upcomingScrims, fixtureName, NOTE_MAX } from "../lib/scheduler.js";
import { zoneOffset, localGrid, fromGrid, overlap, bestHours, eventProblem, teamCalendar, EVENT_MINUTES, EVENT_TITLE_MAX } from "../lib/availability.js";

const KICKER = SOURCES.scrim.kicker;
const TEAM_KEY = "scrim-acting-team";

// <input type="datetime-local"> value for a Date, in the viewer's time zone, and back.
const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
const fromInput = (v) => (v ? new Date(v) : null);
const whenLabel = (d) => d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const divTag = (k) => `<span class="sch-div">${esc(DIVISIONS[k]?.short ?? k)}</span>`;
const team = (div, id, name) => (SOURCES[div] ? teamLink(SOURCES[div], name, id) : esc(name));
const boOptions = (sel) => [1, 2, 3].map((n) => `<option value="${n}" ${n === sel ? "selected" : ""}>Best of ${n}</option>`).join("");

function savedTeam(teams) {
  let v = null;
  try { v = localStorage.getItem(TEAM_KEY); } catch { /* not remembered */ }
  return teams.find((t) => `${t.div}:${t.id}` === v) ?? teams[0] ?? null;
}

export async function renderSchedule() {
  app.innerHTML = loading(KICKER, "Scrim scheduler");
  let account, requests, offers, fixtures, leagues;
  try {
    [account, requests, offers, fixtures, leagues] = await Promise.all([
      steamAccount(), listScrimRequests(), listScrimOffers(), listFixtures().catch(() => []),
      Promise.all(ALL_DIVS.map(async (key) => ({ key, data: await divLite(key).catch(() => null) }))),
    ]);
  } catch (e) { app.innerHTML = `${pageHead(KICKER, "Scrim scheduler")}${errorBox(e)}`; return; }
  const now = Date.now();
  const teams = rosterTeams(account, leagues);
  const me = savedTeam(teams);
  // Your team's schedule: only fetched for a team whose roster has you.
  let avail = null, events = null;
  if (me) [avail, events] = await Promise.all([listAvailability(me).catch((e) => { console.warn(e); return null; }), listTeamEvents(me).catch((e) => { console.warn(e); return null; })]);
  const roster = leagues.find((l) => l.key === me?.div)?.data?.teams.find((t) => t.id === me.id)?.players ?? [];
  const mineReq = myRequests(requests, offers, teams, now);
  const mineOff = myOffers(requests, offers, teams, now);
  // Everyone else's open requests, less the ones your teams have answered (under Your answers).
  const others = openRequests(requests, now).filter((r) => !mineReq.some((m) => m.id === r.id) && !mineOff.some((o) => o.request === r.id));
  const upcoming = upcomingScrims(fixtures, now);

  const who = account == null
    ? `<div class="notice">Anyone on an AD2L roster can ask for or answer a scrim for their team. <a href="${esc(steamLoginUrl())}">Sign in with Steam</a> to start.</div>`
    : !teams.length ? `<div class="notice">Your Steam account isn't on an AD2L roster, so you can't ask for or answer scrims for a team. You can still see what's open.</div>`
    : teams.length === 1 ? `<p class="sch-acting">Acting for ${team(me.div, me.id, me.name)} ${divTag(me.div)}</p>`
    : `<label class="sch-acting">Acting for <select id="sch-team">${teams.map((t) => `<option value="${t.div}:${t.id}" ${t === me ? "selected" : ""}>${esc(t.name)} (${esc(DIVISIONS[t.div].short)})</option>`).join("")}</select></label>`;

  const head = (r) => `<div class="sch-head">${team(r.div, r.team, r.team_name)} ${divTag(r.div)}</div>
    <div class="fx-meta"><b>${esc(whenLabel(r.start))}</b> · Bo${r.best_of} · open to ${r.open_to.map((k) => esc(DIVISIONS[k]?.short ?? k)).join(", ")}</div>
    ${r.note ? `<p class="sch-note">${esc(r.note)}</p>` : ""}`;

  // Your own open requests and the teams that answered them.
  const myReqHtml = mineReq.map((r) => `<article class="pred-card sch-card" data-req="${r.id}">
    ${head(r)}
    ${r.offers.length ? `<ul class="sch-offers">${r.offers.map((o) => `<li>
      ${team(o.div, o.team, o.team_name)} ${divTag(o.div)}
      <span class="${+o.start === +r.start ? "" : "sch-counter"}">${+o.start === +r.start ? "at your time" : `suggests <b>${esc(whenLabel(o.start))}</b>`}</span>
      <button type="button" class="primary" data-act="confirm" data-offer="${esc(o.id)}">Confirm</button></li>`).join("")}</ul>`
      : `<p class="muted">No answers yet.</p>`}
    <div class="fx-actions"><button type="button" class="linkish" data-act="cancel">Cancel request</button></div>
  </article>`).join("");

  // Answers your teams have given.
  const stateLabel = { waiting: "Waiting for them to confirm", won: "Confirmed", lost: "They picked another team" };
  const myOffHtml = mineOff.map((o) => `<article class="pred-card sch-card sch-${o.state}" data-req="${o.req.id}" data-offer="${esc(o.id)}">
    ${head(o.req)}
    <div class="fx-meta">${esc(o.team_name)} answered: <b>${esc(whenLabel(o.start))}</b> · ${stateLabel[o.state]}</div>
    ${o.state === "waiting" ? `<div class="fx-actions">
      <button type="button" class="linkish" data-act="show-time">Change time</button>
      <button type="button" class="linkish" data-act="withdraw">Withdraw</button></div>
      <div class="fx-move" hidden><input type="datetime-local" value="${localInput(o.start)}"><button type="button" class="primary" data-act="offer-time">Send</button></div>` : ""}
  </article>`).join("");

  const othersHtml = others.map((r) => {
    const why = me ? offerProblem(r, me, now) : null;
    const n = offers.filter((o) => o.request === r.id).length;
    const acts = !me ? "" : why ? `<p class="muted">${esc(why)}</p>`
      : `<div class="fx-actions">
          <button type="button" class="primary" data-act="accept">Accept this time</button>
          <button type="button" data-act="show-time">Suggest another time</button></div>
        <div class="fx-move" hidden><input type="datetime-local" value="${localInput(r.start)}"><button type="button" class="primary" data-act="offer-time">Send</button></div>`;
    return `<article class="pred-card sch-card" data-req="${r.id}">${head(r)}
      <div class="fx-meta muted">${n ? `${n} team${n === 1 ? " has" : "s have"} answered` : "No answers yet"}</div>${acts}</article>`;
  }).join("");

  const upcomingHtml = upcoming.length ? `<div class="table-wrap"><table class="sch-upcoming"><tbody>${upcoming.map((f) => `<tr>
      <td class="l">${esc(whenLabel(f.start))}</td>
      <td class="l">${teamLink(SOURCES.scrim, f.team_a)} <i>vs</i> ${teamLink(SOURCES.scrim, f.team_b)}</td>
      <td>Bo${f.best_of}</td></tr>`).join("")}</tbody></table></div>
      <p class="muted">Call them on <a href="#/scrims/predict">Predict</a>.</p>`
    : `<p class="muted">Nothing scheduled yet.</p>`;

  const start = new Date(now + 864e5);
  start.setMinutes(0, 0, 0);
  const postHtml = me ? `<details class="fx-add" ${mineReq.length ? "" : "open"}>
    <summary>+ Ask for a scrim as ${esc(me.name)}</summary>
    <form id="sch-form" class="fx-form">
      <label>Starts (your time)<input name="start" type="datetime-local" required value="${localInput(start)}"></label>
      <label>Format<select name="bo">${boOptions(2)}</select></label>
      <fieldset class="sch-open"><legend>Open to</legend>${ALL_DIVS.map((k) => `<label><input type="checkbox" name="open" value="${k}" ${k === me.div ? "checked" : ""}> ${esc(DIVISIONS[k].short)}</label>`).join("")}</fieldset>
      <label class="sch-note-in">Note<input name="note" maxlength="${NOTE_MAX}" placeholder="Optional: server, lobby, anything they should know"></label>
      <button type="submit" class="primary">Post</button>
    </form></details>` : "";

  const section = (title, html) => (html ? `<section class="sch-section"><h2>${title}</h2>${html}</section>` : "");
  const scrimsHtml = `${postHtml}
    ${section("Your requests", myReqHtml)}
    ${section("Your answers", myOffHtml)}
    ${section("Looking for a scrim", othersHtml || `<p class="muted">No open requests right now.</p>`)}
    ${section("Upcoming scrims", upcomingHtml)}`;
  const off = zoneOffset();
  const ps = me ? playerSchedule({ me, account, roster, avail, events, requests, off, now }) : null;
  const playersHtml = account == null
    ? `<p class="muted">Sign in with Steam to set when you can play and see your team's schedule.</p>`
    : !me ? `<p class="muted">The player schedule is for players on an AD2L roster.</p>` : ps.html;
  const tabs = playerTabs(pageTabs(SCHEDULE_TABS, SOURCES.scrim, [["scrims", scrimsHtml], ["players", playersHtml]]), { store: "scheduleTab", label: "Schedule sections" });
  app.innerHTML = `${pageHead(KICKER, "Scrim scheduler", "Times show in your time zone.", tabs.bar)}
    ${who}
    <div id="sch-msg"></div>
    ${tabs.panels}`;
  wirePlayerTabs();

  const say = (cls, text) => { app.querySelector("#sch-msg").innerHTML = `<div class="notice ${cls}">${esc(text)}</div>`; };
  const run = async (fn, fail) => {
    try { await fn(); renderSchedule(); } catch (e) { console.warn(e); say("err", `${fail}: ${e.message}`); }
  };

  app.querySelector("#sch-team")?.addEventListener("change", (e) => {
    try { localStorage.setItem(TEAM_KEY, e.target.value); } catch { /* not remembered */ }
    renderSchedule();
  });

  if (ps) ps.wire(run, say);

  app.querySelector("#sch-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fm = e.target;
    const req = { start: fromInput(fm.start.value), best_of: Number(fm.bo.value), open_to: [...fm.querySelectorAll("[name=open]:checked")].map((x) => x.value), note: fm.note.value.trim() };
    const why = requestProblem(req, ALL_DIVS);
    if (why) { say("err", why); return; }
    run(() => postScrimRequest(me, req), "Couldn't post it");
  });

  app.querySelectorAll(".sch-card").forEach((card) => card.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const r = requests.find((x) => x.id === card.dataset.req);
    const act = b.dataset.act;
    if (act === "show-time") { const m = card.querySelector(".fx-move"); m.hidden = !m.hidden; return; }
    if (act === "accept") run(() => offerScrim(r.id, me, r.start), "Couldn't send it");
    if (act === "offer-time") {
      const when = fromInput(card.querySelector(".fx-move input").value);
      if (!when || +when <= Date.now()) { say("err", "Pick a time that hasn't passed."); return; }
      // Changing an answer keeps the team it was sent as.
      const o = offers.find((x) => x.id === card.dataset.offer);
      const as = o ? teams.find((t) => t.div === o.div && t.id === o.team) : me;
      run(() => offerScrim(r.id, as, when), "Couldn't send it");
    }
    if (act === "withdraw" && confirm("Withdraw this answer?")) run(() => withdrawScrimOffer(card.dataset.offer), "Couldn't withdraw it");
    if (act === "cancel" && confirm("Cancel this request? Teams that answered will see it closed.")) run(() => cancelScrimRequest(r.id), "Couldn't cancel it");
    if (act === "confirm") {
      const o = offers.find((x) => x.id === b.dataset.offer);
      if (!confirm(`Confirm the scrim with ${o.team_name} at ${whenLabel(o.start)}?`)) return;
      run(() => confirmScrim(r, o, { team_a: fixtureName(r.team_name), team_b: fixtureName(o.team_name) }), "Couldn't confirm it");
    }
  }));
}

// ---------- Player schedule ----------
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hourLabel = (h) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
const hourHead = `<thead><tr><th></th>${[...Array(24)].map((_, h) => `<th scope="col">${h % 3 ? "" : hourLabel(h)}</th>`).join("")}</tr></thead>`;

// The Player schedule tab for team `me`: { html, wire }. avail/events null when they couldn't load.
function playerSchedule({ me, account, roster, avail, events, requests, off, now }) {
  if (!avail || !events) return { html: `<div class="notice err">Couldn't load your team's schedule.</div>`, wire() {} };
  const nameOf = (a) => roster.find((p) => Number(p.account_id) === Number(a))?.name ?? String(a);
  const mine = avail.find((x) => Number(x.account) === Number(account));
  const grid = localGrid(mine?.slots, off);
  const others = avail.filter((x) => roster.some((p) => Number(p.account_id) === Number(x.account)));
  const free = overlap(others.map((x) => ({ name: nameOf(x.account), slots: x.slots })), off);
  const size = Math.max(roster.length, 1);
  const best = bestHours(free, Math.min(2, others.length));
  const cal = teamCalendar(events, requests, me, now);

  const mineHtml = `<p class="muted">Tap or drag across the hours you can usually play each week, then save.</p>
    <div class="av-wrap"><table class="av-grid av-mine">${hourHead}<tbody>${grid.map((row, d) => `<tr><th scope="row">${DAYS[d]}</th>${row.map((on, h) =>
      `<td><button type="button" class="av-cell${on ? " on" : ""}" data-d="${d}" data-h="${h}" aria-pressed="${on}" aria-label="${DAYS[d]} ${hourLabel(h)}"></button></td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="fx-actions"><button type="button" class="primary" id="av-save" disabled>Save availability</button>${mine ? "" : `<span class="muted">Not saved yet.</span>`}</div>`;

  const teamHtml = `<div class="av-wrap"><table class="av-grid av-team">${hourHead}<tbody>${free.map((row, d) => `<tr><th scope="row">${DAYS[d]}</th>${row.map((names, h) =>
      `<td><span class="av-heat" style="--a:${(names.length / size).toFixed(2)}" title="${esc(`${DAYS[d]} ${hourLabel(h)}: ${names.length} of ${roster.length} free${names.length ? ` (${names.join(", ")})` : ""}`)}">${names.length || ""}</span></td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${best.length ? `<p class="av-best">Best times: ${best.map((b) => `<b>${DAYS[b.d]} ${hourLabel(b.h)}</b> ${b.names.length}/${roster.length}`).join(" · ")}</p>` : ""}
    <p class="muted">Filled in: ${roster.map((p) => `${others.some((x) => Number(x.account) === Number(p.account_id)) ? "✓" : "–"} ${esc(p.name)}`).join(" · ")}</p>`;

  const start = new Date(now + 864e5);
  start.setMinutes(0, 0, 0);
  const calHtml = `${cal.length ? `<ul class="av-cal">${cal.map((e) => `<li data-ev="${esc(e.id)}">
      <b>${esc(whenLabel(e.start))}</b> <span class="sch-div">${e.kind === "scrim" ? "Scrim" : "Team"}</span> ${esc(e.title)} <span class="muted">· ${e.minutes} min</span>
      ${e.kind === "event" ? `<button type="button" class="linkish" data-act="del-event">Delete</button>` : ""}</li>`).join("")}</ul>` : `<p class="muted">Nothing on the calendar yet.</p>`}
    <details class="fx-add"><summary>+ Add a team event</summary>
      <form id="ev-form" class="fx-form">
        <label>What<input name="title" maxlength="${EVENT_TITLE_MAX}" required placeholder="Practice, VOD review…"></label>
        <label>Starts (your time)<input name="start" type="datetime-local" required value="${localInput(start)}"></label>
        <label>Length<select name="minutes">${EVENT_MINUTES.map((m) => `<option value="${m}" ${m === 120 ? "selected" : ""}>${m < 60 ? `${m} min` : `${m / 60} h`}</option>`).join("")}</select></label>
        <button type="submit" class="primary">Add</button>
      </form></details>`;

  const html = `<p class="muted">Only players on the ${esc(me.name)} roster see this.</p>
    <section class="sch-section"><h2>Your availability</h2>${mineHtml}</section>
    <section class="sch-section"><h2>When ${esc(me.name)} is free</h2>${teamHtml}</section>
    <section class="sch-section"><h2>Team calendar</h2>${calHtml}</section>`;

  function wire(run, say) {
    const table = app.querySelector(".av-mine"), save = app.querySelector("#av-save");
    let paint = null, last = null;
    const cellAt = (d, h) => table.querySelector(`.av-cell[data-d="${d}"][data-h="${h}"]`);
    const one = (cell) => {
      grid[cell.dataset.d][cell.dataset.h] = paint;
      cell.classList.toggle("on", paint);
      cell.setAttribute("aria-pressed", String(paint));
    };
    // Paint a cell and every cell on the way from the last one: pointer events come too sparsely
    // on a fast drag to land on each cell.
    const set = (cell) => {
      if (!cell?.matches?.(".av-cell")) return;
      const d = +cell.dataset.d, h = +cell.dataset.h;
      const n = last ? Math.max(Math.abs(d - last.d), Math.abs(h - last.h)) : 0;
      for (let i = 1; i <= n; i++) one(cellAt(Math.round(last.d + ((d - last.d) * i) / n), Math.round(last.h + ((h - last.h) * i) / n)));
      one(cell);
      last = { d, h };
      save.disabled = false;
    };
    // Press a cell to flip it, then drag to paint the same value across others (mouse or touch).
    table.addEventListener("pointerdown", (e) => {
      const cell = e.target.closest(".av-cell");
      if (!cell) return;
      e.preventDefault();
      paint = !cell.classList.contains("on");
      set(cell);
    });
    table.addEventListener("pointermove", (e) => { if (paint != null) set(document.elementFromPoint(e.clientX, e.clientY)); });
    addEventListener("pointerup", () => { paint = null; last = null; });
    // Keyboard: Enter or Space on a focused cell (no pointer events for those).
    table.addEventListener("click", (e) => {
      const c = e.target.closest(".av-cell");
      if (c && e.detail === 0) { paint = !c.classList.contains("on"); set(c); paint = null; last = null; }
    });
    save.addEventListener("click", () => run(() => saveAvailability(me, fromGrid(grid, off)), "Couldn't save it"));

    app.querySelector("#ev-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fm = e.target;
      const ev = { title: fm.title.value.trim(), start: fromInput(fm.start.value), minutes: Number(fm.minutes.value) };
      const why = eventProblem(ev);
      if (why) { say("err", why); return; }
      run(() => addTeamEvent(me, ev), "Couldn't add it");
    });
    app.querySelector(".av-cal")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act=del-event]");
      if (b && confirm("Delete this event?")) run(() => deleteTeamEvent(b.closest("li").dataset.ev), "Couldn't delete it");
    });
  }
  return { html, wire };
}
