// Intro sounds for the VS scene (&sound=<id>): a library of sound sets, each made in the browser with
// Web Audio (no sound files) and scheduled to the intro's own timings, so it stays in sync with
// whichever scene is picked. Each set has its own voice for the build-up under the intro, a frame
// coming in, each card landing (panned to its side, climbing note by note), a frame crashing down and
// the VS arriving. The kit's Sound tab picks one; &sound=1 (the first links) plays Gong.
// In OBS the kit's import sets "Control audio via OBS", so it's its own channel in the mixer.

// [id, name, what it sounds like, group]. The kit's Sound tab lists them by group.
export const SOUND_GROUPS = ["Epic", "Fantasy", "Electronic", "Arena", "Light"];
export const VS_SOUNDS = [
  ["gong", "Gong", "A low horn builds, cards thump in, and a big gong rings on the VS.", "Epic"],
  ["braam", "Cinematic", "A trailer-style riser, sub hits on each card, a huge brass BRAAM on the VS.", "Epic"],
  ["titan", "Titan", "A deep drone and riser, a sub boom per card, a massive low chord on the VS.", "Epic"],
  ["trailer", "Trailer hits", "A rising rush, a metal clang per card, a giant clang and boom on the VS.", "Epic"],
  ["choir", "Choir", "Voices swell, a sung note per card, a full choir on the VS.", "Epic"],
  ["timpani", "Timpani", "A timpani roll, a drum note per card, a timpani strike and cymbal on the VS.", "Epic"],
  ["orchestra", "Orchestra", "Strings rise, a pluck per card, an orchestra hit on the VS.", "Epic"],
  ["anvil", "Forge", "A forge hisses, a hammer on the anvil per card, a huge clang on the VS.", "Epic"],
  ["horn", "War horn", "A battle horn calls, war toms on each card, a drum and crash on the VS.", "Fantasy"],
  ["drums", "War drums", "A drum roll speeds up, a taiko hit per card, three big hits on the VS.", "Fantasy"],
  ["storm", "Storm", "Thunder rumbles in, a crack on each card, a thunderclap on the VS.", "Fantasy"],
  ["arcane", "Arcane", "A shimmering pad rises, a chime per card, a burst of sparkle on the VS.", "Fantasy"],
  ["ancient", "Temple", "A deep drone, a singing bowl per card, a temple gong on the VS.", "Fantasy"],
  ["fire", "Fire", "Flames crackle up, a fireball per card, an explosion on the VS.", "Fantasy"],
  ["ice", "Frost", "Cold wind, an ice crack and chime per card, a shatter on the VS.", "Fantasy"],
  ["void", "Void", "A dark pull, a deep whomp per card, an implosion on the VS.", "Fantasy"],
  ["nature", "Wilds", "A flute and wind, a wood knock per card, a log drum on the VS.", "Fantasy"],
  ["holy", "Radiant", "A bright choir, a chime per card, ringing bells on the VS.", "Fantasy"],
  ["shadow", "Dire", "A dark, uneasy drone, low plucks per card, a distorted boom on the VS.", "Fantasy"],
  ["teleport", "Teleport", "A rising shimmer, a zap per card, a warp and boom on the VS.", "Fantasy"],
  ["bassdrop", "Bass drop", "A riser and snare roll, a kick per card, a wobbling drop on the VS.", "Electronic"],
  ["synthwave", "Synthwave", "An 80s arpeggio, a big snare per card, a wide synth chord on the VS.", "Electronic"],
  ["laser", "Lasers", "A charge-up whine, a laser shot per card, a blast on the VS.", "Electronic"],
  ["glitch", "Glitch", "Random blips, a stutter per card, a broken-up hit on the VS.", "Electronic"],
  ["trap", "Trap", "Hi-hat rolls, an 808 per card, a long 808 and clap on the VS.", "Electronic"],
  ["techno", "Techno", "A four-on-the-floor build, a clap per card, a kick, chord and crash on the VS.", "Electronic"],
  ["scifi", "Sci-fi", "Computer beeps, a bleep per card, a power-up on the VS.", "Electronic"],
  ["arcade", "Arcade", "8-bit: blips climb, a beep per card, a little fanfare on the VS.", "Electronic"],
  ["stadium", "Stadium", "A crowd roars up, stomps and claps per card, an air horn on the VS.", "Arena"],
  ["boxing", "Fight night", "A crowd buzzes, a punch per card, the ding-ding bell on the VS.", "Arena"],
  ["countdown", "Countdown", "A clock ticks, a tick per card, a buzzer on the VS.", "Arena"],
  ["airhorn", "Air horns", "A snare roll, a snare per card, three air horn blasts on the VS.", "Arena"],
  ["alarm", "Alarm", "A siren winds up, a beep per card, a horn blast on the VS.", "Arena"],
  ["heartbeat", "Heartbeat", "A heartbeat speeds up, a beat per card, a heavy double beat on the VS.", "Arena"],
  ["soft", "Subtle", "Quiet ticks as cards land and a soft bell on the VS. Sits under a caster.", "Light"],
  ["marimba", "Marimba", "Rising marimba, a note per card, a bright chord on the VS.", "Light"],
  ["piano", "Piano", "A piano note per card climbing a scale, a full chord on the VS.", "Light"],
  ["coins", "Coins", "A coin per card, a jackpot jingle on the VS.", "Light"],
  ["typewriter", "Typewriter", "Keys clatter, a key per card, the ding on the VS.", "Light"],
  ["whoosh", "Clean whooshes", "No music: a whoosh per card and one clean impact on the VS.", "Light"],
];
// Music that plays on a loop once the intro's done, under whatever the scene does after: [id, name, about].
export const VS_MUSIC = [
  ["march", "War march", "Slow taiko drums and a low drone. Keeps the tension up."],
  ["ambient", "Ambient", "Soft, slow chords with the odd chime. Sits quietly under casters."],
  ["synthwave", "Synthwave", "A driving 80s bassline, drums and a warm pad."],
  ["lofi", "Lo-fi", "A laid-back beat with mellow piano chords."],
  ["pulse", "Arena pulse", "A steady four-on-the-floor kick and pulsing bass. Hype, not loud."],
  ["mystic", "Mystic", "Marimba patterns over a deep drone, a little magical."],
];
// A Dota sound file from public/audio/dota/ (its list.json names each one and its big moment, in seconds):
// &file=<name>&fileat=<when>&filesync=<s>.
//   intro  from the start of the intro, once
//   vs     timed so the file's second `sync` lands on the VS
//   after  on a loop from just after the VS
export const FILE_AT = [["intro", "With the intro"], ["vs", "Its big moment on the VS"], ["after", "On a loop after the intro"]];
export const fileName = (v) => (/^[\w .()-]{1,80}\.(mp3|ogg|wav|m4a|webm|flac)$/i.test(v ?? "") ? v : null);
const AUDIO = new URL("../audio/dota/", import.meta.url);
export const fileUrl = (name) => new URL(encodeURIComponent(name), AUDIO).href;
export const fileListUrl = () => new URL("list.json", AUDIO).href;
const decoded = new Map(); // url → Promise<AudioBuffer>
export async function loadFile(name) {
  if (!window.AudioContext) return null;
  if (!ac) setup();
  const url = fileUrl(name);
  if (!decoded.has(url)) decoded.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.arrayBuffer(); }).then((b) => ac.decodeAudioData(b)));
  return decoded.get(url).catch(() => { decoded.delete(url); return null; });
}
export const musicOf = (v) => (VS_MUSIC.some(([id]) => id === v) ? v : null);
export const soundOf = (v) => (v === "1" ? "gong" : VS_SOUNDS.some(([id]) => id === v) ? v : null);

