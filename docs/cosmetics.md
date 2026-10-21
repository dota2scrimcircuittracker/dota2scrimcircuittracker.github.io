# Card collection

## October 20 wave

Thirty new designs, ten each of borders, finishes and signatures, listed in `lib/cosmetics-wave-catalog.js`.
They carry `expansion:{wave:1}`, so they show on the local review page and `expansionBorderHtml`,
`expansionFinishHtml` and `expansionSignatureHtml` hand them to `lib/cosmetics-wave-borders.js`,
`-finishes.js` and `-signatures.js`. Styles live in `cosmetics-wave.css`.
Borders draw each side in its own local space (x along the side, y inward), with mitred corners.
Finishes that re-treat the art (Halftone, Blueprint, Risograph, Sketchbook, Thermal, VHS) carry their
own `<image>`, which the card watcher keeps pointed at the card's artwork.
All of them shipped on October 21 with the October 17 expansion (see October 21 tiers).

Particle groups: `lib/cosmetics-particle-groups.js` lists each border and finish with particles and its groups
(Molten Gilding: drips, side runs, embers). The editor shows Count, Size and Speed for each group under the
border or finish speed slider. Border numbers save in `equipment.borderSettings[id]`, finish numbers in
`finishSettings[id]` beside any placement; the engine checks both, so the Worker must be redeployed before they save.
Wave items draw from the numbers; codex items clone or trim the elements the group's `selector` matches.
A group's speed multiplies the card's speed through `--border-speed-base` / `--particle-speed-base`.
Finishes with groups drop the single Particle amount slider. Remove a dropped item's entry here too.

Dota borders: five more in the Lane Creeps style (Roshan's Pit, River Runes, Courier Run, Ward Vision,
Jungle Stack), listed as `DOTA_CATALOG` in the wave catalog and drawn by `lib/cosmetics-dota-borders.js`,
which plugs into the wave borders' `BORDERS` map and reuses their pixel `sprite` helper.

Redrawn codex borders: six October 17 borders were redrawn from scratch on their old ids, so owned copies
keep working: parchment (now Illuminated Scroll), ochre (Cave Wall), carbon (Carbon Fiber), checker
(Grandmaster), tectonic (Continental Drift) and clockwork (Orrery). `lib/cosmetics-redrawn-borders.js` draws
them like wave borders; `expansionBorderHtml` sends them there before the codex pipeline, so they take no
house wash, colour flow or signature details, and they no longer have placeable corner emblems.

## October 20 house style

The 49 expansion cosmetics now match the original catalog's look (`lib/cosmetics-house-style.js`).
Borders get the plain frame's metal sheen, a saturated colour wash in the item's own colours, an
inner keyline and a glow that grows with rarity. Dark materials (Tectonic, Obsidian, Carbon,
Graphite) keep their dark base. Ouroboros is left alone because the serpent is the rim.
Signatures get their own ink colour (they all shared one cream) and a soft glow; foil and
multi-colour designs keep their palettes and take only the glow. Script and capital signatures
keep their natural letter width on short names instead of being stretched to a minimum width,
and Marquee, Engraver, Afterimage and Ribbon lettering is larger.

Finish pass, same day. Reality Rift is now a torn portal around the hero (`lib/reality-rift.js`):
energy, cracks and motes sit on a jagged rim and the centre stays clear. Abyssal Cloud is renamed
Leviathan's Wake (id `deep-sea` unchanged, so owned copies keep working); its wing lights pulse out
to the tips and plankton rise through the card. Shattered Time's seven shards show the hero's other
artwork (the Steam portrait, or the site art when the card already uses the portrait), toned sepia
or cyan, around a dial that runs backwards. Ink in Water was rebuilt as saturated drops that fall
and bloom down both sides. The particle amount setting now applies after these rebuilds.
Lenticular is unchanged.

Border pass, same day. Event Horizon's orbit now passes behind the card: its far half is a second SVG
behind the faces (`exp-horizon-back`), visible only where it leaves the card. Ouroboros has an
emerald and gold skin, a thicker body, a dorsal pattern that slides toward the head and a glowing
eye. `lib/cosmetics-border-upgrades.js` adds signature details: a green board with copper traces, pads,
signal packets and LEDs (PCB). (Tectonic, Clockwork, Tournament Pennant and Ochre Fluting had details here
too until they were redrawn on October 20; see above.)

