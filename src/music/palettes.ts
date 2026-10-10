/**
 * Theme palettes as data: tempo, key, mode, chord progression and one instrument per musical role.
 * Pure TypeScript (no Phaser, Tone or DOM); the Tone engine builds the actual synths from this data.
 *
 * `InstrumentSpec.options` are plain objects shaped for the Tone v15 constructor of `kind`
 * (option names checked against node_modules/tone/build/esm/instrument/*.d.ts):
 * - "synth"    → new Synth(options), one voice
 * - "poly"     → new PolySynth(Synth, options): options are the Synth voice options, maxPolyphony = maxVoices
 * - "mono"     → new MonoSynth(options); filter and filterEnvelope are always set explicitly
 * - "fm" / "am" → new FMSynth(options) / new AMSynth(options)
 * - "membrane" → new MembraneSynth(options); "metal" → new MetalSynth(options) (pitched by the note)
 * - "noise"    → new NoiseSynth(options), unpitched
 * - "pluck"    → new PluckSynth(options)
 * Monophonic kinds (synth, mono, fm, am, membrane, metal) with maxVoices > 1 are meant to be wrapped
 * as PolySynth(voice, options). NoiseSynth and PluckSynth are not Monophonic, so a role of those
 * kinds needs a round-robin pool of `maxVoices` instances.
 * `volume` (dB) lives outside `options`. `reverb` / `delay` are send levels 0..1.
 */
import { noteToMidi } from "./theory";
import type { HeptatonicMode } from "./theory";

export type Role =
  | "lead"
  | "bass"
  | "pad"
  | "stab"
  | "arp"
  | "melody"
  | "bell"
  | "kick"
  | "snare"
  | "hat"
  | "perc"
  | "metal"
  | "boss"
  | "heart"
  | "drone";

export const ROLES: readonly Role[] = Object.freeze([
  "lead",
  "bass",
  "pad",
  "stab",
  "arp",
  "melody",
  "bell",
  "kick",
  "snare",
  "hat",
  "perc",
  "metal",
  "boss",
  "heart",
  "drone",
] as Role[]);

export type InstrumentKind = "synth" | "poly" | "mono" | "fm" | "am" | "membrane" | "metal" | "noise" | "pluck";

export interface InstrumentSpec {
  kind: InstrumentKind;
  options: Record<string, unknown>;
  /** Decibels. */
  volume: number;
  /** [lowNote, highNote] as note names, e.g. ["E1", "E3"]. Omitted for unpitched roles. */
  register?: [string, string];
  maxVoices: number;
  reverb?: number;
  delay?: number;
}

export interface Palette {
  /** Lowercase theme name: saves store it as themeId and unlocks as "theme_<id>". */
  id: string;
  name: string;
  bpm: number;
  /** Tonic note name, e.g. "E", "Bb". */
  key: string;
  mode: HeptatonicMode;
  /** Roman-numeral progression for Harmony, one chord per bar unless ":BARS" is given. */
  progression: string;
  instruments: Record<Role, InstrumentSpec>;
}

/** Whether the role takes a pitch (everything except NoiseSynth). */
export function isPitched(spec: InstrumentSpec): boolean {
  return spec.kind !== "noise";
}

/** The register as MIDI numbers, or null if the spec has none. Throws on invalid note names. */
export function registerMidi(spec: InstrumentSpec): [number, number] | null {
  if (!spec.register) return null;
  return [noteToMidi(spec.register[0]), noteToMidi(spec.register[1])];
}

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------

type Options = Record<string, unknown>;
type Register = [string, string];
interface Sends {
  reverb?: number;
  delay?: number;
}

const BASS: Register = ["E1", "E3"];
const PAD: Register = ["C3", "C5"];
const MID: Register = ["C4", "C6"];
const HIGH: Register = ["C5", "C7"];
const LOW: Register = ["C2", "C4"];
const KICK: Register = ["C1", "C2"];
const HEART: Register = ["A1", "A2"];

function env(attack: number, decay: number, sustain: number, release: number): Options {
  return { attack, decay, sustain, release };
}

