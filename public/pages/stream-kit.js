// Stream kit (#/<league>/stream-kit, every league): pick any teams or single players, choose which of
// each player's saved cards to show, and get their OBS card links (parts/stream-card.js, ?stream=card)
// plus an OBS scene collection to import (lib/stream-kit.js). Scrims use the Champion rosters (scrim
// teams are the Champion teams) with scrim-stat cards; All divisions links each team to its own league.
// "Card for everyone" sets every pick to their main, highest rated or most recent card (and new picks
// follow it); "View cards" shows one player's designs to pick from.
// The picks ride in the address (?picks=<team>:<account>[:<slot>],…&cards=<mode>) so a set can be
// shared as a link; the older ?teams=<id>,… still opens with those teams' whole rosters.
import { app, pageHead, esc, SOURCES } from "../core.js";
import { obsCollection, streamCardUrl, pickSlot, CARD_MODES, CARD_W, CARD_H } from "../lib/stream-kit.js";
import { publicCollection, cardRatings } from "../lib/cosmetics.js";
import { cardDesignState, cardSlotName } from "../lib/cosmetics-engine.js";
import { createPlayerCards, PAINT_FILTER, fitDesignCards } from "../parts/player-card.js";
import { divisionTiers } from "../parts/tiers.js";
import { loading, errorBox } from "../parts/lanes.js";

const absolute = (root) => `${location.origin}/${root.replace(/^#\//, "")}`;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "teams";
const RATING_NAME = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };

async function kitTeams(src) {
  const scrim = src.key === "scrim";
  const d = await (scrim ? SOURCES.ad2l.data() : src.data());
  return d.teams.filter((t) => t.players?.length).map((t) => ({
    id: String(t.id), name: t.name, group: src.all ? t.division : null,
    rootUrl: absolute(scrim ? SOURCES.scrim.root : src.all ? SOURCES[t.league].root : (SOURCES[src.key] ?? src).root),
    players: t.players.map((p) => ({ name: p.name, account: String(p.account_id) })),
  })).sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.name.localeCompare(b.name));
}

// Each player's saved cards, fetched once: { data, designs: [{ slot, name, primary, design, pick, total, savedAt }] }.
const cardsOf = new Map();
function playerDesigns(account) {
  if (!cardsOf.has(account)) cardsOf.set(account, Promise.all([publicCollection(account), cardRatings(account).catch(() => [])]).then(([data, ratings]) => {
    const prefs = cardDesignState(data);
    const designs = prefs.cardOrder.filter((i) => prefs.cardDesigns[i]).map((i) => ({
      slot: i, name: cardSlotName(prefs, i), primary: i === prefs.primaryCard, design: prefs.cardDesigns[i],
      pick: ratings?.[i]?.pick ?? null, total: ratings?.[i]?.total ?? 0, savedAt: data.cardSavedAt?.[i] ?? 0,
    }));
    return { data, designs };
  }).catch(() => ({ data: null, designs: [] })));
  return cardsOf.get(account);
}
const choiceName = (designs, slot) => (slot == null ? `Main card${(n => (n ? ` (${n})` : ""))(designs.find((d) => d.primary)?.name)}` : designs.find((d) => d.slot === slot)?.name ?? `Card ${slot + 1}`);

