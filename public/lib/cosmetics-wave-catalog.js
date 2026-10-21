// The October 20 wave: ten borders, ten finishes and ten signatures drawn from scratch in lib/cosmetics-wave.js.
// They share the expansion review page and rendering hooks; `expansion.wave` routes them to their own renderers.
const item=(type,id,name,rarity,a,b,description)=>({id,name,type,rarity,key:`${type}:${id}`,...(type==='border'?{texture:`exp-${id}`}:{}),a,b,symbol:'',description,expansion:{wave:1}});
export const WAVE_CATALOG=[
 item('border','tape-measure','Tape Measure','rare','#f2c21b','#2a2416','A yellow steel tape wraps the card, inch ticks on the outside, centimetres inside, its hook caught on the top corner.'),
 item('border','knit-scarf','Knitted Scarf','rare','#b8322c','#efe3c8','Chunky red stitches with cream bands, and a yarn fringe hanging off the bottom of the card.'),
 item('border','bubble-wrap','Bubble Wrap','rare','#d6ecff','#7fa6c8','Glossy packing bubbles, sealed at the edge. A few have already been popped.'),
 item('border','caution-tape','Caution Tape','epic','#f5d10a','#15130f','Hazard tape that never stops unspooling, with a strip slapped across one corner and a loose end flapping in the breeze.'),
 item('border','film-reel','Film Reel','epic','#2a241c','#ffb347','A strip of 35mm film runs around the card, sprockets advancing, with warm light leaking in at the corners.'),
 item('border','cathedral-glass','Cathedral Glass','rare','#1f4fbf','#b3122e','Leaded jewel-tone glass with rose medallions in the corners. A slow beam of daylight passes through it.'),
 item('border','neon-sign','Neon Sign','epic','#ff4fb8','#43f0ff','Pink and cyan glass tubes on a dark mount. They hum, cast light onto the card, and one of them is on its way out.'),
 item('border','overgrowth','Overgrowth','epic','#4f8f2f','#f49ac1','A vine has claimed the rim: leaves sway, blossoms open in the corners and petals drift down the sides.'),
 item('border','molten-gilding','Molten Gilding','epic','#f7d774','#ff8a1f','Gold so freshly poured it still runs: molten streams flow down the sides and drips swell and fall from the top edge.'),
 item('border','lane-creeps','Lane Creeps','legendary','#5ec46b','#c0392b','The rim is a lane. Radiant and Dire creeps march out from their Ancients, past the towers, and clash in the corners.'),
 item('finish','halftone-print','Halftone','rare','#e0007a','#00a0e0','The hero printed in comic-book dots: black shading screened from the art itself, with off-register magenta and cyan.'),
 item('finish','blueprint-sheet','Blueprint','rare','#1d5fbf','#cfe6ff','The card as a technical drawing: blueprint ink, a drafting grid, dimension lines and a title block.'),
 item('finish','risograph','Risograph','epic','#ff48b0','#00a5a8','Two-colour riso print on cream stock. The pink and teal plates never quite line up.'),
 item('finish','confetti-pop','Confetti Pop','epic','#ffd23f','#ff4d6d','A steady fall of tumbling confetti in party colours.'),
 item('finish','sketchbook','Sketchbook','epic','#3a3a40','#efe6d2','Pencilled into a sketchbook: graphite hatching at the edges and doodles that keep redrawing themselves.'),
 item('finish','thermal-cam','Thermal Camera','epic','#ff6a1f','#3b0f6b','Seen through a thermal scope: heat-mapped hero, a viewfinder reticle, a live temperature readout and a scanning sweep.'),
 item('finish','vhs-tracking','VHS Tracking','epic','#ff3b3b','#3bd6ff','A worn tape on PLAY: chroma bleed, scanlines and a tracking glitch that rolls down the picture.'),
 item('finish','rain-glass','Rain on Glass','legendary','#bfe3ff','#5a7a99','The card behind a rainy window. Beads cling to the glass and every so often one breaks loose and runs.'),
 item('finish','aurora-veil','Aurora','epic','#4dff9a','#b86bff','Night falls over the art and the northern lights roll across it in rayed green and violet curtains, with the odd shooting star.'),
 item('finish','disco-ball','Disco Ball','epic','#ff4fd8','#ffe14d','A mirror ball hangs from the top of the card, spinning, and throws coloured light across the hero.'),
 item('autograph','ransom-note','Ransom Note','epic','#ffe14d','#d8333a','Every letter cut from a different magazine and glued down a little crooked.'),
 item('autograph','spray-tag','Spray Tag','epic','#ff2d95','#ffe14d','A street tag in hot spray paint: fat outlined letters, overspray haze, a crown, and drips that keep running.'),
 item('autograph','wax-seal','Wax Seal','epic','#c0262d','#d9b45a','A flowing script name sealed in red wax, stamped with your initial over gold ribbon.'),
 item('autograph','morse-code','Morse Code','epic','#ffcf6e','#f0e1b8','Your name in stencilled capitals with its Morse code tapped out underneath.'),
 item('autograph','typewriter','Typewriter','legendary','#efe6d2','#e2453c','Struck one key at a time, each letter inked a little differently, with a blinking carriage.'),
 item('autograph','constellation','Constellation','epic','#cfe3ff','#7fa8ff','Your name drawn as a star chart: twinkling stars joined by lines that trace themselves across the sky.'),
 item('autograph','varsity-patch','Varsity Patch','epic','#d9a93a','#1d2a4a','Satin-stitched gold lettering on a navy twill patch with a merrowed edge.'),
 item('autograph','barcode','Barcode','epic','#f6f2e6','#111111','Your name as a product sticker: a barcode generated from the letters, stuck on slightly crooked.'),
 item('autograph','sparkler','Sparkler','legendary','#ffcf6e','#fff4d6','A sparkler writes your name in light and leaves it glowing, embers and all.'),
 item('autograph','liquid-chrome','Liquid Chrome','epic','#b7d3f2','#2b3f63','Y2K chrome bubble letters with a horizon reflection, a light sweep and twinkling glints.'),
];
// Five more Dota borders in the Lane Creeps style (lib/cosmetics-dota-borders.js), drawn by the same wave renderer.
export const DOTA_CATALOG=[
 item('border','roshan-pit',"Roshan's Pit",'legendary','#ffd34d','#7a6250',"Roshan waits in two pits, top right and bottom left. A party walks the rim and takes them in turn: each Roshan falls and drops the Aegis, then respawns."),
 item('border','river-runes','River Runes','legendary','#3d8bff','#ffd34d','The rim is the river. Haste, double damage, illusion, invisibility, regeneration and arcane runes cycle on six spots round the river, out of step so every rune is always showing somewhere.'),
 item('border','courier-run','Courier Run','epic','#a8956c','#8a4ad8','Couriers run out from the Radiant and Dire Ancients, past their towers to the far corner of the lane, and back home.'),
 item('border','ward-vision','Ward Vision','epic','#e8c840','#1a2620','Night fog on the rim. Wards go down one after another and light the ground around them, while a Smoke of Deceit drifts by.'),
 item('border','jungle-stack','Jungle Stack','epic','#8fc45a','#ffd34d','Four neutral camps in the corners. At 0:53 they get pulled out along the rim and walk back to stack.'),
];
// Finishes that animate take the speed control; the particle ones also take the amount control.
export const WAVE_ANIMATED_FINISHES=['risograph','confetti-pop','sketchbook','thermal-cam','vhs-tracking','rain-glass','aurora-veil','disco-ball'];
export const WAVE_PARTICLE_FINISHES=['confetti-pop','rain-glass','disco-ball'];