let ac = null, master = null, verb = null, noiseBuf = null;
let dry = null, wet = null; // the current run's outputs, so starting another can fade this one out
let musicTimer = null; // the running track's scheduler
// The music bus: the track and an "after" file. A new run fades it out, unless it's a replay of the
// intro (vsSound(id, { keep: true })), which leaves the music going and dips it under the intro.
let bed = null;
function bedOut() {
  if (!bed) { const d = ac.createGain(), w = ac.createGain(); d.connect(master); w.connect(verb); bed = [d, w]; }
  return bed;
}
function fade(nodes, t, to = 0, secs = 0.15) {
  for (const g of nodes) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(to, t + secs); }
}

function setup() {
  ac = new AudioContext();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.25;
  master = ac.createGain();
  master.gain.value = 0.7;
  master.connect(comp).connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // A hall: decaying stereo noise as the reverb's impulse.
  const len = ac.sampleRate * 2.4, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
  const conv = ac.createConvolver();
  conv.buffer = ir;
  verb = ac.createGain();
  verb.gain.value = 0.35;
  verb.connect(conv).connect(master);
}

// ─── Building blocks. t is in AudioContext seconds.
function env(t, peak, attack, decay, dest) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}
// A node feeding the dry mix (panned) and the hall.
function out(pan = 0, send = 0.3) {
  const p = ac.createStereoPanner();
  p.pan.value = pan;
  p.connect(dry);
  const w = ac.createGain();
  w.gain.value = send;
  w.connect(wet);
  const g = ac.createGain();
  g.connect(p); g.connect(w);
  return g;
}
function noise(t, dur) {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
  return s;
}
function tone(t, dur, type, f0, f1 = f0, glide = dur) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
  o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function filter(type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
const note = (base, semis) => base * 2 ** (semis / 12);
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const step = (n) => PENTA[Math.min(n, PENTA.length - 1)];

function whoosh(t, dur = 0.45, gain = 0.5, pan = 0, top = 2600) {
  const f = filter("bandpass", 300, 1.4);
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(top, t + dur * 0.7);
  f.frequency.exponentialRampToValueAtTime(500, t + dur);
  noise(t, dur).connect(f).connect(env(t, gain, dur * 0.7, dur * 0.3, out(pan, 0.25)));
}
function thump(t, pitch, gain = 0.8, pan = 0) {
  tone(t, 0.4, "sine", pitch * 2.6, pitch, 0.1).connect(env(t, gain, 0.004, 0.36, out(pan, 0.15)));
  tone(t, 0.25, "triangle", pitch * 4, pitch * 2, 0.08).connect(env(t, gain * 0.25, 0.004, 0.2, out(pan, 0.2)));
  noise(t, 0.05).connect(filter("highpass", 2500)).connect(env(t, gain * 0.35, 0.002, 0.04, out(pan, 0.1)));
}
// A drum: a pitched body that drops, and a slap of noise.
function drum(t, pitch, gain = 0.8, pan = 0, decay = 0.5, slap = 0.3) {
  tone(t, decay + 0.1, "sine", pitch * 1.8, pitch, 0.06).connect(env(t, gain, 0.003, decay, out(pan, 0.3)));
  noise(t, 0.12).connect(filter("bandpass", 1200, 0.8)).connect(env(t, gain * slap, 0.002, 0.1, out(pan, 0.3)));
}
function crash(t, gain = 0.4, decay = 1.6) {
  noise(t, decay).connect(filter("highpass", 5000)).connect(env(t, gain, 0.003, decay, out(0, 0.5)));
}
function sub(t, gain = 1, f0 = 110, f1 = 30, decay = 1.4) {
  tone(t, decay + 0.2, "sine", f0, f1, 0.9).connect(env(t, gain, 0.005, decay, out(0, 0.2)));
}
function gong(t, size = 1) {
  sub(t, 1.1 * size);
  const lp = filter("lowpass", 5000);
  lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.6);
  noise(t, 0.8).connect(lp).connect(env(t, 0.6 * size, 0.003, 0.7, out(0, 0.4)));
  for (const [m, g, d] of [[1, 0.3, 2.4], [2.76, 0.16, 1.6], [5.4, 0.09, 1.1], [8.93, 0.05, 0.7]])
    tone(t, d, "sine", 98 * m).connect(env(t, g * size, 0.006, d, out(0, 0.7)));
}
function bell(t, f = 392, gain = 1) {
  for (const [m, g, d] of [[1, 0.22, 2], [2.01, 0.12, 1.4], [3.9, 0.06, 0.9]]) tone(t, d, "sine", f * m).connect(env(t, g * gain, 0.004, d, out(0, 0.8)));
}
function crack(t, gain = 0.5, n = 6, pan = 0) {
  const hp = filter("highpass", 900);
  hp.connect(out(pan, 0.6));
  for (let i = 0; i < n; i++) { const at = t + i * 0.035 + Math.random() * 0.03; noise(at, 0.06).connect(env(at, gain * (1 - i / (n + 2)), 0.002, 0.05, hp)); }
}
// Detuned saws through a lowpass that opens from lo to hi between t0 and t1; ends with a cut at t1.
function saws(t0, t1, freqs, { gain = 0.12, lo = 180, hi = 1100, type = "sawtooth", detune = 7, send = 0.35, release = 0.06 } = {}) {
  const lp = filter("lowpass", lo, 3);
  lp.frequency.setValueAtTime(lo, t0);
  lp.frequency.exponentialRampToValueAtTime(hi, t1);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain * 0.55, t0 + Math.min(1, (t1 - t0) * 0.4));
  g.gain.exponentialRampToValueAtTime(gain, Math.max(t0 + 0.05, t1 - 0.02));
  g.gain.exponentialRampToValueAtTime(0.0001, t1 + release);
  lp.connect(g).connect(out(0, send));
  for (const f of freqs) for (const d of [-detune, detune]) { const o = tone(t0, t1 - t0 + release + 0.1, type, f); o.detune.value = d; o.connect(lp); }
  return { lp, g };
}
// A chord that hits at once and dies away, its filter closing from hi to lo.
function stab(t, dur, freqs, { gain = 0.2, hi = 2400, lo = 300, type = "sawtooth", detune = 8, send = 0.5 } = {}) {
  const lp = filter("lowpass", hi, 2);
  lp.frequency.setValueAtTime(hi, t); lp.frequency.exponentialRampToValueAtTime(lo, t + dur);
  lp.connect(env(t, gain, 0.025, dur, out(0, send)));
  for (const f of freqs) for (const d of [-detune, detune]) { const o = tone(t, dur + 0.1, type, f); o.detune.value = d; o.connect(lp); }
}
function blip(t, f, gain = 0.25, dur = 0.09, pan = 0) {
  tone(t, dur, "square", f).connect(env(t, gain, 0.002, dur, out(pan, 0.15)));
}