function inst(
  kind: InstrumentKind,
  options: Options,
  volume: number,
  maxVoices: number,
  register?: Register,
  sends: Sends = {},
): InstrumentSpec {
  const spec: InstrumentSpec = { kind, options, volume, maxVoices };
  if (register) spec.register = [register[0], register[1]];
  if (sends.reverb !== undefined) spec.reverb = sends.reverb;
  if (sends.delay !== undefined) spec.delay = sends.delay;
  return spec;
}

function poly(oscillator: Options, envelope: Options, volume: number, register: Register, maxVoices = 4, sends?: Sends) {
  return inst("poly", { oscillator, envelope }, volume, maxVoices, register, sends);
}

interface ModSpec {
  harmonicity: number;
  envelope: Options;
  modulationEnvelope: Options;
  oscillator?: string;
  modulation?: string;
}

function fm(o: ModSpec & { modulationIndex: number }, volume: number, register: Register, maxVoices = 4, sends?: Sends) {
  const options = {
    harmonicity: o.harmonicity,
    modulationIndex: o.modulationIndex,
    oscillator: { type: o.oscillator ?? "sine" },
    modulation: { type: o.modulation ?? "sine" },
    envelope: o.envelope,
    modulationEnvelope: o.modulationEnvelope,
  };
  return inst("fm", options, volume, maxVoices, register, sends);
}

function am(o: ModSpec, volume: number, register: Register, maxVoices = 4, sends?: Sends) {
  const options = {
    harmonicity: o.harmonicity,
    oscillator: { type: o.oscillator ?? "sine" },
    modulation: { type: o.modulation ?? "sine" },
    envelope: o.envelope,
    modulationEnvelope: o.modulationEnvelope,
  };
  return inst("am", options, volume, maxVoices, register, sends);
}

/** MonoSynth with an explicit lowpass and filter envelope (its defaults muffle short notes). */
function mono(
  oscillator: string,
  filter: { frequency: number; rolloff: number; Q: number },
  filterEnvelope: Options,
  envelope: Options,
  volume: number,
  register: Register,
  maxVoices = 2,
) {
  const options = { oscillator: { type: oscillator }, filter: { type: "lowpass", ...filter }, filterEnvelope, envelope };
  return inst("mono", options, volume, maxVoices, register);
}

/** Inharmonic FM bell: a fast-decaying modulation envelope makes the strike bright, the tail pure. */
function fmBell(harmonicity: number, modulationIndex: number, decay: number, volume: number) {
  const envelope = env(0.001, decay, 0, decay);
  const modulationEnvelope = env(0.001, decay * 0.35, 0.1, decay * 0.6);
  return fm({ harmonicity, modulationIndex, envelope, modulationEnvelope }, volume, HIGH, 4, { reverb: 0.5 });
}

function kick(volume = -10, octaves = 5, decay = 0.32) {
  const options = { pitchDecay: 0.05, octaves, oscillator: { type: "sine" }, envelope: env(0.001, decay, 0, 0.1) };
  return inst("membrane", options, volume, 1, KICK);
}

/** Soft, low membrane thump: slower attack and a much smaller pitch sweep than the kick. */
function heart(volume = -14, decay = 0.26) {
  const options = { pitchDecay: 0.08, octaves: 1.5, oscillator: { type: "sine" }, envelope: env(0.008, decay, 0, 0.15) };
  return inst("membrane", options, volume, 2, HEART);
}

function noise(type: "white" | "pink" | "brown", decay: number, volume: number, attack = 0.001) {
  return inst("noise", { noise: { type }, envelope: env(attack, decay, 0, decay * 0.4) }, volume, 2);
}

function metal(
  o: { harmonicity: number; modulationIndex: number; octaves: number; resonance: number; decay: number },
  volume: number,
  register: Register,
) {
  const options = {
    harmonicity: o.harmonicity,
    modulationIndex: o.modulationIndex,
    octaves: o.octaves,
    resonance: o.resonance,
    envelope: env(0.001, o.decay, 0, o.decay * 0.5),
  };
  return inst("metal", options, volume, 2, register);
}