export async function renderStreamKit(src) {
  app.innerHTML = loading(src.kicker, "Stream kit");
  let teams;
  try { teams = await kitTeams(src); }
  catch (e) { app.innerHTML = `${pageHead(src.kicker, "Stream kit")}${errorBox(e)}`; return; }
  const byId = new Map(teams.map((t) => [t.id, t]));
  // The card renderer for the pop-up, built on first use from this league's games.
  let renderer = null;
  const getRenderer = () => (renderer ??= Promise.all([(src.key === "scrim" ? SOURCES.scrim : src).load(), divisionTiers().catch(() => new Map())]).then(([matches, tiers]) => ({ matches, tiers })));

  // Picks: "<team>:<account>" → slot (null: the player's main card).
  const picks = new Map();
  const q = new URLSearchParams(location.search);
  let mode = CARD_MODES.some(([m]) => m === q.get("cards")) ? q.get("cards") : "main";
  for (const part of (q.get("picks") ?? "").split(",").filter(Boolean)) {
    const [team, account, slot] = part.split(":");
    if (byId.get(team)?.players.some((p) => p.account === account)) picks.set(`${team}:${account}`, /^\d+$/.test(slot ?? "") ? Number(slot) : null);
  }
  const fromTeams = (q.get("teams") ?? "").split(",").flatMap((id) => (byId.get(id)?.players ?? []).map((p) => `${id}:${p.account}`)).filter((k) => !picks.has(k));
  const save = () => {
    const url = new URL(location.href);
    url.searchParams.delete("teams");
    if (picks.size) url.searchParams.set("picks", [...picks].map(([k, s]) => (s == null ? k : `${k}:${s}`)).join(",")); else url.searchParams.delete("picks");
    if (mode !== "main") url.searchParams.set("cards", mode); else url.searchParams.delete("cards");
    history.replaceState(history.state, "", url);
  };
  // A new pick takes the filter's card once that player's cards arrive.
  const addPick = (k) => {
    picks.set(k, null);
    if (mode === "main") return;
    playerDesigns(k.split(":")[1]).then(({ designs }) => { if (picks.has(k)) { picks.set(k, pickSlot(mode, designs)); refreshRow(k); save(); } });
  };
  fromTeams.forEach(addPick);

  const teamRow = (t) => `<div class="sk-team-pick" data-team="${esc(t.id)}" data-search="${esc([t.name, ...t.players.map((p) => p.name)].join(" ").toLowerCase())}">
      <label class="sk-team-box"><input type="checkbox" data-team-box> <span>${esc(t.name)}</span></label>
      <details><summary><span data-count></span></summary><div class="sk-players">${t.players.map((p) => `<label><input type="checkbox" data-player="${esc(p.account)}"> ${esc(p.name)}</label>`).join("")}</div></details>
    </div>`;
  let lastGroup;
  const groups = teams.map((t) => { const head = t.group && t.group !== lastGroup ? `<h4 class="sk-group">${esc(t.group)}</h4>` : ""; lastGroup = t.group; return head + teamRow(t); }).join("");

  app.innerHTML = `${pageHead(src.kicker, "Stream kit")}
    <div class="stream-kit reveal" style="--i:2">
      <p class="muted">Player cards for your stream: animated, on a transparent background, loaded live from the site. Pick teams or single players, choose their cards, then import the OBS scenes or copy card links.</p>
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
  const rowUrl = (k) => { const [team, account] = k.split(":"); return streamCardUrl(byId.get(team).rootUrl, account, picks.get(k)); };
  // A row's link and card name, after its pick changes.
  function refreshRow(k) {
    const row = out.querySelector(`.sk-row[data-key="${CSS.escape(k)}"]`); if (!row) return;
    const url = rowUrl(k);
    row.querySelector("code").textContent = url; row.querySelector("a").href = url;
    playerDesigns(k.split(":")[1]).then(({ designs }) => {
      const label = row.querySelector(".sk-choice");
      label.textContent = designs.length ? choiceName(designs, picks.get(k)) : "Default card";
      row.querySelector(".sk-view").disabled = !designs.length;
      row.querySelector(".sk-view").title = designs.length ? "" : "No saved cards: shows the site's default card";
    });
  }

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
        <header class="sk-cards-head"><h3>Cards</h3><label>Card for everyone <select data-mode>${CARD_MODES.map(([m, label]) => `<option value="${m}" ${m === mode ? "selected" : ""}>${label}</option>`).join("")}</select></label></header>
        <p class="muted">Highest rated uses the community's card ratings; a player with none, or one card, shows their main card. Change one player's card with <b>View cards</b>. One at a time in OBS: add a <b>Browser Source</b> with the link, width ${CARD_W}, height ${CARD_H}; right-click it and choose <b>Refresh</b> to pick up card changes.</p>
        ${list.map(({ team, players }) => `<div class="sk-team"><h4>${esc(team.name)}</h4>${players.map((p) => {
          const k = `${team.id}:${p.account}`, url = rowUrl(k);
          return `<div class="sk-row" data-key="${esc(k)}"><span class="sk-name">${esc(p.name)}</span>
            <button type="button" class="sk-view">View cards</button><span class="sk-choice">…</span>
            <code>${esc(url)}</code><button type="button" class="sk-copy">Copy</button><a href="${esc(url)}" target="_blank" rel="noopener">Open</a></div>`;
        }).join("")}</div>`).join("")}
      </section>`;
    out.querySelectorAll(".sk-row").forEach((row) => refreshRow(row.dataset.key));
  };

  // View cards: the player's saved designs drawn as cards; click one to use it.
  async function viewCards(k) {
    const [teamId, account] = k.split(":"), team = byId.get(teamId), player = team.players.find((p) => p.account === account);
    const dlg = document.createElement("dialog");
    dlg.className = "sk-dlg";
    dlg.innerHTML = `<header><h3>${esc(player.name)}'s cards</h3><button type="button" class="sk-dlg-close" aria-label="Close">×</button></header><div class="sk-dlg-body"><p class="muted">Loading cards…</p></div>`;
    document.body.append(dlg);
    dlg.addEventListener("close", () => dlg.remove());
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest(".sk-dlg-close")) dlg.close(); });
    dlg.showModal();
    const [{ data, designs }, { matches, tiers }] = await Promise.all([playerDesigns(account), getRenderer()]);
    if (!dlg.open) return;
    const body = dlg.querySelector(".sk-dlg-body");
    if (!designs.length) { body.innerHTML = `<p class="muted">${esc(player.name)} hasn't saved a card yet; the stream shows the site's default card.</p>`; return; }
    const cards = new Map([[Number(account), { cosmetics: { ...(data?.equipment ?? {}), nickname: data?.nickname ?? null } }]]);
    const draw = createPlayerCards(matches, { cards, tiers });
    const who = { account: Number(account), name: player.name, team: team.name };
    const current = picks.get(k);
    body.innerHTML = PAINT_FILTER + `<div class="sk-dlg-grid">${designs.map((d) => {
      const on = d.primary ? current == null || current === d.slot : current === d.slot;
      const facts = [d.primary && "Main", d.pick && `Rated ${RATING_NAME[d.pick]} (${d.total})`, d.savedAt && `Saved ${new Date(d.savedAt).toLocaleDateString()}`].filter(Boolean).join(" · ");
      return `<div class="sk-pick${on ? " on" : ""}" role="button" tabindex="0" aria-pressed="${on}" data-slot="${d.primary ? "" : d.slot}">
        <div class="sk-pick-card">${draw.card(who, null, { own: true, equipmentOverride: d.design })}</div>
        <strong>${esc(d.name)}</strong><span class="muted">${esc(facts || "No ratings yet")}</span></div>`;
    }).join("")}</div>`;
    body.querySelectorAll(".ft-turn, .ft-expand, .ft-pickbtn").forEach((b) => b.remove());
    fitDesignCards(body);
    const choose = (el) => {
      picks.set(k, el.dataset.slot === "" ? null : Number(el.dataset.slot));
      refreshRow(k); save(); dlg.close();
    };
    body.addEventListener("click", (e) => { const el = e.target.closest(".sk-pick"); if (el) choose(el); });
    body.addEventListener("keydown", (e) => { const el = e.target.closest(".sk-pick"); if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(el); } });
  }

  grid.addEventListener("change", (e) => {
    const row = e.target.closest(".sk-team-pick"); if (!row) return;
    const t = byId.get(row.dataset.team);
    if (e.target.matches("[data-team-box]")) for (const p of t.players) { const k = `${t.id}:${p.account}`; if (e.target.checked) { if (!picks.has(k)) addPick(k); } else picks.delete(k); }
    else if (e.target.matches("[data-player]")) { const k = `${t.id}:${e.target.dataset.player}`; if (e.target.checked) { if (!picks.has(k)) addPick(k); } else picks.delete(k); }
    draw();
  });
  app.querySelector(".sk-filter").addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    grid.querySelectorAll(".sk-team-pick").forEach((r) => { r.hidden = !!term && !r.dataset.search.includes(term); });
    grid.querySelectorAll(".sk-group").forEach((h) => { let n = h.nextElementSibling, any = false; while (n && !n.matches(".sk-group")) { any ||= !n.hidden; n = n.nextElementSibling; } h.hidden = !any; });
  });
  app.querySelector("[data-none]").onclick = () => { picks.clear(); draw(); };

  out.addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-mode]"); if (!sel) return;
    mode = sel.value; save();
    sel.disabled = true;
    await Promise.all([...picks.keys()].map(async (k) => { const { designs } = await playerDesigns(k.split(":")[1]); if (picks.has(k)) { picks.set(k, pickSlot(mode, designs)); refreshRow(k); } }));
    sel.disabled = false; save();
  });
  const flash = (btn, text) => { const was = btn.textContent; btn.textContent = text; setTimeout(() => { btn.textContent = was; }, 1500); };
  const copy = (text, btn) => navigator.clipboard.writeText(text).then(() => flash(btn, "Copied"), () => flash(btn, "Copy failed"));
  out.addEventListener("click", async (e) => {
    const v = e.target.closest(".sk-view");
    if (v) return viewCards(v.closest(".sk-row").dataset.key);
    const c = e.target.closest(".sk-copy");
    if (c) return copy(rowUrl(c.closest(".sk-row").dataset.key), c);
    const s = e.target.closest("[data-share]");
    if (s) return copy(location.href, s);
    if (!e.target.closest("[data-download]")) return;
    const list = picked();
    // Card names for the OBS sources, where a player shows one of their saved designs.
    const named = await Promise.all(list.map(async ({ team, players }) => ({ name: team.name, rootUrl: team.rootUrl,
      players: await Promise.all(players.map(async (p) => ({ name: p.name, account: p.account, slot: p.slot,
        card: p.slot == null ? null : choiceName((await playerDesigns(p.account)).designs, p.slot) }))) })));
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