## October 21 tiers

Fav ranked all 84 new items (October 17 expansion, October 20 wave, Dota borders) on a local page,
`public/_review/tier-rank.html` (gitignored; served by `npm start`, saves to `scripts/debug/cosmetics-tier-ranks.json`).
39 changed rarity and none were cut. Totals: 12 common, 28 rare, 33 epic, 11 legendary.
No signature is common any more, so signature packs keep the live odds (a common signature pack rolls Rare 86%).
Rarity also sets the card's glow (`data-rarity`) and the codex border polish, so moved items look a tier different.
This supersedes the rarities in the October 18 tier audit below.

## October 18 tier audit

All 29 rare, epic and legendary expansion cosmetics were reviewed at card size. Seventeen
received stronger material details or thematic animation; twelve met their tier and were
retained. Inventory IDs, rarities and saved placements remain compatible. The item-by-item
judgments and changes are in [the tier audit](cosmetics-tier-audit.md).
A second pass refined Tectonic's basalt rails, Shattered Time's idle appearance, Abyssal's
creature silhouette and the two per-letter legendary signature cycles. New SVG signatures
also honor the chosen size for long names without applying a second font-size reduction.

Collection and picker thumbnails are static samples; the selected full card keeps its full
animation. This removes 637 animated thumbnail elements from the expansion Collection view.
Offscreen collection entries skip rendering, and card animations pause outside the viewport
or in a hidden tab. The shared artwork observer batches updates once per affected card and
releases visibility observations for removed cards.
Rotating border color surfaces are bounded to 540×540 SVG units instead of 1800×2200;
the smaller square still covers every corner throughout a full rotation. The serpent's
translated surface uses a separate bound that covers both endpoints of its drift.
Border and finish picker samples are cached self-contained SVG images, so the editor does
not mount thousands of nested SVG nodes for its miniature samples. Embedded thumbnail art
keeps image documents independent of external image requests. The full selected card still
uses its original editable live SVG layers.

Equipment updates compare independent serialized keys for artwork, layout, finish,
signature and symbols. An unrelated edit preserves existing effect nodes and animation
phase. Hero image load listeners attach once per image, and speed changes update CSS or
canvas parameters without rebuilding the finish. Regression coverage checks channel
invalidation and cached image documents; the full test suite passes 482 tests.

## October 17 expansion

The six voting rounds add 49 selected designs: 24 borders, eight finishes and 17 distinct
signature styles. The shared catalog now contains 155 items. Round-six Keeps retain their
selected variants; the four Improves add a tail-biting, sparkling Ouroboros, moving metal
reflections and extra edge particles on War of the Ancients, drifting Rift dust, and a
cleaner stacked signature with a looping underline. Porcelain and Oil Slick remain retired.
The SVG materials live in `public/lib/cosmetics-expansion*.js` and use the real shared card,
artwork, name, symbol placement and signature controls. Runtime assets do not import `_dev` files.

Customize includes a draggable placement handle plus horizontal, vertical, rotation, size
and strength controls for all eight new finishes. The upgraded finishes use the existing
placement settings. Supernova also has separate count, size and speed controls for its
starfield and ejecta. All 17 new signatures use the existing drag, rotate and resize controls. `finishSettings` saves
these values per finish and per card design; the shared engine validates them before saving.
Supernova defaults preserve Fav's exported setup: center 54%/63%, 60 stars at 1.8 size and
1.5 shimmer speed, zero ejecta (0.5 size and 3 travel speed). Fortresses use the existing
independent border symbols; each has a saved rotation, a rotation slider, and a draggable
rotation handle (Shift snaps to 15 degrees). Clockwork gears use the same editing controls,
with independent rotation animation. `borderEmblems` stores gear and fortress layouts by border
so switching between them keeps each arrangement; legacy fortress placements still load.
The same controls also apply to the original standalone rosettes, PCB chips, pennants, screws
and corner mounts on 12 other new borders. Their SVG artwork is reused without redesigning
the ornaments, and each border retains its own saved arrangement.
Symbols and frames sit beside the card faces so the artwork's
clipping boundary cannot hide their material or particles. Existing inventory quantities and pack odds are unchanged;
common signature packs can now roll common styles rather than moving those rolls up to rare.
Event Horizon uses translucent, turbulent vapor, loose drifting plumes and orbiting dust instead
of solid orbit lines. Mirror Fracture reflects the selected artwork with animated glints and
facet shimmer. Other new frames receive gloss limited to the border band. Ouroboros has a
continuous neck and a tapered tail layered between its jaws. Border motion follows the saved
border speed; reduced-motion preferences disable it.

