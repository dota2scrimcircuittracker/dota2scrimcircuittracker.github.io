// Stream kit (pages/stream-kit.js): OBS card links and an importable OBS scene collection for any
// set of teams. Each card is a Browser Source on the player's ?stream=card page (parts/stream-card.js),
// which draws only that card, animated, on a transparent background.
export const CARD_W = 600, CARD_H = 840;
const CANVAS_W = 1920, CANVAS_H = 1080, GAP = 24;

// rootUrl: the league's address up to its route, e.g. "https://…/champion". slot: one of the player's
// saved card designs (null: their main card).
export const streamCardUrl = (rootUrl, account, slot = null) => `${rootUrl}/player/${account}?stream=card${Number.isInteger(slot) ? `&card=${slot}` : ""}`;
// The VS scene (parts/stream-vs.js): the kit page with ?stream=vs and the two teams' picks.
// picks: [["<team>:<account>", slot|null], …]; mode: the "Card for everyone" filter; anim: one of
// VS_ANIMS (the first, the default, is left out of the link).
export const VS_W = 1920, VS_H = 1080;
export const VS_ANIMS = [
  ["jump", "Jump in", "The cards jump in one by one and a VS slams down, then they hold still."],
  ["brawl", "Brawl", "The same jump-in, then the cards keep busy: hops, flips to their stats, taunts, waves and clashes."],
  ["deal", "Deal", "Dealt out of the middle face down like a hand of cards, then turned face up in a ripple. A shine sweeps across now and then."],
  ["meteor", "Meteor", "Cards crash down from above with shockwaves and the VS bursts in. Energy pulses roll out from the VS and light up each card."],
  ["warp", "Warp", "The VS spins in, a portal opens and the cards burst out of it in 3D. The teams sway like holograms."],
  ["spotlight", "Spotlight", "Each team slides in together and light streaks leave the VS behind. Then a spotlight steps through every player."],
  ["glitch", "Glitch", "Cards glitch into existence in broken slices and the VS buzzes on like neon. A card glitches now and then."],
];
export const vsSceneUrl = (rootUrl, picks, mode = "main", anim = VS_ANIMS[0][0]) => `${rootUrl}/stream-kit?stream=vs&picks=${picks.map(([k, s]) => (Number.isInteger(s) ? `${k}:${s}` : k)).join(",")}${mode !== "main" ? `&cards=${mode}` : ""}${anim !== VS_ANIMS[0][0] ? `&anim=${anim}` : ""}`;

// Up to five cards at 60% in a row; a longer roster shrinks to fit the canvas.
export function rowLayout(n) {
  const w = Math.min(CARD_W * 0.6, (CANVAS_W - (n + 1) * GAP) / n), scale = w / CARD_W;
  const total = n * w + (n - 1) * GAP, x0 = (CANVAS_W - total) / 2, y = (CANVAS_H - CARD_H * scale) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + GAP), y, scale }));
}

const item = (source, id, { x, y, scale }) => ({
  name: source.name, source_uuid: source.uuid, visible: true, locked: false, rot: 0, id, align: 5,
  pos: { x, y }, scale: { x: scale, y: scale },
  // OBS 31+ reads these relative fields: position in canvas heights from the centre, scale against scale_ref.
  pos_rel: { x: (x - CANVAS_W / 2) / (CANVAS_H / 2), y: (y - CANVAS_H / 2) / (CANVAS_H / 2) },
  scale_rel: { x: scale, y: scale }, scale_ref: { x: CANVAS_W, y: CANVAS_H },
  bounds_type: 0, bounds_align: 0, bounds: { x: 0, y: 0 }, bounds_rel: { x: 0, y: 0 },
  crop_left: 0, crop_top: 0, crop_right: 0, crop_bottom: 0, group_item_backup: false,
  scale_filter: "disable", blend_method: "default", blend_type: "normal", private_settings: {},
});
const scene = (name, items, uuid) => ({
  name, uuid: uuid(), id: "scene", versioned_id: "scene", enabled: true, muted: false, volume: 1,
  settings: { id_counter: items.length, custom_size: false, items }, flags: 0, mixers: 0, sync: 0,
  monitoring_type: 0, private_settings: {}, hotkeys: {},
});

