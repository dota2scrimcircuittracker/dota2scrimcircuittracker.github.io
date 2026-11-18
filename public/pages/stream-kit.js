// Stream kit (#/<league>/stream-kit, every league): pick any teams or single players, choose which of
// each player's saved cards to show, and get their OBS card links (parts/stream-card.js, ?stream=card)
// plus an OBS scene collection to import (lib/stream-kit.js). Scrims use the Champion rosters (scrim
// teams are the Champion teams) with scrim-stat cards; All divisions links each team to its own league.
// "Card for everyone" sets every pick to their main, highest rated or most recent card (and new picks
// follow it); "View cards" shows one player's designs to pick from.
// The picks ride in the address (?picks=<team>:<account>[:<slot>],…&cards=<mode>) so a set can be
// shared as a link; the older ?teams=<id>,… still opens with those teams' whole rosters.
// Stand-ins: "Add a stand-in" on a team finds anyone the site knows (every league, scrims, Steam
// sign-ins) by name, or takes an account ID. They join that team's list and ride in ?subs=.
import { app, pageHead, esc, SOURCES } from "../core.js";
import { obsCollection, streamCardUrl, vsSceneUrl, pickSlot, parseSubs, subsParam, CARD_MODES, CARD_W, CARD_H, VS_W, VS_H, VS_ANIMS,
  VS_FRAMES, VS_ENTRANCES, VS_STYLES, VS_AFTER, parseScene, sceneString, presetOf, sceneFromQuery, sceneQuery } from "../lib/stream-kit.js";