The October 18 polish follows the existing moving-frame and foil recipes: six rare borders
have a stronger, tinted gloss pass and fine permanent rim reflection. War of the Ancients,
Event Horizon and Ouroboros carry palette-specific moving color, clipped to their existing
rim or serpent skin. The original textures, ornaments and particles remain visible.
Legendary finish colors shift within their clouds or star rings; Lenticular has a soft
moving reflection. All motion uses the existing border/finish speed settings and stops for
reduced motion. Border-only wide thumbnails share these same treatments.

For local review, open `http://127.0.0.1:3000/?reviewCosmetics=1#/gallery/customize`.
This is the normal Gallery and Customize UI with only the 49 new cosmetics shown for this
test: 24 borders, eight finishes and 17 signatures, in a separate local inventory.
No finish and No signature remain available to clear those layers while comparing. Four example cards
are seeded; editing and saving stay in that browser. The mode
only activates on loopback with the explicit query parameter and never writes to the live
collection API.

The approved launch catalog is `public/lib/cosmetics-catalog.js`, taken from
`cosmetics-review (3).json`: 33 borders, 14 finishes, 21 autograph effects, plus
one legendary Japanese katakana name-rendering unlock. Edit catalog rarity to
change future rolls; existing quantities remain owned. Removed designs do not drop.
Default grey, no finish, no autograph and original lettering are always free.

Animated set (ids start `fx-`, 15 borders and 12 finishes, added October 2026 from the practice lab and
ranked by Fav): borders are CSS in `public/cosmetics-fx.css` through the shared frame hooks; finishes are
CSS or, for rain, downpour, mist, clouds, lightning, smoke, rot, leaves and ethereal motes, a canvas drawn by
`public/lib/card-fx.js` (one shared loop, only canvases on screen run, still frame under reduced motion).
Each saved design carries three tuning values, 50% to 200%: `particleSpeed` (finish speed), `particleAmount`
(canvas particle count) and `borderSpeed`, validated in `equipCosmetics`. The editor shows each slider only
when the equipped finish or border uses it. Rain and Rain Storm borders were flagged for more work.

The actual shared player card defines geometry, artwork and crop. Cosmetics decorate
that card without changing its format. Signatures always use the player's displayed
name; custom signature text is ignored by the server and renderer. The editor saves
percentage coordinates, size and rotation. Signatures
can be dragged, moved with arrow keys, or positioned with sliders. A collected
language unlock combines with any collected autograph style. Katakana uses a local
phonetic syllable renderer; unusual English pronunciations can be approximate.
Collection's editor groups text and image controls into collapsible sections.
Hero, background artwork, filter, crop and hue are saved alongside cosmetics in
the collection service. Those base-card choices override older Firestore artwork
preferences in the shared renderer; no additional Firestore write rules are needed.
Each player can save three independent designs using the same owned cosmetics.
The existing card becomes Card 1. One saved slot is primary; owners see their
primary card in normal site views. Optional shuffle chooses among saved slots
for other viewers, consistently per player for that viewer's browser session.
Profiles show all saved designs and identify the primary. Empty slots are never
chosen by shuffle. Saving a design and changing primary/shuffle are authenticated,
transactional, replay-safe operations; inventories and pack counts are unchanged.

Each normal pack independently rolls three items: 69% common, 17% rare, 10% epic,
4% legendary. Any item category can occupy any slot if that category contains an
item in the rolled tier. Duplicates are allowed, but a rolled card the player already
owns has a 1 in 10 chance to swap for an unowned card of the same rarity (themed packs:
same rarity and kind; `NEW_CARD_REROLL` in `lib/cosmetics-engine.js`). Rarity odds are
unchanged, and with every card of that rarity owned it stays a duplicate. Five extra copies of one rarity
recycle into a three-item pack with the next rarity as the minimum; the last copy
is protected. Higher-tier odds are the normal weights conditioned on that minimum:
rare packs 54.8387% rare / 32.2581% epic / 12.9032% legendary;
epic packs 71.4286% epic / 28.5714% legendary; legendary packs 100% legendary.
Legendary cards cannot be recycled. Packs may contain any combination of item types.