// More building blocks, for the larger library.
const MAJOR = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const mstep = (n) => MAJOR[Math.min(n, MAJOR.length - 1)];
const CURVE = (() => { const c = new Float32Array(256); for (let i = 0; i < 256; i++) c[i] = Math.tanh(2.5 * (i / 128 - 1)); return c; })();
const rnd = (a = -0.5, b = 0.5) => a + Math.random() * (b - a);
// A gain that climbs in a straight line to peak at t1, then cuts.
function rampGain(t0, t1, peak, release = 0.05) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, Math.max(t0 + 0.02, t1 - 0.03));
  g.gain.linearRampToValueAtTime(0, t1 + release);
  return g;
}
// Calls fn(t, x) over t0..t1 (x 0..1), the gaps shrinking from `start` to `end` seconds.
function roll(t0, t1, fn, { start = 0.14, end = 0.03 } = {}) {
  for (let t = t0; t < t1 - 0.01; ) { const x = (t - t0) / (t1 - t0); fn(t, x); t += Math.max(0.01, start + (end - start) * x); }
}
function riser(t0, t1, gain = 0.4, lo = 200, hi = 6000) {
  const bp = filter("bandpass", lo, 2);
  bp.frequency.setValueAtTime(lo, t0); bp.frequency.exponentialRampToValueAtTime(hi, t1);
  noise(t0, t1 - t0 + 0.1).connect(bp).connect(rampGain(t0, t1, gain)).connect(out(0, 0.5));
}
function metal(t, f, gain = 0.3, decay = 0.8, pan = 0) {
  for (const [m, g] of [[1, 1], [2.4, 0.6], [3.9, 0.4], [5.7, 0.25], [7.3, 0.15]]) { const d = decay * (1.2 - m / 10); tone(t, d, "sine", f * m).connect(env(t, gain * g, 0.002, d, out(pan, 0.5))); }
}
function pluck(t, f, gain = 0.3, decay = 0.4, pan = 0, type = "triangle") {
  tone(t, decay, type, f).connect(filter("lowpass", f * 6)).connect(env(t, gain, 0.003, decay, out(pan, 0.3)));
}
function kick(t, gain = 0.9, pan = 0) { tone(t, 0.45, "sine", 160, 42, 0.12).connect(env(t, gain, 0.002, 0.4, out(pan, 0.1))); }
function snare(t, gain = 0.5, pan = 0) {
  noise(t, 0.2).connect(filter("bandpass", 1900, 0.8)).connect(env(t, gain, 0.002, 0.18, out(pan, 0.35)));
  tone(t, 0.15, "triangle", 220, 170, 0.05).connect(env(t, gain * 0.6, 0.002, 0.12, out(pan, 0.2)));
}
function hat(t, gain = 0.15, pan = 0, decay = 0.035) { noise(t, decay).connect(filter("highpass", 7000)).connect(env(t, gain, 0.001, decay, out(pan, 0.1))); }
function clap(t, gain = 0.5, pan = 0) {
  const bp = filter("bandpass", 1400, 1.2);
  bp.connect(out(pan, 0.5));
  [0, 0.012, 0.024].forEach((d, i) => noise(t + d, i === 2 ? 0.15 : 0.02).connect(env(t + d, gain, 0.001, i === 2 ? 0.14 : 0.015, bp)));
}
function e808(t, f = 55, gain = 0.8, decay = 1) {
  const ws = ac.createWaveShaper();
  ws.curve = CURVE;
  tone(t, decay + 0.1, "sine", f * 2, f, 0.05).connect(ws).connect(env(t, gain, 0.003, decay, out(0, 0.1)));
}
// Saws through two vowel formants: a rough "aah".
function voices(freqs, t, dur, dest) {
  const mix = ac.createGain();
  for (const f of freqs) for (const d of [-9, 9]) { const o = tone(t, dur + 0.1, "sawtooth", f); o.detune.value = d; o.connect(mix); }
  for (const [f, q, g] of [[800, 5, 3], [1150, 6, 2]]) { const b = filter("bandpass", f, q), m = ac.createGain(); m.gain.value = g; mix.connect(b).connect(m).connect(dest); }
}
function choir(t0, t1, freqs, gain = 0.12) { const g = rampGain(t0, t1, gain, 0.15); g.connect(out(0, 0.8)); voices(freqs, t0, t1 - t0 + 0.2, g); }
function choirStab(t, dur, freqs, gain = 0.2) { voices(freqs, t, dur, env(t, gain, 0.05, dur, out(0, 0.8))); }
function fm(t, dur, fc, fmod, index, gain = 0.2, pan = 0) {
  const m = tone(t, dur, "sine", fmod), mg = ac.createGain();
  mg.gain.value = index;
  const c = ac.createOscillator();
  c.frequency.value = fc;
  m.connect(mg).connect(c.frequency);
  c.start(t); c.stop(t + dur + 0.05);
  c.connect(env(t, gain, 0.003, dur, out(pan, 0.4)));
}
function crowd(t0, t1, gain = 0.4) {
  const g = rampGain(t0, t1, gain, 0.6);
  g.connect(out(0, 0.5));
  for (const [f, q] of [[700, 0.6], [2200, 0.8]]) noise(t0, t1 - t0 + 0.7).connect(filter("bandpass", f, q)).connect(g);
}
function siren(t0, t1, gain = 0.12) {
  const o = ac.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(500, t0);
  for (let t = t0 + 0.45, up = true; t < t1; t += 0.45, up = !up) o.frequency.linearRampToValueAtTime(up ? 900 : 500, t);
  o.start(t0); o.stop(t1 + 0.1);
  o.connect(filter("lowpass", 2500)).connect(rampGain(t0, t1, gain)).connect(out(0, 0.4));
}
function airhorn(t, dur = 0.6, gain = 0.3) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.setValueAtTime(gain, t + dur - 0.06); g.gain.linearRampToValueAtTime(0, t + dur);
  const lp = filter("lowpass", 3500);
  lp.connect(g).connect(out(0, 0.4));
  for (const f of [415, 523, 622]) tone(t, dur, "sawtooth", f * 0.94, f, 0.06).connect(lp);
}
function wood(t, f = 900, gain = 0.4, pan = 0) {
  tone(t, 0.08, "sine", f).connect(env(t, gain, 0.001, 0.07, out(pan, 0.3)));
  noise(t, 0.02).connect(filter("bandpass", f * 2, 4)).connect(env(t, gain * 0.5, 0.001, 0.02, out(pan, 0.2)));
}
function marimba(t, f, gain = 0.35, pan = 0) {
  tone(t, 0.6, "sine", f).connect(env(t, gain, 0.002, 0.5, out(pan, 0.4)));
  tone(t, 0.15, "sine", f * 4).connect(env(t, gain * 0.3, 0.001, 0.1, out(pan, 0.3)));
}
function piano(t, f, gain = 0.3, pan = 0) {
  tone(t, 1.4, "triangle", f).connect(filter("lowpass", f * 5)).connect(env(t, gain, 0.003, 1.3, out(pan, 0.5)));
  tone(t, 1, "sine", f * 2).connect(env(t, gain * 0.3, 0.003, 0.8, out(pan, 0.4)));
}
function laser(t, gain = 0.25, pan = 0, f0 = 1800, f1 = 200, dur = 0.18) {
  tone(t, dur, "square", f0, f1, dur).connect(filter("lowpass", 4000)).connect(env(t, gain, 0.002, dur, out(pan, 0.3)));
}
function tick(t, gain = 0.2, pan = 0) {
  noise(t, 0.012).connect(filter("bandpass", 3500, 5)).connect(env(t, gain, 0.001, 0.01, out(pan, 0.1)));
  tone(t, 0.03, "sine", 2000).connect(env(t, gain * 0.4, 0.001, 0.02, out(pan, 0.1)));
}
function boomNoise(t, gain, dur = 1.6, from = 2500, to = 150) {
  const lp = filter("lowpass", from);
  lp.frequency.setValueAtTime(from, t); lp.frequency.exponentialRampToValueAtTime(to, t + dur);
  noise(t, dur).connect(lp).connect(env(t, gain, 0.004, dur, out(0, 0.5)));
}