// teams: [{ name, rootUrl?, players: [{ name, account, slot?, card? }] }] (card: the design's name, for
// the source name; a team's rootUrl overrides the shared one, for All divisions). One Browser Source per player, a scene per team
// (its cards in a row) and a scene per player (their card centred). Names are made unique, as OBS needs.
// vs: { name, url } adds the VS scene first: one full-canvas Browser Source that restarts its intro
// each time the scene comes on.
export function obsCollection(teams, rootUrl, { name = "DSL Stream Kit", uuid = () => crypto.randomUUID(), vs = null } = {}) {
  const used = new Set(), unique = (n) => { let out = n, k = 2; while (used.has(out)) out = `${n} (${k++})`; used.add(out); return out; };
  const sources = [], teamScenes = [], playerScenes = [];
  if (vs) {
    const source = {
      name: unique(`VS - ${vs.name}`), uuid: uuid(), id: "browser_source", versioned_id: "browser_source", enabled: true, muted: false, volume: 1,
      settings: { url: vs.url, width: VS_W, height: VS_H, fps: 60, fps_custom: true, reroute_audio: false, shutdown: true, restart_when_active: true, css: "" },
      flags: 0, mixers: 0, sync: 0, monitoring_type: 0, private_settings: {}, hotkeys: {},
    };
    sources.push(source);
    teamScenes.push(scene(unique(`Scene - ${vs.name}`), [item(source, 1, { x: 0, y: 0, scale: 1 })], uuid));
  }
  for (const team of teams) {
    const cards = team.players.map((p) => {
      const source = {
        name: unique(`Card - ${p.name}${p.card ? ` · ${p.card}` : ""}`), uuid: uuid(), id: "browser_source", versioned_id: "browser_source", enabled: true, muted: false, volume: 1,
        settings: { url: streamCardUrl(team.rootUrl ?? rootUrl, p.account, p.slot ?? null), width: CARD_W, height: CARD_H, fps: 30, fps_custom: true, reroute_audio: false, shutdown: false, restart_when_active: false, css: "" },
        flags: 0, mixers: 0, sync: 0, monitoring_type: 0, private_settings: {}, hotkeys: {},
      };
      sources.push(source);
      playerScenes.push(scene(unique(`Player - ${p.name}${p.card ? ` · ${p.card}` : ""}`), [item(source, 1, { x: (CANVAS_W - CARD_W) / 2, y: (CANVAS_H - CARD_H) / 2, scale: 1 })], uuid));
      return source;
    });
    if (cards.length) teamScenes.push(scene(unique(`Team - ${team.name}`), rowLayout(cards.length).map((at, i) => item(cards[i], i + 1, at)), uuid));
  }
  const scenes = [...teamScenes, ...playerScenes], first = scenes[0]?.name ?? "";
  return {
    name, current_scene: first, current_program_scene: first, scene_order: scenes.map((s) => ({ name: s.name })),
    sources: [...sources, ...scenes], groups: [], transitions: [], current_transition: "Fade", transition_duration: 300,
    quick_transitions: [], saved_projectors: [], resolution: { x: CANVAS_W, y: CANVAS_H },
  };
}

// Which card a filter picks for a player. designs: [{ slot, primary, pick, total, savedAt }] (pick: the
// community's rating, lib/card-ratings.js tally; savedAt: when the design last changed). Returns a slot,
// or null for the player's main card, which is also what a player with nothing to choose from gets.
// main: their main card. top: the best community pick, then the most votes, then the main card first.
// recent: the most recently saved design.
const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
export const CARD_MODES = [["main", "Main card"], ["top", "Highest rated"], ["recent", "Most recent"]];
export function pickSlot(mode, designs) {
  // The design with the highest score, compared value by value; a null score never wins.
  const ahead = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  const best = (score) => designs.reduce((top, x) => { const s = score(x); return s && (!top || ahead(s, top.s)) ? { d: x, s } : top; }, null)?.d ?? null;
  const d = mode === "top" ? best((x) => (x.pick ? [RANK[x.pick] ?? -1, x.total ?? 0, x.primary ? 1 : 0] : null))
    : mode === "recent" ? best((x) => (x.savedAt ? [x.savedAt, x.primary ? 1 : 0] : null)) : null;
  return d && !d.primary ? d.slot : null;
}