import { searchIndex } from "../lib/search.js";
import { loadSearch } from "../parts/searchindex.js";
import { strangerNames } from "../lib/scout.js";
import { publicCollection, cardRatings } from "../lib/cosmetics.js";
import { cardDesignState, cardSlotName } from "../lib/cosmetics-engine.js";
import { createPlayerCards, PAINT_FILTER, fitDesignCards } from "../parts/player-card.js";
import { divisionTiers } from "../parts/tiers.js";
import { VS_SOUNDS, SOUND_GROUPS, VS_MUSIC, FILE_AT, soundOf, musicOf, fileName, fileUrl, fileListUrl, playSample, playMusicSample } from "../parts/vs-sound.js";
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
// A failed lookup comes back { failed: true } and isn't kept, so the next look tries again.
const cardsOf = new Map();
function playerDesigns(account) {
  if (!cardsOf.has(account)) cardsOf.set(account, Promise.all([publicCollection(account), cardRatings(account).catch(() => [])]).then(([data, ratings]) => {
    const prefs = cardDesignState(data);
    const designs = prefs.cardOrder.filter((i) => prefs.cardDesigns[i]).map((i) => ({
      slot: i, name: cardSlotName(prefs, i), primary: i === prefs.primaryCard, design: prefs.cardDesigns[i],
      pick: ratings?.[i]?.pick ?? null, total: ratings?.[i]?.total ?? 0, savedAt: data.cardSavedAt?.[i] ?? 0,
    }));
    return { data, designs };
  }).catch(() => { cardsOf.delete(account); return { data: null, designs: [], failed: true }; }));
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
  let swap = q.get("sides") === "swap"; // the VS scene's second team on the left
  let scene = sceneFromQuery(q); // the VS scene: "<frame>.<entrance>.<vs>.<after>" (lib/stream-kit.js)
  let own = presetOf(scene) ? null : scene; // the last scene built from the layers (not a ready-made one)
  // The VS scene's intro sound (parts/vs-sound.js), &sound=<id> on its links; null for none. Silent unless one is picked.
  let sound = soundOf(q.get("sound"));
  let music = musicOf(q.get("music")); // a track on a loop after the intro (&music=<id>), or null
  // Replaying the intro: seconds after it ends before it plays again (&loop=<s>), 0 for once. Music carries on.
  const REPLAYS = [[0, "Once, when the scene comes on"], [15, "Again 15 s after it ends"], [30, "Again 30 s after it ends"], [60, "Again 1 min after it ends"], [120, "Again 2 min after it ends"], [300, "Again 5 min after it ends"]];
  let replay = REPLAYS.some(([s]) => s === Number(q.get("loop"))) ? Number(q.get("loop")) : 0;
  const replayName = () => (replay ? REPLAYS.find(([s]) => s === replay)[1].replace("Again", "Replays") : "Plays once");
  const soundName = () => (sound ? VS_SOUNDS.find(([id]) => id === sound)[1] : "No sound");
  const musicName = () => (music ? VS_MUSIC.find(([id]) => id === music)[1] : "No music");
  // A Dota sound (public/audio/dota/): &file=<name>&fileat=<when>&filesync=<seconds>. None unless one is picked.
  const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname); // the timing tools are on this computer only
  let file = fileName(q.get("file"));
  let fileAt = FILE_AT.some(([k]) => k === q.get("fileat")) ? q.get("fileat") : "intro";
  let fileSync = Math.max(0, Number(q.get("filesync")) || 0);
  // The Dota sounds (public/audio/dota/list.json) and each one's timing: the list's, or on this computer the sync page's.
  let fileList = null;
  const fileLabel = () => fileList?.find((f) => f.file === file)?.name ?? file;
  const timings = () => { try { return JSON.parse(localStorage.getItem("dsl-sound-sync")) ?? {}; } catch { return {}; } };
  const timingOf = (f) => timings()[f.file] ?? f.moment;
  const soundLabel = () => [sound || !(music || file) ? soundName() : null, file ? fileLabel() : null, music ? musicName() : null].filter(Boolean).join(" + ");
  const soundSummary = () => `${sound ? `Sound: ${soundName()}` : file ? `Sound: ${fileLabel()}` : "No sound"}${sound && file ? `, plus ${fileLabel()}` : ""}${music ? `, then ${musicName()} on a loop` : ""}.`;
  // Stand-ins join the end of their team's list, marked standin; one already on that roster is skipped.
  const addSub = (team, account, name) => {
    const t = byId.get(team);
    if (!t || t.players.some((p) => p.account === account)) return false;
    t.players.push({ name, account, standin: true });
    return true;
  };
  for (const [team, account, name] of parseSubs(q.get("subs"))) addSub(team, account, name);
  const subsOf = (ts) => ts.flatMap((t) => t.players.filter((p) => p.standin).map((p) => [t.id, p.account, p.name]));
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
    if (swap) url.searchParams.set("sides", "swap"); else url.searchParams.delete("sides");
    if (sound) url.searchParams.set("sound", sound); else url.searchParams.delete("sound");
    if (music) url.searchParams.set("music", music); else url.searchParams.delete("music");
    if (replay) url.searchParams.set("loop", String(replay)); else url.searchParams.delete("loop");
    for (const k of ["file", "fileat", "filesync"]) url.searchParams.delete(k);
    if (file) { url.searchParams.set("file", file); url.searchParams.set("fileat", fileAt); if (fileAt === "vs" && fileSync) url.searchParams.set("filesync", String(fileSync)); }
    url.searchParams.delete("anim"); url.searchParams.delete("scene");
    const sq = sceneQuery(scene);
    if (sq) { const [key, value] = sq.slice(1).split("="); url.searchParams.set(key, value); }
    const subs = subsOf(teams);
    if (subs.length) url.searchParams.set("subs", subsParam(subs)); else url.searchParams.delete("subs");
    history.replaceState(history.state, "", url);
  };
  // A new pick takes the filter's card once that player's cards arrive.
  const addPick = (k) => {
    picks.set(k, null);
    if (mode === "main") return;
    playerDesigns(k.split(":")[1]).then(({ designs }) => { if (picks.has(k)) { picks.set(k, pickSlot(mode, designs)); refreshRow(k); save(); } });
  };
  // The VS scene: this page with ?stream=vs draws only the first two teams' cards, animated (parts/stream-vs.js).
  if (q.get("stream") === "vs") {
    const keys = [...picks.keys(), ...fromTeams], ids = [...new Set(keys.map((k) => k.split(":")[0]))].slice(0, 2);
    const sides = ids.map((id) => { const t = byId.get(id); return { team: t, players: keys.filter((k) => k.startsWith(`${id}:`)).map((k) => t.players.find((p) => p.account === k.split(":")[1])) }; });
    return (await import("../parts/stream-vs.js")).mountVsScene(sides, { picks, mode, playerDesigns, getRenderer });
  }
  fromTeams.forEach(addPick);

  // An ⓘ that opens a bubble of help text (html). side "right" opens it leftwards from a right-hand ⓘ.
  const info = (html, side = "") => `<details class="sk-info${side ? ` sk-info-${side}` : ""}"><summary aria-label="More info">i</summary><div class="sk-info-pop">${html}</div></details>`;
  const searchText = (t) => [t.name, ...t.players.map((p) => p.name)].join(" ").toLowerCase();
  const playerList = (t) => t.players.map((p) => `<label${p.standin ? ` class="sk-sub"` : ""}><input type="checkbox" data-player="${esc(p.account)}"> ${esc(p.name)}${p.standin ? ` <span class="sk-sub-tag">Stand-in</span>` : ""} <span class="sk-pcount" data-cards-of="${esc(p.account)}"></span>${p.standin ? `<button type="button" class="sk-sub-x" data-unsub="${esc(p.account)}" aria-label="Remove ${esc(p.name)}" title="Remove stand-in">×</button>` : ""}</label>`).join("");
  const teamRow = (t) => `<div class="sk-team-pick" data-team="${esc(t.id)}" data-search="${esc(searchText(t))}">
      <label class="sk-team-box"><input type="checkbox" data-team-box> <span>${esc(t.name)}</span></label>
      <details><summary><span data-count></span></summary><div class="sk-players">${playerList(t)}</div>
        <div class="sk-sub-add"><input type="search" class="sk-sub-find" placeholder="Add a stand-in: name or account ID" aria-label="Add a stand-in to ${esc(t.name)}" autocomplete="off"><div class="sk-sub-hits" hidden></div></div></details>
    </div>`;
  let lastGroup;
  const groups = teams.map((t) => { const head = t.group && t.group !== lastGroup ? `<h4 class="sk-group">${esc(t.group)}</h4>` : ""; lastGroup = t.group; return head + teamRow(t); }).join("");

  app.innerHTML = `${pageHead(src.kicker, "Stream kit")}
    <div class="stream-kit reveal" style="--i:2">
      <div class="muted sk-intro">Animated player cards and a VS intro for OBS. Pick teams, choose cards and a VS scene, download. ${info("The cards sit on a transparent background and load live from the site, so a player's card edits show on stream. Pick whole teams or single players.")}</div>
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
      const subs = t.players.filter((p) => p.standin).length, tail = subs ? ` (${subs} stand-in${subs > 1 ? "s" : ""})` : "";
      row.querySelector("[data-count]").textContent = (n ? `${n} of ${t.players.length} players` : `${t.players.length} players`) + tail;
      if (n && n < t.players.length) row.querySelector("details").open = true;
    }
  };
  // The picks grouped by team, in the list's order: [{ team, players: [{ ...player, slot }] }].
  const picked = () => teams.map((t) => ({ team: t, players: t.players.filter((p) => picks.has(`${t.id}:${p.account}`)).map((p) => ({ ...p, slot: picks.get(`${t.id}:${p.account}`) })) })).filter((g) => g.players.length);
  // The VS scene's link: the first two picked teams, with their card picks.
  const vsTeams = (list) => (swap ? [list[1], list[0]] : list.slice(0, 2));
  // The scene builder: a picker per layer, each with a line on what the chosen one does.
  let tab = "cards"; // the open tab under the team picker: cards, vs or obs
  const LAYER_UI = [["frame", "Frame", VS_FRAMES], ["enter", "Entrance", VS_ENTRANCES], ["vs", "VS", VS_STYLES], ["after", "Afterwards", VS_AFTER]];
  const layerInfo = (k, id) => LAYER_UI.find(([x]) => x === k)[2].find(([x]) => x === id);
  const sceneName = (s) => VS_ANIMS.find(([id]) => id === presetOf(s))?.[1] ?? "Your own scene";
  const builder = () => {
    const sc = parseScene(scene);
    return `<div class="sk-build">${LAYER_UI.map(([k, label, list]) => `<div class="sk-build-pick"><span class="sk-title"><span>${label}</span>${info(`<span data-about-of="${k}">${esc(layerInfo(k, sc[k])[2])}</span>`)}</span>
        <button type="button" class="sk-layer-btn" data-layer-pick="${k}" aria-label="Choose the ${label.toLowerCase()} (${list.length} to watch)"><span data-layer-name="${k}">${esc(layerInfo(k, sc[k])[1])}</span><small>${list.length} ▾</small></button></div>`).join("")}</div>`;
  };
  // "Your own scene" sits with the ready-made ones: the last scene built from the layers, kept while a
  // ready-made one is tried, so it can be ticked again. Until one's been built there's nothing to tick.
  const ownHint = () => (own ? `Your own: ${describe(own)}` : "Change any layer to build your own scene");
  const ownTile = () => `<div class="sk-anim sk-anim-own${presetOf(scene) ? "" : " on"}${own ? "" : " empty"}" title="${esc(ownHint())}" data-own>
      <label class="sk-anim-check"><input type="checkbox" data-use-own${presetOf(scene) ? "" : " checked"}${own ? "" : " disabled"}><strong>Your own scene</strong></label>
      <button type="button" class="sk-anim-use" data-watch-own aria-label="Watch your own scene" title="Watch your own scene"${own ? "" : " disabled"}>▶</button></div>`;
  // The banner naming the selected scene and its four layers; it's what goes in the link and the download.
  const current = () => {
    const sc = parseScene(scene), preset = presetOf(scene);
    return `<div class="sk-current-text"><small>Selected scene · ${preset ? "ready-made" : "built from layers"}</small><strong>${esc(sceneName(scene))}</strong>
      <span class="sk-current-layers">${LAYER_UI.map(([k, label]) => `<span><i>${label}</i> ${esc(layerInfo(k, sc[k])[1])}</span>`).join("")}</span></div>
      <div class="sk-current-act">${picked().length ? `<button type="button" class="sk-sound-chip" data-tab-go="sound" title="Change the intro sound">${sound ? "🔊" : "🔇"} <span data-sound-name>${esc(soundLabel())}</span></button>` : ""}
      <button type="button" class="sk-anim-pick" data-watch-scene>▶ Watch it</button></div>`;
  };
  const describe = (s) => { const sc = parseScene(s); return `${layerInfo("frame", sc.frame)[1]} · ${layerInfo("enter", sc.enter)[1]} entrance · ${layerInfo("vs", sc.vs)[1]} VS · then ${layerInfo("after", sc.after)[1].toLowerCase()}`; };
  // The animation previews need two teams: short of two picked, the first teams in the list with a
  // full roster fill in as examples (five rostered players each, main cards).
  const previewTeams = (list) => {
    if (list.length > 1) return list;
    const have = new Set(list.map((g) => g.team.id)), roster = (t) => t.players.filter((p) => !p.standin);
    const fill = [...teams.filter((t) => roster(t).length >= 5), ...teams].filter((t, i, all) => !have.has(t.id) && all.indexOf(t) === i)
      .slice(0, 2 - list.length).map((t) => ({ team: t, players: roster(t).slice(0, 5).map((p) => ({ ...p, slot: null })) }));
    return [...list, ...fill];
  };
  const vsLink = (list, extra = "", a = scene) => { const two = vsTeams(list);
    return vsSceneUrl(absolute(src.root), two.flatMap(({ team, players }) => players.map((p) => [`${team.id}:${p.account}`, p.slot])), mode, a,
      two.flatMap(({ team, players }) => players.filter((p) => p.standin).map((p) => [team.id, p.account, p.name]))) + (sound ? `&sound=${sound}` : "") + (music ? `&music=${music}` : "")
      + (file ? `&file=${encodeURIComponent(file)}&fileat=${fileAt}${fileAt === "vs" && fileSync ? `&filesync=${fileSync}` : ""}` : "")
      + (replay && !extra.includes("loop=") ? `&loop=${replay}` : "") + extra; };
  // The OBS scene collection's name and file name: the team's name for one team, else the division.
  const collectionName = (list) => { const one = list.length === 1 ? list[0].team.name : null;
    return { name: one ? `DSL - ${one}` : `DSL Stream Kit - ${src.division ?? "Scrims"}`, file: `dsl-stream-kit-${slug(one ?? src.division ?? "scrims")}.json` }; };
  const rowUrl = (k) => { const [team, account] = k.split(":"); return streamCardUrl(byId.get(team).rootUrl, account, picks.get(k)); };
  // A row's link and card name, after its pick changes.
  function refreshRow(k) {
    const row = out.querySelector(`.sk-row[data-key="${CSS.escape(k)}"]`); if (!row) return;
    const url = rowUrl(k);
    row.querySelector("code").textContent = url; row.querySelector("a").href = url;
    playerDesigns(k.split(":")[1]).then(({ designs, failed }) => {
      if (!row.isConnected) return;
      const label = row.querySelector(".sk-choice"), view = row.querySelector(".sk-view");
      label.textContent = failed ? "Couldn't load cards" : designs.length ? choiceName(designs, picks.get(k)) : "Default card";
      out.querySelectorAll(`[data-dl-card="${CSS.escape(k)}"]`).forEach((el) => { el.textContent = !failed && !designs.length ? "the site's default card (no saved cards)" : label.textContent; });
      view.textContent = designs.length > 1 ? `View ${designs.length} cards` : "View card";
      view.classList.toggle("many", designs.length > 1);
      view.title = failed ? "Their cards didn't load: open to try again" : designs.length ? "" : "No saved cards: the stream shows the site's default card";
      countChoices();
    });
  }
  // The Cards header: how many picked players have more than one card to choose from.
  function countChoices() {
    const el = out.querySelector(".sk-choices"); if (!el) return;
    const rows = [...out.querySelectorAll(".sk-row")], many = rows.filter((r) => r.querySelector(".sk-view.many")).length;
    el.textContent = `${many} of ${rows.length} player${rows.length > 1 ? "s" : ""} ${many === 1 ? "has" : "have"} more than one card to choose from.`;
  }

  const draw = () => {
    syncBoxes(); save();
    const list = picked(), shown = previewTeams(list), real = list.length > 1;
    const vsPanel = shown.length < 2 ? "" : `<section class="panel sk-vs" data-pane="vs"${list.length && tab !== "vs" ? " hidden" : ""}>
        <header class="sk-cards-head"><div class="sk-title"><h3>VS scene</h3>${info(`Build your scene from four layers, or start from a ready-made one and change any layer. ${real ? "Watch plays it with your teams."
          : `Until you pick two teams, Watch plays it with ${esc(shown[0].team.name)} and ${esc(shown[1].team.name)} as examples.`}`)}</div>${real ? `<button type="button" data-swap>Swap sides</button>` : ""}</header>
        <div class="sk-current" data-current>${current()}</div>
        <div class="sk-replay"><label>Intro <select data-replay>${REPLAYS.map(([s, l]) => `<option value="${s}"${s === replay ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          ${info(`Plays the cards' intro again while the scene stays on, for a long break between games. Music from the Sound tab keeps going underneath, dipping while the intro replays. Switching scenes in OBS still starts it fresh.`)}</div>
        <h4 class="sk-presets-head">Change a layer</h4>
        ${builder()}
        <h4 class="sk-presets-head">Or pick a scene <span class="muted">yours or ${VS_ANIMS.length} ready-made</span></h4>
        <div class="sk-anim-grid">${ownTile()}${VS_ANIMS.map(([a, label, about, sc]) => `<div class="sk-anim${sc === scene ? " on" : ""}" title="${esc(about)}" data-scene="${sc}">
          <label class="sk-anim-check"><input type="checkbox" data-use-scene="${sc}"${sc === scene ? " checked" : ""}><strong>${esc(label)}</strong></label>
          <button type="button" class="sk-anim-use" data-watch-anim="${a}" aria-label="Watch ${esc(label)}" title="Watch ${esc(label)}">▶</button></div>`).join("")}</div>
        ${real ? `<div class="sk-row sk-vs-link"><span class="sk-name">VS link</span><span class="muted sk-vs-sides">${esc(vsTeams(list)[0].team.name)} left, ${esc(vsTeams(list)[1].team.name)} right${list.length > 2 ? " (first two teams)" : ""}</span><code hidden>${esc(vsLink(list))}</code><button type="button" class="sk-copy" data-vs>Copy</button><a href="${esc(vsLink(list, "&preview=1"))}" target="_blank" rel="noopener">Preview</a></div>`
          : `<p class="muted">Pick two teams above to get the VS scene's OBS link with your choice.</p>`}
      </section>`;
    const soundPanel = !vsPanel ? "" : `<section class="panel sk-sounds" data-pane="sound"${tab !== "sound" ? " hidden" : ""}>
        <header class="sk-cards-head"><div class="sk-title"><h3>Sound</h3>${info(`The VS scene plays this as its intro runs: each card lands on a hit and the VS on a big one, timed to whichever scene you pick. ▶ plays a sample here; <b>Watch with your scene</b> plays it with your teams. In OBS it's its own channel in the audio mixer, so you can turn it down there.`)}</div>
          <button type="button" class="sk-anim-pick" data-watch-scene>▶ Watch with your scene</button></header>
        <h4 class="sk-presets-head">Dota sounds ${info(`Sounds from Dota 2's versus screen and intro screens, each timed so its big moment lands on the VS. ▶ plays it from just before that moment.${LOCAL ? ` Set a track's timing on the <a href="/_dev/sound-sync.html" target="_blank" rel="noopener">sound sync page</a> (this computer only).` : ""}`)}</h4>
        <div class="sk-anim-grid sk-sound-grid" data-dota-grid><p class="muted">Loading…</p></div>
        <details class="sk-other-sounds"${sound ? " open" : ""}><summary>Other sounds <span class="muted">${VS_SOUNDS.length} made ones</span></summary>
        ${[[null, [[null, "No sound", "The VS scene stays silent."]]], ...SOUND_GROUPS.map((g) => [g, VS_SOUNDS.filter((x) => x[3] === g)])].filter(([g]) => g).map(([g, items]) => `${g ? `<h4 class="sk-presets-head">${esc(g)} <span class="muted">${items.length}</span></h4>` : ""}
        <div class="sk-anim-grid sk-sound-grid">${items.map(([id, label, about]) => `<div class="sk-anim${id === sound ? " on" : ""}" title="${esc(about)}" data-sound-tile="${id ?? ""}">
          <label class="sk-anim-check"><input type="checkbox" data-use-sound="${id ?? ""}"${id === sound ? " checked" : ""}><strong>${esc(label)}</strong></label>
          ${id ? `<button type="button" class="sk-anim-use" data-play-sound="${id}" aria-label="Play ${esc(label)}" title="Play ${esc(label)}">▶</button>` : ""}<small class="muted">${esc(about)}</small></div>`).join("")}</div>`).join("")}
        </details>
        <h3 class="sk-music-head">Music after the intro ${info(`Starts just after the VS lands and loops, quietly, until you switch scenes. ▶ plays it here; press ■ to stop.`)}</h3>
        <div class="sk-anim-grid sk-sound-grid">${[[null, "No music", "Silent once the intro's done."], ...VS_MUSIC].map(([id, label, about]) => `<div class="sk-anim${id === music ? " on" : ""}" title="${esc(about)}" data-music-tile="${id ?? ""}">
          <label class="sk-anim-check"><input type="checkbox" data-use-music="${id ?? ""}"${id === music ? " checked" : ""}><strong>${esc(label)}</strong></label>
          ${id ? `<button type="button" class="sk-anim-use" data-play-music="${id}" aria-label="Play ${esc(label)}" title="Play ${esc(label)}">▶</button>` : ""}<small class="muted">${esc(about)}</small></div>`).join("")}</div>
        ${LOCAL ? `<h3 class="sk-music-head">Your own audio file <span class="sk-tag">This computer only</span> ${info(`Any file in <code>public/audio/dota/</code> by name, with its timing set by hand. Files there go on the site when committed.`)}</h3>
        <div class="sk-file">
          <label>File name <input type="text" data-file list="sk-file-list" placeholder="dota-startup-1.mp3" value="${esc(file ?? "")}" spellcheck="false"></label><datalist id="sk-file-list"></datalist>
          <label>Plays <select data-file-at>${FILE_AT.map(([k, l]) => `<option value="${k}"${k === fileAt ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label data-file-sync-row${fileAt === "vs" ? "" : " hidden"}>Big moment <input type="number" data-file-sync min="0" step="0.1" value="${fileSync}"> s into the file</label>
          <span class="muted" data-file-status></span>
          <button type="button" class="sk-anim-pick" data-watch-scene>▶ Watch with your scene</button>
        </div>` : ""}
      </section>`;
    if (!list.length) { out.innerHTML = `<p class="muted sk-empty">Pick one or more teams or players.</p>${vsPanel}`; return; }
    const cards = list.reduce((n, g) => n + g.players.length, 0), plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const { name: collection, file: dlFile } = collectionName(list);
    const vsName = real ? vsTeams(list).map((g) => g.team.name).join(" vs ") : null;
    const total = (real ? 1 : 0) + list.length + cards;
    // Scene names as the file has them: a repeated name gets " (2)", like obsCollection does.
    const seen = new Map(), sceneLabel = (n) => { const k = (seen.get(n) ?? 0) + 1; seen.set(n, k); return k > 1 ? `${n} (${k})` : n; };
    const TABS = [["cards", "Cards", plural(cards, "player")], ...(vsPanel ? [["vs", "VS scene", `<span data-tab-scene>${esc(sceneName(scene))}</span>`], ["sound", "Sound", `<span data-tab-sound>${esc(soundLabel())}</span>`]] : []), ["obs", "Put it in OBS", plural(total, "scene")]];
    if (!TABS.some(([k]) => k === tab)) tab = "cards";
    out.innerHTML = `
      <nav class="sk-tabs" role="tablist">${TABS.map(([k, label, sub]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}"><b>${label}</b><small>${sub}</small></button>`).join("")}
        <button type="button" class="sk-dl-btn" data-download title="${esc(`${plural(total, "scene")}, file ${dlFile}`)}">⬇ Download OBS scenes</button></nav>
      <section class="panel" data-pane="cards"${tab !== "cards" ? " hidden" : ""}>
        <header class="sk-cards-head"><div class="sk-title"><h3>Cards</h3><span class="sk-choices muted"></span></div><span class="sk-title"><label>Card for everyone <select data-mode>${CARD_MODES.map(([m, label]) => `<option value="${m}" ${m === mode ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          ${info(`Highest rated uses the community's card ratings; a player with none, or one card, shows their main card. Change one player's card with <b>View cards</b>. <b>Copy</b> gives that card's OBS link.`, "right")}</span></header>
        ${list.map(({ team, players }) => `<div class="sk-team"><h4>${esc(team.name)}</h4>${players.map((p) => {
          const k = `${team.id}:${p.account}`, url = rowUrl(k);
          return `<div class="sk-row" data-key="${esc(k)}"><span class="sk-name">${esc(p.name)}${p.standin ? ` <span class="sk-sub-tag">Stand-in</span>` : ""}</span>
            <button type="button" class="sk-view">View card</button><span class="sk-choice">…</span>
            <code hidden>${esc(url)}</code><button type="button" class="sk-copy">Copy link</button><a href="${esc(url)}" target="_blank" rel="noopener">Open</a></div>`;
        }).join("")}</div>`).join("")}
      </section>
      ${vsPanel}
      ${soundPanel}
      <section class="panel sk-obs" data-pane="obs"${tab !== "obs" ? " hidden" : ""}>
        <div class="sk-dl">
          <div><b>${plural(total, "scene")}</b>: ${real ? "the VS scene, " : ""}${plural(list.length, "team scene")} and ${plural(cards, "player scene")}, with the cards you picked.
          ${info(`That's everything the kit makes; there's no smaller version. Each scene is a Browser Source pointing at the site, so the cards are the real animated cards, loaded live. Want only some of it? Delete the scenes you don't need after importing, or copy single links from the Cards and VS scene tabs.`)}<br>
          <span class="muted">File <code>${esc(dlFile)}</code>, called <b>${esc(collection)}</b> in OBS.</span></div>
          <button type="button" class="sk-dl-btn" data-download>⬇ Download</button>
        </div>
        <ol class="sk-steps">
          <li>Download the file.</li>
          <li>In OBS: <b>Scene Collection → Import</b>, pick the file, then switch to <b>${esc(collection)}</b> under <b>Scene Collection</b>.</li>
          <li>Changed something here? Download and import again.</li>
        </ol>
        <details class="sk-more"><summary>What's in the file <span class="muted">${plural(total, "scene")}</span></summary>
        <ul class="sk-contents">
          ${real ? `<li><b>Scene - ${esc(vsName)}</b> <span class="sk-tag">VS scene</span>
            <span class="muted"><span data-dl-scene>${esc(sceneName(scene))}: ${esc(describe(scene))}.</span> <span data-dl-replay>${esc(replayName())}.</span> <span data-dl-sound>${esc(soundSummary())}</span> ${esc(vsTeams(list)[0].team.name)} on the left.</span></li>`
            : `<li class="muted">No VS scene: it needs two teams. Pick a second team to add one.</li>`}
          ${list.map(({ team, players }) => `<li><b>Team - ${esc(team.name)}</b> <span class="sk-tag">${plural(players.length, "card")} in a row</span>
            <ul>${players.map((p) => `<li><b>${esc(sceneLabel(`Player - ${p.name}`))}</b> <span class="muted">one big card:</span> <span class="sk-dl-card" data-dl-card="${esc(`${team.id}:${p.account}`)}">…</span></li>`).join("")}</ul></li>`).join("")}
        </ul></details>
        <details class="sk-more"><summary>Or add one link at a time</summary>
        <ul class="sk-steps">
          <li><b>VS scene:</b> add a <b>Browser Source</b> with its link, width ${VS_W}, height ${VS_H}, and tick <b>Refresh browser when scene becomes active</b> so the intro plays each time you switch to it. For the intro sound, also tick <b>Control audio via OBS</b>.</li>
          <li><b>A card:</b> add a <b>Browser Source</b> with the link, width ${CARD_W}, height ${CARD_H}. Right-click it and choose <b>Refresh</b> to pick up card changes.</li>
        </ul></details>
        <p class="muted">Share this set: <button type="button" class="sk-link" data-share>copy this page's link</button></p>
      </section>`;
    out.querySelectorAll(".sk-row").forEach((row) => refreshRow(row.dataset.key));
    listFiles();
  };
  // Watching a scene: a pop-up plays it with the picked teams (only one copy of the scene runs),
  // starting over a few seconds after its intro. For the ready-made scenes ‹ › step through the others;
  // "Use this" makes it the scene.
  function watchScenes(items, i) {
    const list = previewTeams(picked()); if (list.length < 2) return;
    const dlg = document.createElement("dialog");
    dlg.className = "sk-dlg sk-anim-dlg";
    const steps = items.length > 1;
    dlg.innerHTML = `<header><div><h3 data-name></h3><p class="muted" data-about></p></div><button type="button" class="sk-dlg-close" aria-label="Close">×</button></header>
      <div class="sk-anim-frame"><iframe title="VS scene example"></iframe></div>
      <footer>${steps ? `<button type="button" data-step="-1" aria-label="Previous scene">‹ Prev</button><span data-count class="muted"></span><button type="button" data-step="1" aria-label="Next scene">Next ›</button>` : ""}
        <span class="sk-anim-spacer"></span><button type="button" data-again>Replay</button><button type="button" class="sk-anim-pick" data-use></button></footer>`;
    document.body.append(dlg);
    const frame = dlg.querySelector("iframe");
    const show = () => {
      const [, label, about, sc] = items[i];
      dlg.querySelector("[data-name]").textContent = label;
      dlg.querySelector("[data-about]").textContent = steps ? `${about} (${describe(sc)})` : about;
      if (steps) dlg.querySelector("[data-count]").textContent = `${i + 1} of ${items.length}`;
      const use = dlg.querySelector("[data-use]");
      use.textContent = sc === scene ? "Selected ✓" : "Use this";
      use.disabled = sc === scene;
      frame.src = vsLink(list, "&preview=1&loop=4", sc);
    };
    const step = (n) => { i = (i + n + items.length) % items.length; show(); };
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest(".sk-dlg-close")) return dlg.close();
      const st = e.target.closest("[data-step]");
      if (st) return step(Number(st.dataset.step));
      if (e.target.closest("[data-again]")) { frame.src = frame.src; return; }
      if (e.target.closest("[data-use]")) { chooseScene(items[i][3]); show(); }
    });
    dlg.addEventListener("keydown", (e) => { if (steps && (e.key === "ArrowLeft" || e.key === "ArrowRight")) step(e.key === "ArrowLeft" ? -1 : 1); });
    dlg.addEventListener("close", () => { frame.src = "about:blank"; dlg.remove(); });
    dlg.showModal();
    show();
  }
  const watchAnim = (id) => watchScenes(VS_ANIMS, Math.max(0, VS_ANIMS.findIndex(([x]) => x === id)));
  // Picking one layer by watching: a pop-up lists that layer's options beside one live preview. "On its
  // own" plays each option with plain other layers (no frame, Jump in, Gold slam, hold still) so only it
  // shows; "In your scene" swaps it into the selected scene. Use this sets it.
  function pickLayer(k) {
    const list = previewTeams(picked()); if (list.length < 2) return;
    const [, label, opts] = LAYER_UI.find(([x]) => x === k);
    let alone = true, at = Math.max(0, opts.findIndex(([id]) => id === parseScene(scene)[k]));
    const dlg = document.createElement("dialog");
    dlg.className = "sk-dlg sk-anim-dlg sk-layer-dlg";
    dlg.innerHTML = `<header><div><h3>Choose the ${esc(label.toLowerCase())}</h3><p class="muted">Click one to watch it. ↑ ↓ step through.</p></div><button type="button" class="sk-dlg-close" aria-label="Close">×</button></header>
      <div class="sk-layer-body">
        <div class="sk-layer-list" role="listbox" aria-label="${esc(label)}">${opts.map(([id, l, about], i) => `<button type="button" role="option" data-opt="${i}"><b>${esc(l)}</b><small>${esc(about)}</small></button>`).join("")}</div>
        <div class="sk-layer-view"><div class="sk-anim-frame"><iframe title="${esc(label)} preview"></iframe></div>
          <div class="sk-layer-mode" role="group" aria-label="Preview with"><button type="button" data-alone="1">On its own</button><button type="button" data-alone="0">In your scene</button></div>
          <p class="muted" data-desc></p></div>
      </div>
      <footer><span class="sk-anim-spacer"></span><button type="button" data-again>Replay</button><button type="button" class="sk-anim-pick" data-use></button></footer>`;
    document.body.append(dlg);
    const frame = dlg.querySelector("iframe");
    const sceneFor = (id) => { const sc = alone ? parseScene(null) : parseScene(scene); sc[k] = id; return sceneString(sc); };
    const show = () => {
      const [id, l] = opts[at], sc = sceneFor(id), mine = parseScene(scene)[k] === id;
      dlg.querySelectorAll("[data-opt]").forEach((b, i) => { b.setAttribute("aria-selected", String(i === at)); b.classList.toggle("now", opts[i][0] === parseScene(scene)[k]); });
      dlg.querySelector(`[data-opt="${at}"]`).scrollIntoView({ block: "nearest" });
      dlg.querySelectorAll("[data-alone]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.alone === "1") === alone)));
      dlg.querySelector("[data-desc]").textContent = `Playing: ${describe(sc)}.`;
      const use = dlg.querySelector("[data-use]");
      use.textContent = mine ? "In your scene ✓" : `Use ${l}`;
      use.disabled = mine;
      frame.src = vsLink(list, "&preview=1&loop=4", sc);
    };
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest(".sk-dlg-close")) return dlg.close();
      const o = e.target.closest("[data-opt]");
      if (o) { at = Number(o.dataset.opt); return show(); }
      const a = e.target.closest("[data-alone]");
      if (a) { alone = a.dataset.alone === "1"; return show(); }
      if (e.target.closest("[data-again]")) { frame.src = frame.src; return; }
      if (e.target.closest("[data-use]")) { const sc = parseScene(scene); sc[k] = opts[at][0]; chooseScene(sceneString(sc)); dlg.close(); }
    });
    dlg.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault(); at = (at + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; show();
      dlg.querySelector(`[data-opt="${at}"]`).focus();
    });
    dlg.addEventListener("close", () => { frame.src = "about:blank"; dlg.remove(); });
    dlg.showModal();
    show();
  }
  const watchOwn = () => watchScenes([[null, sceneName(scene), describe(scene), scene]], 0);
  // Choosing a scene (a ready-made one, or a layer changed in the builder) changes the link and the download.
  function chooseScene(s) {
    scene = sceneString(parseScene(s)); save();
    if (!presetOf(scene)) own = scene;
    out.querySelectorAll(".sk-anim[data-scene]").forEach((t) => {
      const on = t.dataset.scene === scene;
      t.classList.toggle("on", on);
      t.querySelector("[data-use-scene]").checked = on;
    });
    const ownEl = out.querySelector("[data-own]");
    if (ownEl) ownEl.outerHTML = ownTile();
    const sc = parseScene(scene);
    for (const [k] of LAYER_UI) {
      const name = out.querySelector(`[data-layer-name="${k}"]`); if (!name) continue;
      name.textContent = layerInfo(k, sc[k])[1];
      out.querySelector(`[data-about-of="${k}"]`).textContent = layerInfo(k, sc[k])[2];
    }
    const cur = out.querySelector("[data-current]");
    if (cur) cur.innerHTML = current();
    const dl = out.querySelector("[data-dl-scene]");
    if (dl) dl.textContent = `${sceneName(scene)}: ${describe(scene)}.`;
    const tb = out.querySelector("[data-tab-scene]");
    if (tb) tb.textContent = sceneName(scene);
    refreshVsLink();
  }
  // Choosing the intro sound changes the VS link and the download.
  function chooseSound(id, { keepFile = true } = {}) {
    sound = id;
    if (!keepFile) file = null;
    save();
    out.querySelectorAll("[data-dota-tile]").forEach((t) => {
      const on = !sound && t.dataset.dotaTile === file;
      t.classList.toggle("on", on);
      t.querySelector("[data-use-dota]").checked = on;
    });
    out.querySelectorAll("[data-sound-tile]").forEach((t) => {
      const on = (t.dataset.soundTile || null) === sound && !!(t.dataset.soundTile || !file); // No sound: not with a Dota track
      t.classList.toggle("on", on);
      t.querySelector("[data-use-sound]").checked = on;
    });
    soundLabels();
  }
  function chooseMusic(id) {
    music = id; save();
    out.querySelectorAll("[data-music-tile]").forEach((t) => {
      const on = (t.dataset.musicTile || null) === music;
      t.classList.toggle("on", on);
      t.querySelector("[data-use-music]").checked = on;
    });
    soundLabels();
  }
  // public/audio/dota/list.json: [{ file, name, secs, moment }], offered as choices for the
  // file name; picking one fills in its suggested big moment.
  async function listFiles() {
    fileList ??= await fetch(fileListUrl(), { cache: "no-cache" }).then((r) => (r.ok ? r.json() : []), () => []);
    const dl = out.querySelector("#sk-file-list");
    if (dl) dl.innerHTML = fileList.map((f) => `<option value="${esc(f.file)}">${esc(`${f.name} · ${Math.round(f.secs)} s`)}</option>`).join("");
    const grid = out.querySelector("[data-dota-grid]");
    if (!grid) return;
    const t = timings(), none = !sound && !file;
    grid.innerHTML = `<div class="sk-anim${none ? " on" : ""}" title="The VS scene stays silent." data-sound-tile="">
        <label class="sk-anim-check"><input type="checkbox" data-use-sound=""${none ? " checked" : ""}><strong>No sound</strong></label><small class="muted">The VS scene stays silent.</small></div>`
      + (fileList.length ? fileList.map((f) => { const on = !sound && f.file === file, at = timingOf(f);
        return `<div class="sk-anim${on ? " on" : ""}" data-dota-tile="${esc(f.file)}">
        <label class="sk-anim-check"><input type="checkbox" data-use-dota="${esc(f.file)}"${on ? " checked" : ""}><strong>${esc(f.name)}</strong></label>
        <button type="button" class="sk-anim-use" data-play-dota="${esc(f.file)}" aria-label="Play ${esc(f.name)}" title="Play ${esc(f.name)}">▶</button>
        <small class="muted">${LOCAL ? `${f.file in t ? "Timed here ✓" : "List timing"}: ` : `${Math.round(f.secs)} s, `}big moment ${at.toFixed(2)} s in.${LOCAL ? ` <a href="/_dev/sound-sync.html?file=${encodeURIComponent(f.file)}&fileat=vs&filesync=${at}" target="_blank" rel="noopener">Adjust</a>` : ""}</small></div>`; }).join("")
        : `<p class="muted">The Dota sounds didn't load. Refresh to try again.</p>`);
    soundLabels();
  }
  // Picking a Dota track: it becomes the intro sound, its big moment on the VS (in place of a made sound).
  function chooseDota(name) {
    const f = fileList?.find((x) => x.file === name); if (!f) return;
    file = f.file; fileAt = "vs"; fileSync = timingOf(f);
    const box = out.querySelector("[data-file]"); if (box) box.value = file;
    const at = out.querySelector("[data-file-at]"); if (at) at.value = "vs";
    const sy = out.querySelector("[data-file-sync]"); if (sy) sy.value = fileSync;
    const row = out.querySelector("[data-file-sync-row]"); if (row) row.hidden = false;
    chooseSound(null);
  }
  // Says whether the file is in public/audio/dota/.
  async function checkFile(name) {
    const el = out.querySelector("[data-file-status]"); if (!el) return;
    if (!name) { el.textContent = ""; return; }
    if (!fileName(name)) { el.textContent = "Use a file name ending in .mp3, .ogg, .wav or .m4a."; return; }
    const ok = await fetch(fileUrl(name), { method: "HEAD", cache: "no-store" }).then((r) => r.ok, () => false);
    el.textContent = ok ? "Found ✓" : "Not in public/audio/dota/.";
  }
  // The sound's name on the tab, the banner chip and the download summary, and the VS link.
  function soundLabels() {
    out.querySelectorAll("[data-tab-sound], [data-sound-name]").forEach((el) => { el.textContent = soundLabel(); });
    const chip = out.querySelector(".sk-sound-chip");
    if (chip) chip.firstChild.textContent = sound || music || file ? "🔊 " : "🔇 ";
    const dls = out.querySelector("[data-dl-sound]");
    if (dls) dls.textContent = soundSummary();
    refreshVsLink();
  }
  // ▶ on a sound: plays its sample here (about 4 s); another ▶, or ■, stops it.
  let sample = null;
  function playSound(btn) {
    const was = sample;
    if (sample) { sample.run.stop(); clearTimeout(sample.timer); sample.btn.textContent = "▶"; sample = null; }
    if (was?.btn === btn) return;
    const track = btn.dataset.playMusic, dota = fileList?.find((f) => f.file === btn.dataset.playDota);
    let run;
    if (dota) { const a = new Audio(fileUrl(dota.file)); a.currentTime = Math.max(0, timingOf(dota) - 3); a.play().catch(() => {}); run = { stop: () => a.pause() }; }
    else run = track ? playMusicSample(track) : playSample(btn.dataset.playSound);
    if (!run) return;
    btn.textContent = "■";
    // An intro sample is about 4 s; a track plays for 30 s unless stopped.
    sample = { run, btn, timer: setTimeout(() => { run.stop(); btn.textContent = "▶"; sample = null; }, track ? 30000 : dota ? 10000 : 5000) };
  }
  function refreshVsLink() {
    const list = picked(), row = out.querySelector(".sk-vs .sk-row");
    if (!row) return;
    row.querySelector("code").textContent = vsLink(list);
    row.querySelector("a").href = vsLink(list, "&preview=1");
  }

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
    const [{ data, designs, failed }, { matches, tiers }] = await Promise.all([playerDesigns(account), getRenderer()]);
    if (!dlg.open) return;
    const body = dlg.querySelector(".sk-dlg-body");
    if (failed) { body.innerHTML = `<p class="muted">${esc(player.name)}'s cards didn't load. Close this and try again.</p>`; refreshRow(k); return; }
    const cards = new Map(data?.equipment ? [[Number(account), { cosmetics: { ...data.equipment, nickname: data?.nickname ?? null } }]] : []);
    const draw = createPlayerCards(matches, { cards, tiers });
    const who = { account: Number(account), name: player.name, team: team.name };
    const current = picks.get(k);
    // No saved cards: the one card the stream will show, the site's default.
    if (!designs.length) {
      body.innerHTML = PAINT_FILTER + `<p class="muted">${esc(player.name)} hasn't saved a card yet, so the stream shows the site's default card.</p><div class="sk-dlg-grid"><div class="sk-pick on" role="button" tabindex="0" aria-pressed="true" data-slot="">
        <div class="sk-pick-card">${draw.card(who, null, { own: true })}</div><strong>Default card</strong><span class="muted">The site's card for every player</span></div></div>`;
      body.querySelectorAll(".ft-turn, .ft-expand, .ft-pickbtn").forEach((b) => b.remove());
      fitDesignCards(body);
      body.addEventListener("click", (e) => { if (e.target.closest(".sk-pick")) dlg.close(); });
      return;
    }
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
  // Stand-in search: anyone the site knows by name (best match first, one row per account), or an
  // account ID typed in full (named from Steam or OpenDota). Picking one adds and ticks them.
  let index = null;
  const subHits = async (box) => {
    const row = box.closest(".sk-team-pick"), t = byId.get(row.dataset.team), list = row.querySelector(".sk-sub-hits"), term = box.value.trim();
    if (!term) { list.hidden = true; list.innerHTML = ""; return; }
    if (!index) { list.hidden = false; list.innerHTML = `<p class="muted">Loading players…</p>`; }
    try { index ??= await loadSearch(); } catch { list.innerHTML = `<p class="muted">Player search didn't load. Try again.</p>`; return; }
    if (box.value.trim() !== term) return;
    const seen = new Set(t.players.map((p) => p.account)), hits = [];
    for (const r of searchIndex(index, term, 40)) {
      const account = decodeURIComponent(r.href.split("/player/")[1] ?? "");
      if (r.kind !== "player" || !/^\d+$/.test(account) || seen.has(account)) continue;
      seen.add(account);
      hits.push({ account, name: r.name, about: `${r.team ? `${r.standin ? "Stand-in for " : ""}${r.team}` : "No team"} · ${r.leagueLabel}` });
      if (hits.length === 8) break;
    }
    if (/^\d{4,12}$/.test(term) && !seen.has(term)) hits.push({ account: term, name: null, about: "Account ID" });
    list.hidden = false;
    list.innerHTML = hits.length ? hits.map((h) => `<button type="button" class="sk-sub-hit" data-account="${esc(h.account)}" data-name="${esc(h.name ?? "")}"><strong>${esc(h.name ?? `Account ${h.account}`)}</strong><span class="muted">${esc(h.about)}</span></button>`).join("")
      : `<p class="muted">No player found. Type their Dota account ID to add anyone.</p>`;
  };
  grid.addEventListener("input", (e) => { if (e.target.matches(".sk-sub-find")) subHits(e.target); });
  const redrawRow = (row, t) => {
    row.dataset.search = searchText(t);
    row.querySelector(".sk-players").innerHTML = playerList(t);
    row.querySelectorAll("[data-cards-of]").forEach((el) => playerDesigns(el.dataset.cardsOf).then(({ designs, failed }) => {
      el.textContent = failed ? "" : designs.length > 1 ? `${designs.length} cards` : designs.length ? "1 card" : "default";
      el.classList.toggle("many", designs.length > 1);
    }));
  };
  grid.addEventListener("click", async (e) => {
    const row = e.target.closest(".sk-team-pick"); if (!row) return;
    const t = byId.get(row.dataset.team), hit = e.target.closest(".sk-sub-hit"), x = e.target.closest("[data-unsub]");
    if (x) {
      e.preventDefault();
      t.players = t.players.filter((p) => !(p.standin && p.account === x.dataset.unsub));
      picks.delete(`${t.id}:${x.dataset.unsub}`);
      redrawRow(row, t); draw(); return;
    }
    if (!hit) return;
    const { account } = hit.dataset;
    let name = hit.dataset.name;
    if (!name) { hit.disabled = true; name = (await strangerNames([account]).catch(() => new Map())).get(account) ?? `Account ${account}`; }
    if (addSub(t.id, account, name) && !picks.has(`${t.id}:${account}`)) addPick(`${t.id}:${account}`);
    const box = row.querySelector(".sk-sub-find");
    box.value = ""; row.querySelector(".sk-sub-hits").hidden = true;
    redrawRow(row, t); draw(); box.focus();
  });
  app.querySelector(".sk-filter").addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    grid.querySelectorAll(".sk-team-pick").forEach((r) => { r.hidden = !!term && !r.dataset.search.includes(term); });
    grid.querySelectorAll(".sk-group").forEach((h) => { let n = h.nextElementSibling, any = false; while (n && !n.matches(".sk-group")) { any ||= !n.hidden; n = n.nextElementSibling; } h.hidden = !any; });
  });
  app.querySelector("[data-none]").onclick = () => { picks.clear(); draw(); };
  // Opening a team shows each player's card count, so you can see who has a choice without opening each.
  grid.addEventListener("toggle", (e) => {
    if (!e.target.open) return;
    e.target.querySelectorAll("[data-cards-of]:empty").forEach((el) => playerDesigns(el.dataset.cardsOf).then(({ designs, failed }) => {
      el.textContent = failed ? "" : designs.length > 1 ? `${designs.length} cards` : designs.length ? "1 card" : "default";
      el.classList.toggle("many", designs.length > 1);
    }));
  }, true);

  out.addEventListener("change", async (e) => {
    if (e.target.matches("[data-replay]")) {
      replay = Number(e.target.value) || 0; save(); refreshVsLink();
      const dr = out.querySelector("[data-dl-replay]"); if (dr) dr.textContent = `${replayName()}.`;
      return;
    }
    if (e.target.matches("[data-file], [data-file-at], [data-file-sync]")) {
      const box = out.querySelector("[data-file]");
      const picked = e.target.matches("[data-file]") ? fileList?.find((f) => f.file === box.value.trim()) : null;
      if (picked) out.querySelector("[data-file-sync]").value = picked.moment;
      file = fileName(box.value.trim());
      fileAt = out.querySelector("[data-file-at]").value;
      fileSync = Math.max(0, Number(out.querySelector("[data-file-sync]").value) || 0);
      out.querySelector("[data-file-sync-row]").hidden = fileAt !== "vs";
      save(); soundLabels(); checkFile(box.value.trim());
      return;
    }
    const um = e.target.closest("[data-use-music]");
    if (um) { if (um.checked) chooseMusic(um.dataset.useMusic || null); else um.checked = true; return; }
    const us = e.target.closest("[data-use-sound]");
    if (us) { if (us.checked) chooseSound(us.dataset.useSound || null, { keepFile: false }); else us.checked = true; return; }
    const ud = e.target.closest("[data-use-dota]");
    if (ud) { if (ud.checked) chooseDota(ud.dataset.useDota); else ud.checked = true; return; }
    // A ready-made scene's box: ticking one selects it; one is always ticked unless the layers make your own.
    const use = e.target.closest("[data-use-scene]");
    if (use) { if (use.checked) chooseScene(use.dataset.useScene); else use.checked = true; return; }
    const useOwn = e.target.closest("[data-use-own]");
    if (useOwn) { if (useOwn.checked && own) chooseScene(own); else useOwn.checked = !presetOf(scene); return; }
    const sel = e.target.closest("[data-mode]"); if (!sel) return;
    mode = sel.value; save();
    sel.disabled = true;
    await Promise.all([...picks.keys()].map(async (k) => { const { designs } = await playerDesigns(k.split(":")[1]); if (picks.has(k)) { picks.set(k, pickSlot(mode, designs)); refreshRow(k); } }));
    sel.disabled = false; save();
  });
  const flash = (btn, text) => { const was = btn.textContent; btn.textContent = text; setTimeout(() => { btn.textContent = was; }, 1500); };
  const copy = (text, btn) => navigator.clipboard.writeText(text).then(() => flash(btn, "Copied"), () => flash(btn, "Copy failed"));
  // One ⓘ bubble open at a time; a click anywhere else on the page closes it.
  app.querySelector(".stream-kit").addEventListener("click", (e) => {
    app.querySelectorAll(".sk-info[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
  });
  out.addEventListener("click", async (e) => {
    const go = e.target.closest("[data-tab-go]");
    const tb = go ? out.querySelector(`[data-tab="${go.dataset.tabGo}"]`) : e.target.closest("[data-tab]");
    if (tb) {
      if (sample && tb.dataset.tab !== "sound") playSound(sample.btn);
      tab = tb.dataset.tab;
      out.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === tb)));
      out.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== tab; });
      if (tab === "sound") { listFiles(); if (file) checkFile(file); }
      return;
    }
    const v = e.target.closest(".sk-view");
    if (v) return viewCards(v.closest(".sk-row").dataset.key);
    const c = e.target.closest(".sk-copy");
    if (c) return copy(c.hasAttribute("data-vs") ? vsLink(picked()) : rowUrl(c.closest(".sk-row").dataset.key), c);
    if (e.target.closest("[data-swap]")) { swap = !swap; return draw(); }
    const tile = e.target.closest("[data-watch-anim]");
    if (tile) return watchAnim(tile.dataset.watchAnim);
    if (e.target.closest("[data-watch-scene]")) return watchOwn();
    const ps = e.target.closest("[data-play-sound], [data-play-music], [data-play-dota]");
    if (ps) return playSound(ps);
    const lp = e.target.closest("[data-layer-pick]");
    if (lp) return pickLayer(lp.dataset.layerPick);
    if (e.target.closest("[data-watch-own]") && own) return watchScenes([[null, "Your own scene", describe(own), own]], 0);
    const s = e.target.closest("[data-share]");
    if (s) return copy(location.href, s);
    if (!e.target.closest("[data-download]")) return;
    const list = picked();
    // Card names for the OBS sources, where a player shows one of their saved designs.
    const named = await Promise.all(list.map(async ({ team, players }) => ({ name: team.name, rootUrl: team.rootUrl,
      players: await Promise.all(players.map(async (p) => ({ name: p.name, account: p.account, slot: p.slot,
        card: p.slot == null ? null : choiceName((await playerDesigns(p.account)).designs, p.slot) }))) })));
    const vs = list.length > 1 ? { name: vsTeams(list).map((g) => g.team.name).join(" vs "), url: vsLink(list) } : null;
    const { name, file: dlFile } = collectionName(list);
    const json = obsCollection(named, list[0].team.rootUrl, { name, vs });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 1)], { type: "application/json" }));
    a.download = dlFile;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  draw();
}
