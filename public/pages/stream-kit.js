// Stream kit (#/<league>/stream-kit, every league): pick any teams or single players, choose which of
// each player's saved cards to show, and get their OBS card links (parts/stream-card.js, ?stream=card)
// plus an OBS scene collection to import (lib/stream-kit.js). Scrims use the Champion rosters (scrim
// teams are the Champion teams) with scrim-stat cards; All divisions links each team to its own league.
// The picks ride in the address (?picks=<team>:<account>[:<slot>],…) so a set can be shared as a link;
// the older ?teams=<id>,… still opens with those teams' whole rosters.
import { app, pageHead, esc, SOURCES } from "../core.js";
import { obsCollection, streamCardUrl, CARD_W, CARD_H } from "../lib/stream-kit.js";
import { publicCollection } from "../lib/cosmetics.js";
import { cardDesignState, cardSlotName } from "../lib/cosmetics-engine.js";
import { loading, errorBox } from "../parts/lanes.js";

const absolute = (root) => `${location.origin}/${root.replace(/^#\//, "")}`;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "teams";

async function kitTeams(src) {
  const scrim = src.key === "scrim";
  const d = await (scrim ? SOURCES.ad2l.data() : src.data());
  return d.teams.filter((t) => t.players?.length).map((t) => ({
    id: String(t.id), name: t.name, group: src.all ? t.division : null,
    rootUrl: absolute(scrim ? SOURCES.scrim.root : src.all ? SOURCES[t.league].root : (SOURCES[src.key] ?? src).root),
    players: t.players.map((p) => ({ name: p.name, account: String(p.account_id) })),
  })).sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.name.localeCompare(b.name));
}

// Each player's saved card designs, fetched once: [{ slot, name, primary }].
const designsOf = new Map();
function cardChoices(account) {
  if (!designsOf.has(account)) designsOf.set(account, publicCollection(account).then((data) => {
    const prefs = cardDesignState(data);
    return prefs.cardOrder.filter((i) => prefs.cardDesigns[i]).map((i) => ({ slot: i, name: cardSlotName(prefs, i), primary: i === prefs.primaryCard }));
  }).catch(() => []));
  return designsOf.get(account);
}

