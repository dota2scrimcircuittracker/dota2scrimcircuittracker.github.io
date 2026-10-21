# New cosmetics tier audit · October 18, 2026

Scope: all 29 rare, epic and legendary items in the 49-item local expansion review. The older catalog and the 20 common expansion items are outside this audit.

The audit used the real player-card renderer at normal card size, with each cosmetic isolated from other effects. Motion was inspected as well as the static appearance. Selected combinations were also checked on Drow Ranger and with a longer player name.

Tier standard: rare needs a recognizable material or lettering treatment and clear detail; epic needs a distinctive technique with visible depth or thematic motion; legendary needs a memorable identity with several coordinated layers. More brightness alone does not meet the standard. The hero and player name must remain readable.

17 items fell short and were upgraded. 12 met their assigned tier and were retained. All retain their original rarity and inventory IDs. The judgments below describe the result after this pass.

## Borders

| Item | Tier | Initial judgment | Result |
|---|---|---|---|
| Carbon Monocoque | Rare | Meets tier | Retained: carbon weave, molded corner mounts and fine channels give it a clear material identity. Reduced shared color-coating opacity preserves its texture. |
| Repousse Bronze | Rare | Meets tier | Retained: hammered material, relief rosettes and warm polish distinguish it from a common metal rail. |
| Obsidian Cut | Rare | Too close to a plain violet rim | Upgraded: alternating dark glass facets, diagonal cuts and sharp reflected edges remain visible through the moving color. |
| Tournament Pennant | Rare | Meets tier | Retained: contrasting enamel panels and separately placed folded pennants give it a distinct construction. |
| PCB Assembly | Rare | Circuit identity was too quiet | Upgraded: sequentially pulsing solder nodes make the circuit traces active and readable without overpowering the chips. |
| Malachite Inlay | Rare | Meets tier | Retained: irregular mineral banding and bronze mounting provide enough material detail. |
| Tectonic Plates | Epic | Flat corner plates and weak molten detail | Upgraded: beveled fractured stone, branching heated cracks and traveling molten seams, including matching standalone corner symbols and collection swatches. |
| Clockwork Reliquary | Epic | Meets tier | Retained: independently placed rotating gears, polished teeth and a separate ruled rail provide a coherent mechanical treatment. |
| Mirror Fracture | Epic | Reflections were too hard to see | Upgraded: explicit clipped mirror facets reflect the equipped artwork, with bright seams and staggered moving light. |
| Event Horizon | Legendary | Meets tier | Retained: an orbiting nebula, escaping vapor and stardust extend beyond the rim and form a distinct atmospheric composition. |
| Ouroboros | Epic | Meets tier | Retained: the continuous scaled serpent, tail-biting head, traveling sheen and sparks form a recognizable full-frame creature. |
| War of the Ancients | Legendary | Too close to a polished rim with tower symbols | Upgraded: opposing teal and rose volleys, impact sparks and pulsing fortress beacons reinforce the two-fortress theme. Existing independent symbol placements remain usable. |

## Finishes

| Item | Tier | Initial judgment | Result |
|---|---|---|---|
| Lenticular | Rare | Meets tier | Retained: interlaced artwork, moving lenses and a feathered reflection are immediately distinguishable from a common clear coat. |
| Ink in Water | Epic | Pigment was too faint to carry the effect | Upgraded: separately moving translucent pigment tendrils give the existing feathered blooms a visible flowing structure. |
| Shattered Time | Epic | Too little separation; only one main image fragment | Upgraded: three independently clipped fragments of the equipped artwork slip out of alignment and return, with cyan/violet fracture seams. |
| Supernova Bloom | Legendary | Stellar core was too small and passive | Upgraded: a pulsing luminous bloom, rotating corona and prominent core rays complement the shock rings and starfield. Fav's default center, star settings and zero-ejecta preference are preserved. |
| Abyssal Cloud | Legendary | Read as a rare mist effect | Upgraded: a ghostly bioluminescent leviathan swims through the cloudbank and layered sweeping currents. The existing drifting lights remain independently tunable. |
| Reality Rift | Legendary | Meets tier after its preceding upgrade | Retained: pulsing dimensional tear, opposing energy rings, expanding shockwaves, fragments and inward-flowing particles already establish a strong layered identity. |

## Signatures