// ─── The sound sets. Each: swell(t0, t1) the build-up until the VS, frame(t, dur), land(t, n, pan, gain)
// for the nth card, thud(t) a frame crashing down, hit(t, w) the VS (w: 1 a slam, .7 a lighter one,
// .5 a soft arrival).
const SETS = {
  gong: {
    swell: (t0, t1) => saws(t0, t1, [55, 82.4], { gain: 0.16 }),
    frame: (t, d) => whoosh(t, Math.max(0.4, d / 1000), 0.35, 0, 1800),
    land: (t, n, pan, g) => thump(t, note(55, step(n)), 0.75 * g, pan),
    thud: (t) => thump(t, 45, 0.9),
    hit(t, w) { whoosh(t - 0.35, 0.35, 0.45 * w, 0, 3200); if (w < 0.6) { bell(t); sub(t, 0.4, 98, 98, 1.1); } else gong(t, w); },
  },
  horn: {
    // Two horn blasts: a long low note, then up a fourth into the VS.
    swell(t0, t1) {
      const mid = t0 + (t1 - t0) * 0.55;
      saws(t0, mid, [110, 165], { gain: 0.14, lo: 300, hi: 1400, release: 0.25 });
      saws(mid + 0.05, t1, [146.8, 220], { gain: 0.17, lo: 400, hi: 2000 });
    },
    frame: (t, d) => drum(t, 70, 0.6, 0, 0.6),
    land: (t, n, pan, g) => drum(t, n % 2 ? 110 : 90, 0.8 * g, pan, 0.35, 0.45),
    thud: (t) => drum(t, 55, 1, 0, 0.7),
    hit(t, w) { drum(t, 50, 0.95 * w, 0, 1); crash(t, 0.32 * w); stab(t, 1.2, [146.8, 220, 293.6], { gain: 0.22 * w, hi: 2600, lo: 500 }); },
  },
  drums: {
    // A roll that speeds up into the VS.
    swell(t0, t1) {
      const span = t1 - t0;
      for (let x = 0; x < 1; ) { const t = t0 + x * span; drum(t, 140, 0.12 + 0.3 * x, (Math.random() - 0.5) * 0.4, 0.15, 0.6); x += 0.06 * (1 - x) + 0.012; }
    },
    frame: (t) => drum(t, 60, 0.8, 0, 0.8),
    land: (t, n, pan, g) => drum(t, n % 3 === 2 ? 75 : 60, 1 * g, pan, 0.55, 0.25),
    thud: (t) => drum(t, 48, 1, 0, 0.9),
    hit(t, w) { [0, 0.14, 0.32].forEach((d, i) => drum(t + d, 46 - i * 3, (i === 2 ? 1.3 : 0.9) * w, 0, i === 2 ? 1.2 : 0.4)); crash(t + 0.32, 0.3 * w, 1.2); },
  },
  storm: {
    swell(t0, t1) {
      const lp = filter("lowpass", 220, 1);
      lp.frequency.setValueAtTime(220, t0); lp.frequency.exponentialRampToValueAtTime(1000, t1);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.5, t0 + 0.6); g.gain.linearRampToValueAtTime(1.1, t1 - 0.03); g.gain.linearRampToValueAtTime(0, t1 + 0.05);
      noise(t0, t1 - t0 + 0.1).connect(lp).connect(g).connect(out(0, 0.4));
      sub(t0 + 0.1, 0.35, 60, 40, Math.max(0.5, t1 - t0 - 0.2));
    },
    frame: (t, d) => whoosh(t, Math.max(0.5, d / 1000), 0.4, 0, 1200),
    land: (t, n, pan, g) => { crack(t, 0.35 * g, 3, pan); thump(t, 50, 0.5 * g, pan); },
    thud: (t) => { crack(t, 0.5, 4); sub(t, 0.7, 90, 35, 0.8); },
    hit(t, w) { crack(t, 0.7 * w, 9); sub(t, 1.2 * w, 100, 28, 2); noise(t + 0.15, 2.2).connect(filter("lowpass", 300)).connect(env(t + 0.15, 0.8 * w, 0.2, 2, out(0, 0.6))); },
  },
  arcane: {
    swell: (t0, t1) => saws(t0, t1, [220, 329.6, 440], { gain: 0.07, type: "triangle", lo: 600, hi: 4000, detune: 12, send: 0.8, release: 0.3 }),
    frame(t, d) { for (let i = 0; i < 6; i++) bell(t + (i * d) / 1000 / 6, note(880, PENTA[i]), 0.25); },
    land: (t, n, pan, g) => bell(t, note(440, step(n)), 0.7 * g),
    thud: (t) => bell(t, 220, 1),
    hit(t, w) { for (let i = 0; i < 10; i++) bell(t - 0.3 + i * 0.03, note(880, PENTA[i]), 0.25 * w); bell(t, 220, 1.4 * w); bell(t, 330, 1 * w); sub(t, 0.5 * w, 110, 55, 1.4); },
  },
  braam: {
    // A rising noise riser with a tone sliding up under it.
    swell(t0, t1) {
      const hp = filter("bandpass", 200, 2);
      hp.frequency.setValueAtTime(200, t0); hp.frequency.exponentialRampToValueAtTime(6000, t1);
      noise(t0, t1 - t0).connect(hp).connect(env(t0, 0.5, t1 - t0, 0.03, out(0, 0.5)));
      tone(t0, t1 - t0, "sawtooth", 60, 240).connect(filter("lowpass", 500)).connect(env(t0, 0.12, t1 - t0, 0.03, out(0, 0.3)));
    },
    frame: (t) => sub(t, 0.6, 80, 40, 0.8),
    land: (t, n, pan, g) => { sub(t, 0.7 * g, 70, 38, 0.45); noise(t, 0.03).connect(filter("highpass", 6000)).connect(env(t, 0.3 * g, 0.001, 0.03, out(pan, 0.4))); },
    thud: (t) => sub(t, 1, 70, 30, 0.9),
    hit(t, w) { sub(t, 1.2 * w, 80, 26, 2.4); stab(t, 2.6, [55, 82.4, 110, 130.8], { gain: 0.22 * w, hi: 1600, lo: 160, detune: 15, send: 0.6 }); },
  },
  arcade: {
    swell(t0, t1) { const n = Math.max(4, Math.floor((t1 - t0) / 0.12)); for (let i = 0; i < n; i++) blip(t0 + (i * (t1 - t0)) / n, note(220, PENTA[i % 8] + 12 * Math.floor(i / 8) * 0.5), 0.06 + (0.08 * i) / n, 0.06); },
    frame: (t) => { blip(t, 330, 0.2); blip(t + 0.08, 440, 0.2); },
    land: (t, n, pan, g) => blip(t, note(440, step(n)), 0.4 * g, 0.1, pan),
    thud: (t) => blip(t, 110, 0.35, 0.2),
    hit(t, w) { [523, 659, 784].forEach((f, i) => blip(t + i * 0.08, f, 0.4 * w, 0.08)); blip(t + 0.24, 1047, 0.42 * w, 0.6); noise(t, 0.2).connect(filter("lowpass", 3000)).connect(env(t, 0.3 * w, 0.002, 0.2, out(0, 0.2))); },
  },
  soft: {
    swell: () => {},
    frame: () => {},
    land: (t, n, pan, g) => tone(t, 0.12, "sine", note(880, step(n))).connect(env(t, 0.08 * g, 0.003, 0.1, out(pan, 0.5))),
    thud: (t) => tone(t, 0.3, "sine", 110).connect(env(t, 0.3, 0.004, 0.25, out(0, 0.3))),
    hit: (t, w) => bell(t, 523, 0.7 * Math.max(w, 0.7)),
  },
};

