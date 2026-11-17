// Stream kit (pages/stream-kit.js): OBS card links and an importable OBS scene collection for any
// set of teams. Each card is a Browser Source on the player's ?stream=card page (parts/stream-card.js),
// which draws only that card, animated, on a transparent background.
export const CARD_W = 600, CARD_H = 840;
const CANVAS_W = 1920, CANVAS_H = 1080, GAP = 24;

// rootUrl: the league's address up to its route, e.g. "https://…/champion".
export const streamCardUrl = (rootUrl, account) => `${rootUrl}/player/${account}?stream=card`;

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

// teams: [{ name, players: [{ name, account }] }]. One Browser Source per player, a scene per team
// (its cards in a row) and a scene per player (their card centred). Names are made unique, as OBS needs.
export function obsCollection(teams, rootUrl, { name = "DSL Stream Kit", uuid = () => crypto.randomUUID() } = {}) {
  const used = new Set(), unique = (n) => { let out = n, k = 2; while (used.has(out)) out = `${n} (${k++})`; used.add(out); return out; };
  const sources = [], teamScenes = [], playerScenes = [];
  for (const team of teams) {
    const cards = team.players.map((p) => {
      const source = {
        name: unique(`Card - ${p.name}`), uuid: uuid(), id: "browser_source", versioned_id: "browser_source", enabled: true, muted: false, volume: 1,
        settings: { url: streamCardUrl(rootUrl, p.account), width: CARD_W, height: CARD_H, fps: 30, fps_custom: true, reroute_audio: false, shutdown: false, restart_when_active: false, css: "" },
        flags: 0, mixers: 0, sync: 0, monitoring_type: 0, private_settings: {}, hotkeys: {},
      };
      sources.push(source);
      playerScenes.push(scene(unique(`Player - ${p.name}`), [item(source, 1, { x: (CANVAS_W - CARD_W) / 2, y: (CANVAS_H - CARD_H) / 2, scale: 1 })], uuid));
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