| Item | Tier | Initial judgment | Result |
|---|---|---|---|
| Negative Cut | Rare | Meets tier | Retained: genuine cutout lettering exposes the artwork through a slanted ink swash. |
| Drafting Ligature | Rare | Too small and low contrast on short names | Upgraded: a larger minimum lettering width and clearer construction lines preserve the drafted identity at card size. |
| Contour Hand | Rare | Nested detail was too small to read | Upgraded: a larger minimum lettering width makes the internal contours visible on short names. |
| Pixel Hand | Rare | Meets tier | Retained: actual constructed pixel glyphs and the stepped underline are distinct from a font-only signature. |
| Needlework | Rare | Meets tier | Retained: stitched outlines, dark thread backing and moving sewing detail provide a recognizable material treatment. |
| Marquee Outline | Epic | Bulbs and outline were undersized | Upgraded: broader hollow lettering with a dark face, warm metal edge and glowing chasing bulbs. |
| Engraver's Hatch | Epic | Mostly static decorated type | Upgraded: larger engraved lettering, fine hatch texture and a moving polish glint confined to the metal strokes. |
| Folded Ribbon | Epic | Folded material was not convincing | Upgraded: satin letter faces, shaded return faces, clipped crease lines, a moving face reflection and a folded ribbon underline. |
| Afterimage Hand | Legendary | Subtle duplicate outlines did not earn legendary | Upgraded: three visibly separated cyan/violet/gold animated echoes, a foil main signature and a traveling light trace. |
| Typesetter Assembly | Legendary | Slight letter movement felt too basic | Upgraded: letters separate, rotate and lock into a foil wordmark between illuminated registration brackets. The assembled name holds between transitions. |
| Paperfold Autograph | Legendary | Read as ordinary stencil lettering | Upgraded: letters individually unfold in sequence, revealing shaded crease faces and foil highlights above an illuminated underline. The unfolded name holds between transitions. |

## Second pass · October 18

A fresh comparison of all 29 items found five that benefited from another focused refinement. The other 24 did not need another design change. This pass also found a shared SVG signature sizing defect that was much more apparent on long player names.

| Item | Remaining problem | Second-pass change |
|---|---|---|
| Tectonic Plates | The rail still read as smooth metal around the stone corners. | Dark segmented basalt now continues around the entire frame, with glowing fault joints between the slabs. |
| Shattered Time | Persistent closed polygon outlines cluttered the picture between distortions. | Partial fracture seams and fragments fade away between shifts, restoring the clean underlying artwork. |
| Abyssal Cloud | The creature was too indistinct to recognize at card size. | A clearer ray-shaped silhouette has independently moving wings, paired luminous eyes, vein detail and a trailing tail. |
| Typesetter Assembly | Letter delays grew with name length, leaving little time with the whole word assembled. | The whole word's stagger is capped at 0.45 seconds. A short separation/assembly sequence is followed by a long readable hold. |
| Paperfold Autograph | Long names spent too much of the cycle partially folded. | The same bounded stagger and longer fully unfolded hold preserve the complete name for most of the cycle. |

The SVG signatures already fit their lettering into a fixed viewBox, but the outer container also applied the legacy text-font length cap. That shrank long signatures twice. The outer SVG now honors the player's chosen size; the legacy text-based signatures retain their overflow guard. Browser checks confirmed the same 225.625px outer footprint for short and 26-character names in the comparison layout, with all 26 assembly letters reaching their completed pose together.

## Verification

First pass: `npm test` passed 473 tests. After the second pass, the full suite passes 476 tests with zero failures. Regression coverage includes long-name SVG sizing and bounded animation staggering. JavaScript syntax checks and `git diff --check` also pass.

All five comparison groups were inspected with the production renderer. Checks include shared artwork in mirror/time fragments, unique SVG identifiers across simultaneously rendered cards, short and long player names, hero changes, and the existing persistence/validation suite. The new effects use the existing placement, strength, speed, particle and symbol settings; no new save-data fields are required. Motion follows the existing preview pause and reduced-motion rules.

The local comparison sheet is `public/_dev/cosmetics-tier-audit.html`; it is development-only and uses the production modules without changing saved equipment. The user-facing review remains `http://127.0.0.1:3000/?reviewCosmetics=1#/gallery/collection`.