Object.assign(SETS, {
  titan: {
    swell(t0, t1) { riser(t0, t1, 0.3, 100, 3000); saws(t0, t1, [27.5, 41.2], { gain: 0.16, lo: 80, hi: 450 }); },
    frame: (t) => sub(t, 0.7, 70, 30, 1),
    land: (t, n, pan, g) => { sub(t, 0.8 * g, 90, 32, 0.7); crash(t, 0.06 * g, 0.3); },
    thud: (t) => sub(t, 1, 80, 25, 1.2),
    hit(t, w) { sub(t, 1 * w, 90, 22, 2.6); stab(t, 2.6, [41.2, 61.7, 82.4, 98], { gain: 0.18 * w, hi: 1200, lo: 120, detune: 20 }); crash(t, 0.22 * w, 2); },
  },
  trailer: {
    swell: (t0, t1) => riser(t0, t1, 0.45),
    frame: (t, d) => whoosh(t, Math.max(0.4, d / 1000), 0.35),
    land: (t, n, pan, g) => { metal(t, 180 + (n % 3) * 40, 0.22 * g, 0.6, pan); kick(t, 0.5 * g, pan); },
    thud: (t) => metal(t, 120, 0.35, 1),
    hit(t, w) { metal(t, 90, 0.4 * w, 2.2); sub(t, 0.9 * w, 100, 28, 1.8); boomNoise(t, 0.4 * w, 1); },
  },
  choir: {
    swell: (t0, t1) => choir(t0, t1, [110, 164.8, 220], 0.14),
    frame: (t, d) => whoosh(t, Math.max(0.4, d / 1000), 0.3, 0, 1600),
    land: (t, n, pan, g) => choirStab(t, 0.5, [note(220, step(n))], 0.14 * g),
    thud: (t) => sub(t, 0.7, 80, 40, 0.8),
    hit(t, w) { choirStab(t, 2.2, [110, 164.8, 220, 261.6], 0.24 * w); sub(t, 0.7 * w, 100, 40, 1.6); },
  },
  timpani: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => drum(t, 65, 0.1 + 0.4 * x, 0, 0.25, 0.15), { start: 0.09, end: 0.04 }),
    frame: (t) => drum(t, 55, 0.7, 0, 1, 0.15),
    land: (t, n, pan, g) => drum(t, n % 2 ? 98 : 65, 0.9 * g, pan, 0.9, 0.12),
    thud: (t) => drum(t, 49, 1, 0, 1.2, 0.15),
    hit(t, w) { drum(t, 49, 1 * w, 0, 1.8, 0.2); drum(t, 73.4, 0.5 * w, 0, 1.4); crash(t, 0.3 * w, 2.2); },
  },
  orchestra: {
    swell: (t0, t1) => saws(t0, t1, [130.8, 196, 261.6, 329.6], { gain: 0.1, lo: 300, hi: 2500, detune: 10, send: 0.6 }),
    frame: (t) => drum(t, 55, 0.6, 0, 0.8),
    land: (t, n, pan, g) => pluck(t, note(261.6, mstep(n)), 0.4 * g, 0.35, pan),
    thud: (t) => drum(t, 55, 0.9, 0, 0.8),
    hit(t, w) { stab(t, 1.4, [130.8, 164.8, 196, 261.6, 329.6, 392], { gain: 0.15 * w, hi: 5000, lo: 600, detune: 12 }); drum(t, 55, 0.8 * w, 0, 1); crash(t, 0.25 * w, 1.5); },
  },
  anvil: {
    swell(t0, t1) { noise(t0, t1 - t0 + 0.1).connect(filter("highpass", 3000)).connect(rampGain(t0, t1, 0.12)).connect(out(0, 0.4)); sub(t0, 0.25, 50, 40, t1 - t0); },
    frame: (t) => metal(t, 300, 0.25, 0.6),
    land: (t, n, pan, g) => metal(t, 420 + (n % 2) * 60, 0.25 * g, 0.5, pan),
    thud: (t) => metal(t, 250, 0.4, 0.9),
    hit(t, w) { metal(t, 220, 0.45 * w, 2.5); sub(t, 0.8 * w, 110, 40, 1.2); boomNoise(t, 0.3 * w, 0.6); },
  },
  ancient: {
    swell: (t0, t1) => saws(t0, t1, [36.7, 55], { gain: 0.16, lo: 100, hi: 500, send: 0.6 }),
    frame: (t) => bell(t, 147, 0.6),
    land: (t, n, pan, g) => bell(t, note(196, step(n)), 0.6 * g),
    thud: (t) => gong(t, 0.5),
    hit(t, w) { gong(t, w); bell(t, 98, 1.3 * w); },
  },
  fire: {
    swell(t0, t1) {
      roll(t0, t1, (t, x) => crack(t, 0.06 + 0.12 * x, 1, rnd()), { start: 0.06, end: 0.02 });
      noise(t0, t1 - t0 + 0.1).connect(filter("lowpass", 500)).connect(rampGain(t0, t1, 0.5)).connect(out(0, 0.4));
    },
    frame: (t, d) => whoosh(t, Math.max(0.4, d / 1000), 0.4, 0, 1500),
    land: (t, n, pan, g) => { whoosh(t - 0.15, 0.25, 0.45 * g, pan, 1500); thump(t, 45, 0.5 * g, pan); },
    thud: (t) => { boomNoise(t, 0.4, 0.6); thump(t, 40, 0.7); },
    hit(t, w) { boomNoise(t, 0.8 * w, 1.8); sub(t, 1 * w, 80, 25, 2); crack(t, 0.4 * w, 8); },
  },
  ice: {
    swell(t0, t1) { noise(t0, t1 - t0 + 0.1).connect(filter("bandpass", 1200, 3)).connect(rampGain(t0, t1, 0.35)).connect(out(0, 0.6)); },
    frame: (t) => bell(t, 1760, 0.3),
    land: (t, n, pan, g) => { crack(t, 0.22 * g, 2, pan); bell(t, note(1320, step(n) % 12), 0.3 * g); },
    thud: (t) => crack(t, 0.4, 4),
    hit(t, w) {
      for (let i = 0; i < 14; i++) bell(t + i * 0.02, 1500 + Math.random() * 3000, 0.12 * w);
      noise(t, 0.4).connect(filter("highpass", 4000)).connect(env(t, 0.45 * w, 0.002, 0.4, out(0, 0.6)));
      sub(t, 0.6 * w, 120, 60, 1);
    },
  },
  void: {
    swell(t0, t1) {
      tone(t0, t1 - t0, "sawtooth", 50, 28).connect(filter("lowpass", 220)).connect(rampGain(t0, t1, 0.3)).connect(out(0, 0.5));
      riser(t0, t1, 0.2, 80, 1200);
    },
    frame: (t) => sub(t, 0.6, 120, 30, 0.8),
    land: (t, n, pan, g) => { tone(t, 0.5, "sawtooth", 140, 35, 0.4).connect(filter("lowpass", 400)).connect(env(t, 0.35 * g, 0.01, 0.45, out(pan, 0.4))); sub(t, 0.5 * g, 120, 35, 0.4); },
    thud: (t) => sub(t, 0.9, 100, 25, 1),
    hit(t, w) {
      tone(t - 0.5, 0.5, "sine", 30, 240, 0.5).connect(rampGain(t - 0.5, t, 0.4 * w, 0.02)).connect(out(0, 0.3));
      sub(t, 1.1 * w, 90, 20, 2.4); boomNoise(t, 0.5 * w, 1.5, 600, 80);
    },
  },
  nature: {
    swell(t0, t1) {
      tone(t0, t1 - t0, "triangle", 392, 440).connect(filter("lowpass", 1500)).connect(rampGain(t0, t1, 0.1, 0.2)).connect(out(0, 0.7));
      noise(t0, t1 - t0).connect(filter("bandpass", 800, 1.5)).connect(rampGain(t0, t1, 0.15)).connect(out(0, 0.5));
    },
    frame: (t) => wood(t, 500, 0.5),
    land: (t, n, pan, g) => wood(t, note(600, step(n)), 0.45 * g, pan),
    thud: (t) => wood(t, 300, 0.6),
    hit(t, w) { drum(t, 60, 1 * w, 0, 1.2, 0.4); wood(t, 400, 0.5 * w); marimba(t, 196, 0.5 * w); },
  },
  holy: {
    swell: (t0, t1) => choir(t0, t1, [261.6, 329.6, 392], 0.11),
    frame: (t) => bell(t, 1047, 0.4),
    land: (t, n, pan, g) => bell(t, note(523, mstep(n)), 0.5 * g),
    thud: (t) => bell(t, 262, 1),
    hit(t, w) { for (const f of [523, 659, 784, 1047]) bell(t, f, 0.7 * w); choirStab(t, 2, [261.6, 329.6, 392, 523.3], 0.18 * w); },
  },
  shadow: {
    swell: (t0, t1) => saws(t0, t1, [55, 58.3, 82.4], { gain: 0.14, lo: 150, hi: 700 }),
    frame: (t) => sub(t, 0.6, 90, 35, 0.9),
    land: (t, n, pan, g) => pluck(t, note(55, step(n)), 0.55 * g, 0.6, pan, "sawtooth"),
    thud: (t) => sub(t, 0.9, 70, 30, 1),
    hit(t, w) { e808(t, 40, 0.9 * w, 2); stab(t, 1.8, [55, 58.3, 77.8], { gain: 0.16 * w, hi: 900, lo: 100 }); },
  },
  teleport: {
    swell(t0, t1) { riser(t0, t1, 0.25, 400, 8000); tone(t0, t1 - t0, "sine", 300, 1800).connect(rampGain(t0, t1, 0.1)).connect(out(0, 0.6)); },
    frame: (t) => fm(t, 0.5, 440, 110, 300, 0.2),
    land: (t, n, pan, g) => fm(t, 0.25, note(660, step(n)), 110, 400, 0.18 * g, pan),
    thud: (t) => fm(t, 0.5, 220, 55, 300, 0.35),
    hit(t, w) {
      tone(t, 0.8, "sine", 1600, 80, 0.6).connect(env(t, 0.4 * w, 0.005, 0.75, out(0, 0.5)));
      sub(t, 0.9 * w, 140, 40, 1.4); whoosh(t, 0.6, 0.45 * w, 0, 4000);
    },
  },
  bassdrop: {
    swell(t0, t1) { riser(t0, t1, 0.3); roll(t0, t1, (t, x) => snare(t, 0.08 + 0.35 * x), { start: 0.25, end: 0.04 }); },
    frame: (t) => kick(t, 0.8),
    land: (t, n, pan, g) => kick(t, 0.9 * g, pan),
    thud: (t) => kick(t, 1),
    hit(t, w) {
      e808(t, 41.2, 0.8 * w, 2.2);
      const lp = filter("lowpass", 200, 6);
      lp.frequency.setValueAtTime(200, t);
      for (let i = 1; i < 16; i++) lp.frequency.linearRampToValueAtTime(i % 2 ? 1400 : 200, t + i * 0.125);
      lp.connect(env(t, 0.22 * w, 0.01, 2, out(0, 0.2)));
      for (const d of [-12, 12]) { const o = tone(t, 2.1, "sawtooth", 41.2); o.detune.value = d; o.connect(lp); }
    },
  },
  synthwave: {
    swell(t0, t1) { const ch = [220, 261.6, 329.6, 440]; let i = 0; roll(t0, t1, (t, x) => pluck(t, ch[i++ % 4], 0.08 + 0.15 * x, 0.2, 0, "sawtooth"), { start: 0.125, end: 0.125 }); },
    frame: (t) => kick(t, 0.7),
    land: (t, n, pan, g) => snare(t, 0.5 * g, pan),
    thud: (t) => kick(t, 1),
    hit(t, w) { stab(t, 2, [110, 220, 261.6, 329.6, 392], { gain: 0.16 * w, hi: 3000, lo: 400, detune: 14, send: 0.8 }); kick(t, 0.9 * w); snare(t, 0.5 * w); },
  },
  laser: {
    swell: (t0, t1) => tone(t0, t1 - t0, "square", 100, 1200).connect(filter("lowpass", 2000)).connect(rampGain(t0, t1, 0.07)).connect(out(0, 0.3)),
    frame: (t) => laser(t, 0.25, 0, 1200, 300, 0.3),
    land: (t, n, pan, g) => laser(t, 0.28 * g, pan, 1800 - n * 60, 180),
    thud: (t) => laser(t, 0.35, 0, 600, 60, 0.4),
    hit(t, w) { laser(t, 0.35 * w, 0, 3000, 40, 0.8); boomNoise(t, 0.45 * w, 0.8, 1500); sub(t, 0.8 * w, 110, 35, 1.2); },
  },
  glitch: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => blip(t, 200 + Math.random() * 1800, 0.05 + 0.12 * x, 0.03, rnd(-0.7, 0.7)), { start: 0.07, end: 0.025 }),
    frame: (t) => { for (let k = 0; k < 4; k++) blip(t + k * 0.04, 300 + k * 200, 0.15, 0.03); },
    land: (t, n, pan, g) => { for (let k = 0; k < 3; k++) blip(t + k * 0.03, note(330, step(n)) * (k % 2 ? 2 : 1), 0.22 * g, 0.025, pan); },
    thud: (t) => blip(t, 80, 0.35, 0.2),
    hit(t, w) { for (let i = 0; i < 8; i++) { kick(t + i * 0.045, 0.45 * w); hat(t + i * 0.045, 0.2 * w); } sub(t + 0.36, 0.9 * w, 100, 30, 1.4); },
  },
  trap: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => hat(t, 0.1 + 0.1 * x, (x - 0.5) * 0.6), { start: 0.12, end: 0.03 }),
    frame: (t) => clap(t, 0.4),
    land: (t, n, pan, g) => { e808(t, note(41.2, step(n) % 12), 0.6 * g, 0.5); hat(t, 0.15 * g, pan); },
    thud: (t) => e808(t, 36.7, 0.8, 0.8),
    hit(t, w) { e808(t, 36.7, 0.9 * w, 2.5); clap(t, 0.55 * w); hat(t, 0.2 * w); },
  },
  techno: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => { kick(t, 0.3 + 0.4 * x); hat(t + 0.2, 0.08 + 0.1 * x); }, { start: 0.4, end: 0.4 }),
    frame: (t) => clap(t, 0.35),
    land: (t, n, pan, g) => clap(t, 0.4 * g, pan),
    thud: (t) => kick(t, 1),
    hit(t, w) { kick(t, 1 * w); crash(t, 0.3 * w, 1.8); stab(t, 1, [110, 130.8, 164.8], { gain: 0.15 * w, hi: 2500, lo: 300 }); },
  },
  scifi: {
    swell(t0, t1) { let i = 0; roll(t0, t1, (t, x) => tone(t, 0.06, "sine", i++ % 2 ? 1600 : 1200).connect(env(t, 0.04 + 0.08 * x, 0.002, 0.05, out(0, 0.3))), { start: 0.2, end: 0.08 }); },
    frame: (t) => fm(t, 0.4, 660, 220, 200, 0.15),
    land: (t, n, pan, g) => fm(t, 0.15, note(880, step(n)), 440, 200, 0.18 * g, pan),
    thud: (t) => fm(t, 0.4, 110, 55, 200, 0.35),
    hit(t, w) { [262, 330, 392, 523].forEach((f, i) => fm(t + i * 0.07, 0.9, f, f * 2, 150, 0.15 * w)); sub(t, 0.7 * w, 120, 40, 1.2); },
  },
  stadium: {
    swell: (t0, t1) => crowd(t0, t1, 0.45),
    frame: (t) => drum(t, 55, 0.7, 0, 0.4, 0.6),
    land: (t, n, pan, g) => (n % 3 === 2 ? clap(t, 0.55 * g, pan) : drum(t, 55, 0.9 * g, pan, 0.4, 0.6)),
    thud: (t) => drum(t, 45, 1, 0, 0.6),
    hit(t, w) { airhorn(t, 1.1, 0.26 * w); noise(t, 2.5).connect(filter("bandpass", 1000, 0.6)).connect(env(t, 0.4 * w, 0.1, 2.3, out(0, 0.5))); },
  },
  boxing: {
    swell: (t0, t1) => crowd(t0, t1, 0.3),
    frame: (t) => metal(t, 880, 0.15, 0.8),
    land: (t, n, pan, g) => { noise(t, 0.08).connect(filter("lowpass", 800)).connect(env(t, 0.6 * g, 0.002, 0.07, out(pan, 0.2))); sub(t, 0.6 * g, 120, 50, 0.25); },
    thud: (t) => sub(t, 0.9, 110, 40, 0.5),
    hit(t, w) { metal(t, 880, 0.25 * w, 1.4); metal(t + 0.35, 880, 0.25 * w, 1.6); noise(t, 2).connect(filter("bandpass", 1000, 0.6)).connect(env(t, 0.3 * w, 0.1, 1.8, out(0, 0.5))); },
  },
  countdown: {
    swell: (t0, t1) => roll(t0, t1, (t) => tick(t, 0.25), { start: 0.5, end: 0.5 }),
    frame: (t) => tick(t, 0.3),
    land: (t, n, pan, g) => { tick(t, 0.35 * g, pan); tone(t, 0.08, "sine", note(880, step(n))).connect(env(t, 0.1 * g, 0.002, 0.07, out(pan, 0.2))); },
    thud: (t) => wood(t, 300, 0.5),
    hit(t, w) { const lp = filter("lowpass", 1500); lp.connect(env(t, 0.35 * w, 0.005, 0.9, out(0, 0.3))); for (const f of [110, 116]) tone(t, 0.95, "sawtooth", f).connect(lp); sub(t, 0.6 * w, 90, 40, 0.8); },
  },
  airhorn: {
    swell(t0, t1) { riser(t0, t1, 0.22); roll(t0, t1, (t, x) => snare(t, 0.08 + 0.3 * x), { start: 0.2, end: 0.05 }); },
    frame: (t) => kick(t, 0.7),
    land: (t, n, pan, g) => snare(t, 0.45 * g, pan),
    thud: (t) => kick(t, 1),
    hit(t, w) { airhorn(t, 0.3, 0.26 * w); airhorn(t + 0.38, 0.3, 0.26 * w); airhorn(t + 0.76, 1, 0.28 * w); kick(t, 0.9 * w); },
  },
  alarm: {
    swell: (t0, t1) => siren(t0, t1, 0.11),
    frame: (t) => blip(t, 660, 0.2, 0.15),
    land: (t, n, pan, g) => blip(t, 880, 0.2 * g, 0.12, pan),
    thud: (t) => blip(t, 220, 0.3, 0.3),
    hit(t, w) { airhorn(t, 1, 0.26 * w); drum(t, 50, 0.9 * w, 0, 1); },
  },
  heartbeat: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => { sub(t, 0.25 + 0.4 * x, 60, 40, 0.18); sub(t + 0.18, 0.18 + 0.3 * x, 55, 40, 0.18); }, { start: 0.9, end: 0.45 }),
    frame: (t) => sub(t, 0.5, 60, 40, 0.3),
    land: (t, n, pan, g) => sub(t, 0.7 * g, 70, 40, 0.25),
    thud: (t) => sub(t, 0.9, 60, 35, 0.4),
    hit(t, w) { sub(t, 1 * w, 70, 30, 1.4); sub(t + 0.22, 0.8 * w, 60, 30, 1.2); },
  },
  marimba: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => marimba(t, note(196, PENTA[Math.floor(x * 8)]), 0.08 + 0.15 * x), { start: 0.2, end: 0.1 }),
    frame: (t) => marimba(t, 392, 0.3),
    land: (t, n, pan, g) => marimba(t, note(392, step(n)), 0.4 * g, pan),
    thud: (t) => marimba(t, 98, 0.6),
    hit(t, w) { for (const f of [196, 247, 294, 392]) marimba(t, f, 0.35 * w); marimba(t + 0.12, 784, 0.3 * w); },
  },
  piano: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => piano(t, x < 0.5 ? 65.4 : 98, 0.15 + 0.15 * x), { start: 0.8, end: 0.5 }),
    frame: (t) => piano(t, 130.8, 0.25),
    land: (t, n, pan, g) => piano(t, note(261.6, mstep(n)), 0.3 * g, pan),
    thud: (t) => piano(t, 65.4, 0.5),
    hit(t, w) { for (const f of [130.8, 196, 261.6, 329.6, 392]) piano(t, f, 0.28 * w); },
  },
  coins: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => blip(t, 2000 + Math.random() * 1500, 0.03 + 0.05 * x, 0.04, rnd()), { start: 0.25, end: 0.1 }),
    frame: (t) => blip(t, 1319, 0.15, 0.2),
    land: (t, n, pan, g) => { blip(t, 988, 0.2 * g, 0.06, pan); blip(t + 0.07, 1319, 0.2 * g, 0.25, pan); },
    thud: (t) => blip(t, 220, 0.3, 0.2),
    hit(t, w) { [1319, 1568, 2093].forEach((f, i) => blip(t + i * 0.06, f, 0.22 * w, 0.3)); bell(t, 1047, 0.6 * w); },
  },
  typewriter: {
    swell: (t0, t1) => roll(t0, t1, (t, x) => tick(t, 0.1 + 0.15 * x, rnd()), { start: 0.12, end: 0.06 }),
    frame: (t) => wood(t, 250, 0.4),
    land: (t, n, pan, g) => { tick(t, 0.4 * g, pan); wood(t, 1400, 0.15 * g, pan); },
    thud: (t) => wood(t, 200, 0.5),
    hit(t, w) { bell(t, 1760, 0.7 * w); wood(t, 300, 0.4 * w); },
  },
  whoosh: {
    swell: () => {},
    frame: (t, d) => whoosh(t, Math.max(0.4, d / 1000), 0.3),
    land: (t, n, pan, g) => whoosh(t - 0.25, 0.3, 0.4 * g, pan, 3000),
    thud: (t) => sub(t, 0.6, 90, 35, 0.5),
    hit(t, w) { whoosh(t - 0.4, 0.45, 0.55 * w, 0, 3500); sub(t, 0.9 * w, 100, 35, 1); },
  },
});