/** Short pitched tick. */
function tick(type: string, decay: number, volume: number) {
  return poly({ type }, env(0.001, decay, 0, 0.03), volume, HIGH, 4);
}

/** Pitched woodblock: a membrane with a tiny pitch drop. */
function woodblock(volume: number) {
  const options = { pitchDecay: 0.01, octaves: 0.6, oscillator: { type: "sine" }, envelope: env(0.001, 0.06, 0, 0.03) };
  return inst("membrane", options, volume, 4, HIGH);
}

/** Soft sustained pad for the real-time drone (root, fifth, octave). */
function drone(oscillator: Options, volume: number) {
  return poly(oscillator, env(1.5, 0.5, 0.9, 2.5), volume, PAD, 3, { reverb: 0.6 });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

// ---------------------------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------------------------

const theremin: Palette = {
  id: "theremin",
  name: "Theremin",
  bpm: 100,
  key: "E",
  mode: "aeolian",
  // Old chords Em, Am/C, D, Am over the bass line E C D A; the bass line wins, so bar 2 is VI.
  progression: "i VI VII iv",
  instruments: {
    // Sine carrier, sub-audio sine modulator (≈ 4–8 Hz around C4–C5): a vibrato that fades in.
    lead: fm(
      { harmonicity: 0.0145, modulationIndex: 0.04, envelope: env(0.05, 0.3, 0.5, 1), modulationEnvelope: env(0.35, 0, 1, 0.8) },
      -6,
      MID,
      4,
      { reverb: 0.45, delay: 0.25 },
    ),
    bass: mono("triangle", { frequency: 1200, rolloff: -12, Q: 1 }, { ...env(0.005, 0.3, 0.4, 0.4), baseFrequency: 180, octaves: 3 }, env(0.02, 0.4, 0.15, 0.5), -12, BASS),
    pad: poly({ type: "fatsine", spread: 20, count: 3 }, env(0.25, 0.4, 0.6, 1.5), -18, PAD, 6, { reverb: 0.5 }),
    stab: am({ harmonicity: 2, modulation: "square", envelope: env(0.005, 0.18, 0, 0.12), modulationEnvelope: env(0.005, 0.2, 0.3, 0.1) }, -8, MID),
    arp: poly({ type: "triangle" }, env(0.004, 0.14, 0.1, 0.2), -14, MID, 4, { delay: 0.3 }),
    melody: poly({ type: "fattriangle", spread: 12, count: 2 }, env(0.03, 0.3, 0.4, 0.6), -16, MID, 4, { reverb: 0.3 }),
    bell: fmBell(3.5, 14, 1.4, -12),
    kick: kick(-10),
    snare: noise("pink", 0.14, -20),
    hat: noise("white", 0.035, -26),
    perc: tick("sine", 0.05, -14),
    metal: metal({ harmonicity: 5.1, modulationIndex: 20, octaves: 1.2, resonance: 3200, decay: 0.4 }, -24, MID),
    boss: fm({ harmonicity: 0.5, modulationIndex: 8, modulation: "triangle", envelope: env(0.02, 0.5, 0.4, 0.6), modulationEnvelope: env(0.02, 0.4, 0.5, 0.5) }, -10, LOW),
    heart: heart(),
    drone: drone({ type: "fatsine", spread: 18, count: 3 }, -24),
  },
};

const guitar: Palette = {
  id: "guitar",
  name: "Guitar",
  bpm: 110,
  key: "A",
  mode: "aeolian",
  // Old power chords A5 C5 D5 E5.
  progression: "i III iv v",
  instruments: {
    lead: inst("pluck", { attackNoise: 1.2, dampening: 4200, resonance: 0.92, release: 0.8 }, -6, 4, MID, { reverb: 0.25, delay: 0.2 }),
    bass: mono("triangle", { frequency: 900, rolloff: -24, Q: 1 }, { ...env(0.003, 0.2, 0.25, 0.3), baseFrequency: 140, octaves: 3.2 }, env(0.008, 0.3, 0.2, 0.4), -12, BASS),
    pad: poly({ type: "triangle" }, env(0.3, 0.3, 0.5, 1.2), -18, PAD, 6, { reverb: 0.4 }),
    // Muted strum chunk.
    stab: fm({ harmonicity: 1, modulationIndex: 6, oscillator: "triangle", envelope: env(0.003, 0.2, 0, 0.1), modulationEnvelope: env(0.003, 0.15, 0, 0.1) }, -8, MID),
    arp: poly({ type: "fmtriangle", modulationType: "sine", harmonicity: 2, modulationIndex: 1.2 }, env(0.004, 0.25, 0.05, 0.4), -14, MID, 4, { delay: 0.25 }),
    melody: poly({ type: "fatsawtooth", spread: 12, count: 2 }, env(0.01, 0.3, 0.3, 0.5), -22, MID),
    bell: fmBell(3.5, 10, 1.2, -14),
    kick: kick(-9, 4, 0.28),
    snare: noise("white", 0.18, -18),
    hat: noise("white", 0.03, -26),
    perc: woodblock(-12),
    metal: metal({ harmonicity: 5.1, modulationIndex: 24, octaves: 1.5, resonance: 3500, decay: 0.35 }, -24, MID),
    boss: mono("sawtooth", { frequency: 1500, rolloff: -24, Q: 2 }, { ...env(0.01, 0.4, 0.5, 0.5), baseFrequency: 200, octaves: 3 }, env(0.01, 0.4, 0.5, 0.5), -16, LOW, 4),
    heart: heart(),
    drone: drone({ type: "fattriangle", spread: 15, count: 3 }, -26),
  },
};

const bell: Palette = {
  id: "bell",
  name: "Bell",
  bpm: 90,
  key: "D",
  mode: "aeolian",
  // Old chords Dm Gm Am F.
  progression: "i iv v III",
  instruments: {
    // Harmonic FM (1:2): glassy, decaying.
    lead: fm({ harmonicity: 2, modulationIndex: 10, envelope: env(0.001, 0.9, 0.05, 1.2), modulationEnvelope: env(0.001, 0.3, 0.2, 0.6) }, -6, MID, 6, { reverb: 0.45 }),
    bass: fm({ harmonicity: 1, modulationIndex: 3, envelope: env(0.01, 0.6, 0.15, 0.8), modulationEnvelope: env(0.01, 0.2, 0.1, 0.3) }, -10, BASS, 2),
    pad: poly({ type: "fatsine", spread: 10, count: 2 }, env(0.5, 0.6, 0.7, 2), -20, PAD, 6, { reverb: 0.6 }),
    // Hollow vibraphone.
    stab: am({ harmonicity: 4, envelope: env(0.001, 0.5, 0, 0.4), modulationEnvelope: env(0.001, 0.4, 0, 0.3) }, -10, MID),
    // Celesta.
    arp: fm({ harmonicity: 4, modulationIndex: 6, envelope: env(0.001, 0.35, 0, 0.3), modulationEnvelope: env(0.001, 0.1, 0, 0.1) }, -10, MID, 4, { delay: 0.3 }),
    // Breathy sustained flute, the one non-struck voice.
    melody: poly({ type: "sine" }, env(0.04, 0.4, 0.5, 0.8), -12, MID),
    // Tubular bell (Chowning's 1:1.4).
    bell: fmBell(1.4, 18, 2.2, -10),
    kick: kick(-12, 3, 0.4),
    snare: noise("pink", 0.2, -20),
    hat: metal({ harmonicity: 5.1, modulationIndex: 32, octaves: 1.5, resonance: 6000, decay: 0.05 }, -30, HIGH),
    perc: fm({ harmonicity: 3, modulationIndex: 4, envelope: env(0.001, 0.06, 0, 0.04), modulationEnvelope: env(0.001, 0.04, 0, 0.03) }, -10, HIGH),
    // Gong.
    metal: metal({ harmonicity: 3.1, modulationIndex: 16, octaves: 1, resonance: 2200, decay: 1.2 }, -26, MID),
    // Low tolling bell.
    boss: fm({ harmonicity: 0.71, modulationIndex: 10, envelope: env(0.001, 2, 0, 2), modulationEnvelope: env(0.001, 0.8, 0.2, 1.2) }, -8, LOW),
    heart: heart(),
    drone: drone({ type: "sine" }, -22),
  },
};

const synth: Palette = {
  id: "synth",
  name: "Synth",
  bpm: 120,
  key: "C",
  mode: "aeolian",
  // Old chords Cm Ab Bb Gm.
  progression: "i VI VII v",
  instruments: {
    lead: poly({ type: "square" }, env(0.005, 0.15, 0.15, 0.25), -16, MID, 6, { delay: 0.25 }),
    bass: mono("square", { frequency: 800, rolloff: -24, Q: 3 }, { ...env(0.005, 0.15, 0.2, 0.2), baseFrequency: 200, octaves: 3 }, env(0.005, 0.2, 0.3, 0.3), -14, BASS),
    pad: poly({ type: "fatsawtooth", spread: 30, count: 3 }, env(0.15, 0.4, 0.5, 1), -26, PAD, 6, { reverb: 0.4 }),
    stab: poly({ type: "sawtooth" }, env(0.002, 0.12, 0, 0.08), -18, MID),
    arp: poly({ type: "pulse", width: 0.25 }, env(0.002, 0.1, 0.05, 0.1), -18, MID, 4, { delay: 0.3 }),
    melody: mono("sawtooth", { frequency: 2400, rolloff: -12, Q: 2 }, { ...env(0.01, 0.25, 0.5, 0.3), baseFrequency: 600, octaves: 2.5 }, env(0.01, 0.2, 0.4, 0.3), -18, MID, 4),
    // DX-style digital bell.
    bell: fm({ harmonicity: 3.5, modulationIndex: 12, modulation: "square", envelope: env(0.001, 0.8, 0, 0.8), modulationEnvelope: env(0.001, 0.3, 0.1, 0.5) }, -18, HIGH, 4, { reverb: 0.4 }),
    kick: kick(-8, 6, 0.45),
    snare: noise("white", 0.12, -18),
    hat: noise("white", 0.025, -26),
    perc: tick("square", 0.03, -20),
    metal: metal({ harmonicity: 5.1, modulationIndex: 32, octaves: 1.5, resonance: 4000, decay: 0.3 }, -24, MID),
    boss: fm({ harmonicity: 0.5, modulationIndex: 12, oscillator: "sawtooth", modulation: "square", envelope: env(0.01, 0.4, 0.5, 0.4), modulationEnvelope: env(0.01, 0.3, 0.4, 0.4) }, -20, LOW),
    heart: heart(),
    drone: drone({ type: "fattriangle", spread: 20, count: 3 }, -26),
  },
};

const ethereal: Palette = {
  id: "ethereal",
  name: "Ethereal",
  bpm: 80,
  key: "B",
  mode: "dorian",
  // Old Bm G A E mixed aeolian (G) and dorian (E). Dorian keeps the bright IV; G becomes D, giving
  // a chain of open fifths D–A–E–B.
  progression: "i III VII IV",
  instruments: {
    // AM shimmer with a slow-blooming modulation envelope (airy, not struck like the bell theme).
    lead: am({ harmonicity: 2, envelope: env(0.06, 0.5, 0.4, 1.6), modulationEnvelope: env(0.3, 0.3, 0.8, 1.2) }, -6, MID, 4, { reverb: 0.6, delay: 0.35 }),
    bass: mono("sine", { frequency: 600, rolloff: -12, Q: 0.7 }, { ...env(0.06, 0.6, 0.6, 1), baseFrequency: 300, octaves: 1 }, env(0.08, 0.8, 0.3, 1), -10, BASS),
    pad: poly({ type: "fatsine", spread: 40, count: 3 }, env(0.6, 1, 0.8, 3), -20, PAD, 6, { reverb: 0.7 }),
    stab: poly({ type: "fmsine", modulationType: "sine", harmonicity: 1, modulationIndex: 0.8 }, env(0.01, 0.3, 0, 0.3), -14, MID),
    arp: poly({ type: "sine" }, env(0.01, 0.25, 0.1, 0.5), -14, MID, 4, { reverb: 0.6, delay: 0.45 }),
    melody: poly({ type: "fattriangle", spread: 15, count: 2 }, env(0.12, 0.5, 0.5, 1.5), -18, MID, 4, { reverb: 0.5 }),
    // Glass harmonica.
    bell: fmBell(2.5, 4, 2.5, -14),
    kick: kick(-16, 3, 0.4),
    // Breath.
    snare: noise("pink", 0.3, -22, 0.01),
    hat: noise("white", 0.03, -30),
    perc: tick("sine", 0.06, -16),
    metal: metal({ harmonicity: 3.1, modulationIndex: 12, octaves: 1, resonance: 2000, decay: 1 }, -28, MID),
    boss: am({ harmonicity: 1.5, modulation: "triangle", envelope: env(0.2, 0.6, 0.6, 1.5), modulationEnvelope: env(0.2, 0.5, 0.6, 1) }, -8, LOW),
    heart: heart(-12, 0.3),
    drone: drone({ type: "fatsine", spread: 30, count: 3 }, -22),
  },
};

const piano: Palette = {
  id: "piano",
  name: "Piano",
  bpm: 95,
  key: "F",
  mode: "ionian",
  // Old chords F Dm Bb C7.
  progression: "I vi IV V7",
  instruments: {
    // 1:1 FM with a fast-decaying index: hammer brightness, then a mellow decay.
    lead: fm({ harmonicity: 1, modulationIndex: 4, envelope: env(0.002, 1, 0, 0.6), modulationEnvelope: env(0.002, 0.25, 0.05, 0.4) }, -4, MID, 6, { reverb: 0.3 }),
    bass: mono("triangle", { frequency: 1000, rolloff: -12, Q: 0.8 }, { ...env(0.002, 0.4, 0.2, 0.5), baseFrequency: 160, octaves: 2.8 }, env(0.003, 0.6, 0.1, 0.6), -12, BASS),
    // Soft strings.
    pad: poly({ type: "fattriangle", spread: 15, count: 3 }, env(0.3, 0.5, 0.6, 1.5), -22, PAD, 6, { reverb: 0.5 }),
    // Pizzicato.
    stab: poly({ type: "triangle" }, env(0.002, 0.18, 0, 0.1), -12, MID),
    // Music box.
    arp: fm({ harmonicity: 2, modulationIndex: 3, envelope: env(0.001, 0.4, 0, 0.3), modulationEnvelope: env(0.001, 0.15, 0, 0.1) }, -10, MID, 4, { delay: 0.2 }),
    // Flute.
    melody: poly({ type: "sine" }, env(0.03, 0.3, 0.6, 0.6), -12, MID),
    bell: fmBell(3.5, 10, 1.6, -14),
    kick: kick(-12, 3, 0.3),
    // Brush.
    snare: noise("pink", 0.2, -22, 0.005),
    hat: noise("white", 0.03, -28),
    perc: woodblock(-12),
    metal: metal({ harmonicity: 5.1, modulationIndex: 20, octaves: 1.2, resonance: 3000, decay: 0.5 }, -26, MID),
    boss: fm({ harmonicity: 0.5, modulationIndex: 6, envelope: env(0.01, 0.8, 0.3, 0.8), modulationEnvelope: env(0.01, 0.4, 0.3, 0.5) }, -8, LOW),
    heart: heart(),
    drone: drone({ type: "fatsine", spread: 12, count: 3 }, -24),
  },
};

export const ALL_PALETTES: readonly Palette[] = deepFreeze([theremin, guitar, bell, synth, ethereal, piano]);

export const DEFAULT_PALETTE_ID = "theremin";

/** Palette by id (case-insensitive); unknown or missing ids fall back to theremin. */
export function getPalette(id: string | undefined): Palette {
  const wanted = typeof id === "string" ? id.toLowerCase() : DEFAULT_PALETTE_ID;
  return (
    ALL_PALETTES.find((p) => p.id === wanted) ?? (ALL_PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID) as Palette)
  );
}