The first account session grants three welcome packs. Normal packs refill every
eight hours, accruing offline up to three stored normal packs. At capacity the
timer pauses; opening a normal pack starts a fresh eight-hour countdown. Recycled
upgrade packs do not occupy normal storage. Each account stores its next refill
timestamp, evaluated on demand without scheduled jobs. Existing inventories are
migrated without removing packs. Authenticated collection requests use the existing Firebase
Steam ID token. The Worker verifies it with Firebase, derives account identity
from the verified UID, and rolls using server-side cryptographic randomness.

`CosmeticsVault` holds account inventories, pack queues, appearance records and
idempotency receipts in transactional Durable Object storage. The browser cannot
grant packs, choose odds or equip unowned items. Public endpoints expose collection
quantities and appearance, never pack queues or grant history. The gift button,
collection index, editor and profile card use the same inventory service.

## Layout and ratings

Each saved design can carry a layout (`public/lib/card-layout.js`, saved as `equipment.layout`):
the owner's own card name (plain text, at most 24 characters) and its size, each front part
(tier, position, name, record, team, hero line) shown or hidden, sized, and dragged anywhere on
the face, and the back's stats (up to eight, in order) and its position-bar and top-hero sections.
`validLayout` is the only check, and the Worker runs it through `equipCosmetics`. The free-text
name is a moderation risk: it shows on public cards, so offensive names need removing by hand.

Every card has a full-size button (`showBigCard` in `public/parts/player-card.js`).

Signed-in players rate other players' saved designs common, rare, epic or legendary
(`public/lib/card-ratings.js`). Votes belong to a design's fingerprint (`designKey`), not its
slot: changing a card starts it at no votes, and changing it back restores them. The Worker
keeps one vote per voter per design (`rate` action, never your own card) under
`votes:<owner>:<key>`, and `GET /cosmetics/ratings/<account>` returns each saved design's counts.
Profiles show them under each saved design. Your own vote is remembered in your browser only.

## Launch

1. In `workers/steam-auth`, configure `FIREBASE_WEB_API_KEY` for the same Firebase
   project used by the site: `npx wrangler secret put FIREBASE_WEB_API_KEY`.
   The existing `FIREBASE_SA` secret used by Steam sign-in stays configured.
2. Run `npx wrangler deploy` from that folder. `wrangler.toml` adds the
   `COSMETICS` binding and SQLite migration. The Worker must deploy before the site
   is published. No new Firestore permissions or IAM roles are required.
3. Publish the site through its existing GitHub Pages deployment.
4. Sign in with Steam; confirm three initial packs, open one, save a cosmetic,
   and verify it appears on your profile and Fantasy card on another browser.

The browser implementation points at `https://steam-auth.ad2lstats.workers.dev/cosmetics`.
Before the Worker deploys, existing cards still load and the gift dialog can show
the collection catalog, while account collection operations report unavailable.
The collection Worker was deployed on October 13, 2026 (version
`038d9d4d-8bb0-4448-a634-ec77289e1d5c`; layouts and ratings in
`ea2e17e3-bd2e-424d-a7e4-72eb3055ce53`, October 13), with `FIREBASE_WEB_API_KEY`
configured and the `COSMETICS` migration applied. Public appearance reads and
localhost CORS preflight passed against the deployed service. The frontend remains
an unpushed local preview at `http://localhost:3000/`; Steam-authenticated pack
testing there uses real account inventory. GitHub Pages has not been updated.
The verification request supplies the validated site origin as its HTTP referrer
to satisfy the Firebase web key's website restriction. Authentication service
failures are reported separately from expired or invalid user sessions.

## Validation

`npm test` covers exact roll thresholds, three-item packs, refill timing and caps, ownership,
recycling minimums, replay-safe opens, authentication rejection and signature bounds.
`public/_dev/collection.html` is a local playtest using the actual production UI
and renderer with a separate browser-only inventory. It is ignored and not deployed.
Reset test inventory restores three packs, five extra Copper copies, Gold Foil and
the katakana unlock, so pack opening, recycling and signature placement can be tested.