// No intro sound (music only).
SETS.none = { swell() {}, frame() {}, land() {}, thud() {}, hit() {} };

// ─── Music tracks. Each: bpm, level, and play(s, bar, t, step), called for every 16th note (s 0..15 in
// bar `bar`, at time t, `step` seconds long). Chords are [root, [chord tones]] per bar.
function pad(t, dur, freqs, gain = 0.07, type = "triangle", hi = 1500) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
  const lp = filter("lowpass", hi);
  lp.connect(g).connect(out(rnd(-0.2, 0.2), 0.8));
  for (const f of freqs) for (const d of [-6, 6]) { const o = tone(t, dur, type, f); o.detune.value = d; o.connect(lp); }
}
function bass(t, f, gain = 0.3, dur = 0.25, type = "sawtooth") {
  tone(t, dur, type, f).connect(filter("lowpass", 600)).connect(env(t, gain, 0.005, dur, out(0, 0.05)));
}
const AM_F_C_G = [[110, [220, 261.6, 329.6]], [87.3, [174.6, 220, 261.6]], [130.8, [261.6, 329.6, 392]], [98, [196, 246.9, 293.7]]];
const TRACKS = {
  march: { bpm: 84, level: 0.5, play(s, bar, t, st) {
    const root = [55, 55, 49, 41.2][bar % 4];
    if (s === 0) stab(t, st * 16, [root * 2, root * 3], { gain: 0.07, hi: 700, lo: 250, detune: 10, send: 0.6 });
    if (s === 0 || s === 6 || s === 8) drum(t, 60, s === 0 ? 0.8 : 0.6, rnd(-0.2, 0.2), 0.6, 0.35);
    if (s === 12 || s === 14) drum(t, 95, 0.35, rnd(-0.4, 0.4), 0.3, 0.5);
    if (s % 4 === 2) hat(t, 0.05);
  } },
  ambient: { bpm: 60, level: 1.4, play(s, bar, t, st) {
    const [root, ch] = AM_F_C_G[bar % 4];
    if (s === 0) { pad(t, st * 18, ch, 0.06); tone(t, st * 16, "sine", root / 2).connect(env(t, 0.12, 0.8, st * 15, out(0, 0.3))); }
    if (s % 4 === 0 && Math.random() < 0.35) bell(t, note(880, PENTA[Math.floor(Math.random() * 6)]), 0.12);
  } },
  synthwave: { bpm: 100, level: 0.45, play(s, bar, t, st) {
    const [root, ch] = AM_F_C_G[bar % 4];
    if (s % 4 === 0) kick(t, 0.7);
    if (s === 4 || s === 12) snare(t, 0.35);
    if (s % 2 === 1) hat(t, 0.06, 0.3);
    if (s % 2 === 0) bass(t, s % 4 === 2 ? root * 2 : root, 0.25, st * 1.6);
    if (s === 0) pad(t, st * 16, ch, 0.05, "sawtooth", 1800);
  } },
  lofi: { bpm: 78, level: 0.55, play(s, bar, t, st) {
    const ch = [[174.6, 220, 261.6, 329.6], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 261.6], [130.8, 164.8, 196, 246.9]][bar % 4];
    if (s === 0 || s === 10) kick(t, s ? 0.45 : 0.6);
    if (s === 4 || s === 12) snare(t, 0.22);
    if (s % 2 === 0) hat(t, 0.035, 0.2, 0.05);
    if (s === 0 || s === 7) ch.forEach((f, i) => piano(t + i * 0.012, f, s ? 0.07 : 0.1));
    if (s === 0) tone(t, st * 14, "sine", ch[0] / 2).connect(env(t, 0.25, 0.02, st * 13, out(0, 0.1)));
  } },
  pulse: { bpm: 120, level: 0.6, play(s, bar, t, st) {
    const root = [82.4, 65.4, 98, 73.4][bar % 4];
    if (s % 4 === 0) kick(t, 0.6);
    if (s % 4 === 2) bass(t, root, 0.3, st * 1.5);
    if (s % 2 === 1) hat(t, 0.05, -0.2);
    if (s === 4 || s === 12) clap(t, 0.22);
    if (bar % 4 === 3 && s >= 12) snare(t, 0.08 + (s - 12) * 0.04);
  } },
  mystic: { bpm: 90, level: 1.0, play(s, bar, t, st) {
    if (s === 0 && bar % 2 === 0) pad(t, st * 34, [55, 82.4], 0.08, "sawtooth", 500);
    if (s % 2 === 0) marimba(t, note(220, PENTA[(s / 2 + bar * 3) % 8]), 0.16, rnd(-0.6, 0.6));
    if (s === 8 && Math.random() < 0.5) bell(t, 659, 0.15);
  } },
};
// Plays a track on a loop from time t, fading in, until the next run (or stop()). Notes are scheduled
// up to a second ahead, so a slow timer doesn't make it stutter.
function startMusic(id, t) {
  clearInterval(musicTimer);
  const tr = TRACKS[id];
  if (!tr) return;
  const mDry = ac.createGain(), mWet = ac.createGain();
  const [bd, bw] = bedOut();
  mDry.connect(bd); mWet.connect(bw);
  for (const g of [mDry, mWet]) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(tr.level, t + 2.5); }
  const st = 60 / tr.bpm / 4;
  let i = 0, next = t;
  const tick = () => {
    const keep = [dry, wet];
    [dry, wet] = [mDry, mWet];
    while (next < ac.currentTime + 1) { tr.play(i % 16, Math.floor(i / 16), next, st); i++; next += st; }
    [dry, wet] = keep;
  };
  tick();
  musicTimer = setInterval(tick, 250);
}