export async function renderStreamKit(src) {
  app.innerHTML = loading(src.kicker, "Stream kit");
  let teams;
  try { teams = await kitTeams(src); }
  catch (e) { app.innerHTML = `${pageHead(src.kicker, "Stream kit")}${errorBox(e)}`; return; }
  const byId = new Map(teams.map((t) => [t.id, t]));

  // Picks: "<team>:<account>" → slot (null: the player's main card).
  const picks = new Map();
  const q = new URLSearchParams(location.search);
  for (const part of (q.get("picks") ?? "").split(",").filter(Boolean)) {
    const [team, account, slot] = part.split(":");
    if (byId.get(team)?.players.some((p) => p.account === account)) picks.set(`${team}:${account}`, /^\d+$/.test(slot ?? "") ? Number(slot) : null);
  }
  for (const id of (q.get("teams") ?? "").split(",")) for (const p of byId.get(id)?.players ?? []) if (!picks.has(`${id}:${p.account}`)) picks.set(`${id}:${p.account}`, null);
  const save = () => {
    const url = new URL(location.href);
    url.searchParams.delete("teams");
    if (picks.size) url.searchParams.set("picks", [...picks].map(([k, s]) => (s == null ? k : `${k}:${s}`)).join(",")); else url.searchParams.delete("picks");
    history.replaceState(history.state, "", url);
  };

  const teamRow = (t) => `<div class="sk-team-pick" data-team="${esc(t.id)}" data-search="${esc([t.name, ...t.players.map((p) => p.name)].join(" ").toLowerCase())}">
      <label class="sk-team-box"><input type="checkbox" data-team-box> <span>${esc(t.name)}</span></label>
      <details><summary><span data-count></span></summary><div class="sk-players">${t.players.map((p) => `<label><input type="checkbox" data-player="${esc(p.account)}"> ${esc(p.name)}</label>`).join("")}</div></details>
    </div>`;
  let lastGroup;
  const groups = teams.map((t) => { const head = t.group && t.group !== lastGroup ? `<h4 class="sk-group">${esc(t.group)}</h4>` : ""; lastGroup = t.group; return head + teamRow(t); }).join("");

  app.innerHTML = `${pageHead(src.kicker, "Stream kit")}
    <div class="stream-kit reveal" style="--i:2">
      <p class="muted">Player cards for your stream: animated, on a transparent background, loaded live from the site. Pick teams or single players, choose each player's card, then import the OBS scenes or copy card links.</p>
      <section class="panel sk-teams">
        <header><h3>Teams and players</h3><span><input type="search" class="sk-filter" placeholder="Filter teams or players" aria-label="Filter teams or players"> <button type="button" class="sk-link" data-none>Clear</button></span></header>
        <div class="sk-team-grid">${groups}</div>
      </section>
      <div data-out></div>
    </div>`;

  const grid = app.querySelector(".sk-team-grid"), out = app.querySelector("[data-out]");
  // Checkboxes follow the picks: a team box is ticked when all its players are, half when some are.
  const syncBoxes = () => {
    for (const row of grid.querySelectorAll(".sk-team-pick")) {
      const t = byId.get(row.dataset.team), n = t.players.filter((p) => picks.has(`${t.id}:${p.account}`)).length;
      row.querySelectorAll("[data-player]").forEach((c) => { c.checked = picks.has(`${t.id}:${c.dataset.player}`); });
      const box = row.querySelector("[data-team-box]");
      box.checked = n === t.players.length; box.indeterminate = n > 0 && n < t.players.length;
      row.querySelector("[data-count]").textContent = n ? `${n} of ${t.players.length} players` : `${t.players.length} players`;
      if (n && n < t.players.length) row.querySelector("details").open = true;
    }
  };
  // The picks grouped by team, in the list's order: [{ team, players: [{ ...player, slot }] }].
  const picked = () => teams.map((t) => ({ team: t, players: t.players.filter((p) => picks.has(`${t.id}:${p.account}`)).map((p) => ({ ...p, slot: picks.get(`${t.id}:${p.account}`) })) })).filter((g) => g.players.length);

  const draw = () => {
    syncBoxes(); save();
    const list = picked();
    if (!list.length) { out.innerHTML = `<p class="muted sk-empty">Pick one or more teams or players.</p>`; return; }
    const cards = list.reduce((n, g) => n + g.players.length, 0);
    out.innerHTML = `
      <section class="panel">
        <h3>Import into OBS</h3>
        <ol class="sk-steps">
          <li><button type="button" data-download>Download OBS scenes</button> <span class="muted">${list.length} team${list.length > 1 ? "s" : ""}, ${cards} card${cards > 1 ? "s" : ""}</span></li>
          <li>In OBS: <b>Scene Collection → Import</b>, pick the file, then switch to it under <b>Scene Collection</b>.</li>
          <li>You get a scene per team (its picked cards in a row) and a scene per player (one big card). Copy any card source into your own scenes.</li>
        </ol>
        <p class="muted">Share this set: <button type="button" class="sk-link" data-share>copy this page's link</button></p>
      </section>
      <section class="panel">
        <h3>Cards</h3>
        <p class="muted">Pick each player's card. One at a time: add a <b>Browser Source</b> with the link, width ${CARD_W}, height ${CARD_H}. Right-click it and choose <b>Refresh</b> to pick up card changes.</p>
        ${list.map(({ team, players }) => `<div class="sk-team"><h4>${esc(team.name)}</h4>${players.map((p) => {
          const url = streamCardUrl(team.rootUrl, p.account, p.slot);
          return `<div class="sk-row" data-key="${esc(`${team.id}:${p.account}`)}"><span class="sk-name">${esc(p.name)}</span>
            <select class="sk-card" aria-label="${esc(p.name)}'s card"><option value="">Main card</option>${p.slot != null ? `<option value="${p.slot}" selected>Card ${p.slot + 1}</option>` : ""}</select>
            <code>${esc(url)}</code><button type="button" class="sk-copy">Copy</button><a href="${esc(url)}" target="_blank" rel="noopener">Open</a></div>`;
        }).join("")}</div>`).join("")}
      </section>`;
    // Fill each player's card list once their saved designs arrive.
    for (const row of out.querySelectorAll(".sk-row")) {
      const [, account] = row.dataset.key.split(":");
      cardChoices(account).then((choices) => {
        const sel = row.querySelector(".sk-card"); if (!sel.isConnected) return;
        const slot = picks.get(row.dataset.key);
        // "Main card" follows whichever design the player makes main later; the rest are fixed picks.
        const main = choices.find((c) => c.primary);
        sel.innerHTML = `<option value="">Main card${main ? ` (${esc(main.name)})` : ""}</option>${choices.filter((c) => !c.primary || c.slot === slot).map((c) => `<option value="${c.slot}">${esc(c.name)}</option>`).join("")}`;
        sel.value = slot == null ? "" : String(slot);
        sel.disabled = !choices.length;
        if (!choices.length) sel.title = "No saved cards: shows the site's default card";
      });
    }
  };
  const rowUrl = (row) => { const [team, account] = row.dataset.key.split(":"); return streamCardUrl(byId.get(team).rootUrl, account, picks.get(row.dataset.key)); };

  grid.addEventListener("change", (e) => {
    const row = e.target.closest(".sk-team-pick"); if (!row) return;
    const t = byId.get(row.dataset.team);
    if (e.target.matches("[data-team-box]")) for (const p of t.players) { const k = `${t.id}:${p.account}`; if (e.target.checked) { if (!picks.has(k)) picks.set(k, null); } else picks.delete(k); }
    else if (e.target.matches("[data-player]")) { const k = `${t.id}:${e.target.dataset.player}`; if (e.target.checked) picks.set(k, picks.get(k) ?? null); else picks.delete(k); }
    draw();
  });
  app.querySelector(".sk-filter").addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    grid.querySelectorAll(".sk-team-pick").forEach((r) => { r.hidden = !!term && !r.dataset.search.includes(term); });
    grid.querySelectorAll(".sk-group").forEach((h) => { let n = h.nextElementSibling, any = false; while (n && !n.matches(".sk-group")) { any ||= !n.hidden; n = n.nextElementSibling; } h.hidden = !any; });
  });
  app.querySelector("[data-none]").onclick = () => { picks.clear(); draw(); };

  out.addEventListener("change", (e) => {
    const sel = e.target.closest(".sk-card"); if (!sel) return;
    const row = sel.closest(".sk-row");
    picks.set(row.dataset.key, sel.value === "" ? null : Number(sel.value));
    const url = rowUrl(row);
    row.querySelector("code").textContent = url; row.querySelector("a").href = url;
    save();
  });
  const flash = (btn, text) => { const was = btn.textContent; btn.textContent = text; setTimeout(() => { btn.textContent = was; }, 1500); };
  const copy = (text, btn) => navigator.clipboard.writeText(text).then(() => flash(btn, "Copied"), () => flash(btn, "Copy failed"));
  out.addEventListener("click", async (e) => {
    const c = e.target.closest(".sk-copy");
    if (c) return copy(rowUrl(c.closest(".sk-row")), c);
    const s = e.target.closest("[data-share]");
    if (s) return copy(location.href, s);
    if (!e.target.closest("[data-download]")) return;
    const list = picked();
    // Card names for the OBS sources, where a player shows one of their saved designs.
    const named = await Promise.all(list.map(async ({ team, players }) => ({ name: team.name, rootUrl: team.rootUrl,
      players: await Promise.all(players.map(async (p) => ({ name: p.name, account: p.account, slot: p.slot,
        card: p.slot == null ? null : (await cardChoices(p.account)).find((c) => c.slot === p.slot)?.name ?? `Card ${p.slot + 1}` }))) })));
    const one = list.length === 1 ? list[0].team.name : null;
    const json = obsCollection(named, list[0].team.rootUrl, { name: one ? `DSL - ${one}` : `DSL Stream Kit - ${src.division ?? "Scrims"}` });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 1)], { type: "application/json" }));
    a.download = `dsl-stream-kit-${slug(one ?? src.division ?? "scrims")}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  draw();
}
