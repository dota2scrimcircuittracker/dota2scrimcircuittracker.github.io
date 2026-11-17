// Stream kit (#/<league>/stream-kit): pick any set of teams and get each player's OBS card link
// (parts/stream-card.js, ?stream=card) plus an OBS scene collection to import (lib/stream-kit.js).
// The picked teams ride in the address (?teams=<id>,<id>) so a set can be shared as a link.
import { app, pageHead, esc, SOURCES } from "../core.js";
import { obsCollection, streamCardUrl, CARD_W, CARD_H } from "../lib/stream-kit.js";
import { loading, errorBox } from "../parts/lanes.js";

const picked = () => new Set((new URLSearchParams(location.search).get("teams") ?? "").split(",").filter(Boolean));
function savePicked(ids) {
  const url = new URL(location.href);
  if (ids.size) url.searchParams.set("teams", [...ids].join(",")); else url.searchParams.delete("teams");
  history.replaceState(history.state, "", url);
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "teams";

export async function renderStreamKit(src) {
  app.innerHTML = loading(src.kicker, "Stream kit");
  let teams;
  try { teams = (await src.data()).teams.filter((t) => t.players?.length).sort((a, b) => a.name.localeCompare(b.name)); }
  catch (e) { app.innerHTML = `${pageHead(src.kicker, "Stream kit")}${errorBox(e)}`; return; }
  // Cards live on the division's own player pages, also for a sub-division view.
  const rootUrl = `${location.origin}/${(SOURCES[src.key] ?? src).root.replace(/^#\//, "")}`;
  const sel = new Set([...picked()].filter((id) => teams.some((t) => String(t.id) === id)));

  app.innerHTML = `${pageHead(src.kicker, "Stream kit")}
    <div class="stream-kit reveal" style="--i:2">
      <p class="muted">Player cards for your stream: animated, on a transparent background, loaded live from the site. Pick the teams, then import the OBS scenes or copy single card links.</p>
      <section class="panel sk-teams">
        <header><h3>Teams</h3><span><button type="button" class="sk-link" data-all>All</button> · <button type="button" class="sk-link" data-none>None</button></span></header>
        <div class="sk-team-grid">${teams.map((t) => `<label><input type="checkbox" value="${esc(t.id)}" ${sel.has(String(t.id)) ? "checked" : ""}> ${esc(t.name)}</label>`).join("")}</div>
      </section>
      <div data-out></div>
    </div>`;

  const out = app.querySelector("[data-out]");
  const chosen = () => teams.filter((t) => sel.has(String(t.id)));
  const draw = () => {
    const list = chosen();
    savePicked(sel);
    if (!list.length) { out.innerHTML = `<p class="muted sk-empty">Pick one or more teams.</p>`; return; }
    const cards = list.reduce((n, t) => n + t.players.length, 0);
    out.innerHTML = `
      <section class="panel">
        <h3>Import into OBS</h3>
        <ol class="sk-steps">
          <li><button type="button" data-download>Download OBS scenes</button> <span class="muted">${list.length} team${list.length > 1 ? "s" : ""}, ${cards} cards</span></li>
          <li>In OBS: <b>Scene Collection → Import</b>, pick the file, then switch to it under <b>Scene Collection</b>.</li>
          <li>You get a scene per team (its cards in a row) and a scene per player (one big card). Copy any card source into your own scenes.</li>
        </ol>
        <p class="muted">Share this set: <button type="button" class="sk-link" data-share>copy this page's link</button> <span class="sk-msg" role="status" aria-live="polite"></span></p>
      </section>
      <section class="panel">
        <h3>Or one card at a time</h3>
        <p class="muted">Add a <b>Browser Source</b> with the link, width ${CARD_W}, height ${CARD_H}. Right-click it and choose <b>Refresh</b> to pick up card changes.</p>
        ${list.map((t) => `<div class="sk-team"><h4>${esc(t.name)}</h4>${t.players.map((p) => {
          const url = streamCardUrl(rootUrl, p.account_id);
          return `<div class="sk-row"><span class="sk-name">${esc(p.name)}</span><code>${esc(url)}</code><button type="button" class="sk-copy" data-url="${esc(url)}">Copy</button><a href="${esc(url)}" target="_blank" rel="noopener">Open</a></div>`;
        }).join("")}</div>`).join("")}
      </section>`;
  };

  app.querySelector(".sk-team-grid").addEventListener("change", (e) => {
    if (!e.target.matches("input[type=checkbox]")) return;
    if (e.target.checked) sel.add(e.target.value); else sel.delete(e.target.value);
    draw();
  });
  const setAll = (on) => { app.querySelectorAll(".sk-team-grid input").forEach((c) => { c.checked = on; if (on) sel.add(c.value); else sel.delete(c.value); }); draw(); };
  app.querySelector("[data-all]").onclick = () => setAll(true);
  app.querySelector("[data-none]").onclick = () => setAll(false);

  const copy = async (text, btn, done = "Copied") => {
    try { await navigator.clipboard.writeText(text); btn.textContent = done; } catch { btn.textContent = "Copy failed"; }
    setTimeout(() => { btn.textContent = btn.dataset.label ?? "Copy"; }, 1500);
  };
  out.addEventListener("click", (e) => {
    const c = e.target.closest(".sk-copy");
    if (c) return copy(c.dataset.url, c);
    const s = e.target.closest("[data-share]");
    if (s) { s.dataset.label ??= s.textContent; return copy(location.href, s); }
    if (e.target.closest("[data-download]")) {
      const list = chosen();
      const json = obsCollection(list.map((t) => ({ name: t.name, players: t.players.map((p) => ({ name: p.name, account: p.account_id })) })), rootUrl,
        { name: list.length === 1 ? `DSL - ${list[0].name}` : `DSL Stream Kit - ${src.division ?? "Scrim League"}` });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 1)], { type: "application/json" }));
      a.download = `dsl-stream-kit-${slug(list.length === 1 ? list[0].name : src.division ?? "teams")}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  });
  draw();
}