// When the VS lands after it starts (ms) and how hard, for each VS look (parts/stream-vs.js VS).
const VS_HIT = {
  jump: [320, 1], deal: [150, 0.5], meteor: [260, 1], warp: [315, 0.7], spotlight: [140, 0.5], glitch: [600, 0.7], rise: [700, 0.5],
  domino: [330, 1], thunder: [0, 1], inferno: [450, 0.7], camera: [0, 0.7], orbit: [360, 0.7], blade: [150, 1], retro: [0, 0.5],
  curtain: [150, 0.5], beat: [40, 0.7], draft: [300, 1], teleport: [0, 0.7], ancient: [300, 1],
};

// When the VS of look `look`, arriving at `ms`, actually lands (ms).
export const vsHitAt = (look, ms) => ms + (VS_HIT[look] ?? [0])[0];

// One run of the intro's sound in set `id`, or null without Web Audio. Call frame(ms) at the start,
// land(side, ms) as each card lands, thud(ms) for a frame crashing down, vs(look, ms) when the VS comes,
// and done() after them to lay the build-up underneath. `blocked`: the browser won't play sound until
// the page is clicked (a normal tab; OBS plays it straight away). Starting a run fades out the last one.
export function vsSound(id = "gong", { keep = false } = {}) {
  if (!window.AudioContext) return null;
  if (!ac) setup();
  ac.resume().catch(() => {});
  const set = SETS[id ?? "none"] ?? SETS.gong, now = ac.currentTime;
  const keeping = keep && bed && musicPlaying();
  if (!keeping) {
    clearInterval(musicTimer); musicTimer = null;
    if (bed) { const old = bed; fade(old, now); setTimeout(() => old.forEach((g) => g.disconnect()), 400); bed = null; }
  }
  if (dry) for (const g of [dry, wet]) { g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + 0.15); setTimeout(() => g.disconnect(), 400); }
  dry = ac.createGain(); dry.connect(master);
  wet = ac.createGain(); wet.connect(verb);
  // The picture starts on the next frame (~16 ms); the sound reaches the speakers outputLatency after
  // its scheduled time. Start the sound's clock that much earlier so hits land with the picture
  // (anything due before now plays straight away).
  const lag = (ac.outputLatency || ac.baseLatency || 0) - 0.016, t0 = now - lag, at = (ms) => Math.max(now + 0.01, t0 + ms / 1000);
  let n = 0, last = -1, hit = null;
  const mine = [dry, wet];
  return {
    blocked: ac.state !== "running",
    frame(ms) { set.frame(at(0), ms); },
    thud(ms) { set.thud(at(ms)); },
    land(side, ms) {
      const near = Math.abs(ms - last) < 45; // cards landing together: one full hit, not a pile
      last = ms;
      set.land(at(ms), n++, side === "a" ? -0.4 : 0.4, near ? 0.4 : 1);
    },
    vs(look, ms) { const [off, w] = VS_HIT[look] ?? [0, 0.7]; hit = at(ms + off); set.hit(hit, w); },
    done() {
      if (hit && hit - at(0) > 0.6) set.swell(at(0), hit);
      // A replay over running music: dip the music while the intro plays, back up after the VS.
      if (keeping && id) { fade(bed, at(0), 0.35, 0.4); const back = (hit ?? at(0)) + 0.8; for (const g of bed) g.gain.linearRampToValueAtTime(0.35, back); for (const g of bed) g.gain.linearRampToValueAtTime(1, back + 1.5); }
    },
    // True when this run is a replay that kept the music from before (so don't start it again).
    kept: !!keeping,
    // A decoded file (loadFile), at `when` (FILE_AT); sync: the second of the file to put on the VS.
    file(buf, when = "intro", sync = 0) {
      if (!buf) return;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const g = ac.createGain();
      if (when === "after") { const [bd, bw] = bedOut(); const send = ac.createGain(); send.gain.value = 0.1; src.connect(g); g.connect(bd); g.connect(send).connect(bw); afterFile = src; }
      else src.connect(g).connect(out(0, 0.1));
      const start = at(0), now2 = ac.currentTime + 0.01;
      if (when === "after") {
        const t = hit ? hit + 0.6 : start;
        src.loop = true;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8, t + 2);
        src.start(t);
      } else if (when === "vs" && hit) {
        const t = hit - sync; // before now: start part way in
        if (t >= now2) src.start(t); else if (now2 - t < buf.duration) src.start(now2, now2 - t);
      } else src.start(start);
    },
    // A music track (VS_MUSIC) on a loop from just after the VS hits (or `ms` in, with no VS).
    music(track, ms = 0) { startMusic(track, hit ? hit + 0.6 : at(ms)); },
    stop() { clearInterval(musicTimer); musicTimer = null; const t = ac.currentTime; fade(mine, t); if (bed) { fade(bed, t); bed = null; } afterFile = null; },
  };
}

// Music still going from an earlier run: a track's scheduler, or an "after" file on its loop.
let afterFile = null;
const musicPlaying = () => !!musicTimer || !!afterFile;

// The kit's sample of a set: a frame, ten cards landing side to side, and a slam, about 4 seconds.
export function playSample(id) {
  const s = vsSound(id);
  if (!s) return null;
  s.frame(900);
  for (let i = 0; i < 10; i++) s.land(i % 2 ? "b" : "a", 1000 + i * 170);
  s.vs("jump", 2900);
  s.done();
  return s;
}

// The kit's sample of a track: it plays straight away until stopped.
export function playMusicSample(track) {
  const s = vsSound(null);
  s?.music(track, 0);
  return s;
}
