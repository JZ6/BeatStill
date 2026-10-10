/**
 * Music theory primitives: note names, MIDI numbers, frequencies and modes.
 * Pure TypeScript (no Phaser, Tone or DOM), unit-testable.
 * Conventions: C4 = MIDI 60, A4 = MIDI 69 = 440 Hz, pitch classes 0..11 with C = 0.
 */

export type ModeName =
  | "ionian"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "aeolian"
  | "harmonicMinor"
  | "majorPentatonic"
  | "minorPentatonic";

/** Modes with seven notes (one per scale degree); the only ones Roman numerals can address. */
export type HeptatonicMode = Exclude<ModeName, "majorPentatonic" | "minorPentatonic">;

/** Semitone offsets from the tonic, ascending, within one octave. */
export const MODES: Readonly<Record<ModeName, readonly number[]>> = Object.freeze({
  ionian: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  dorian: Object.freeze([0, 2, 3, 5, 7, 9, 10]),
  phrygian: Object.freeze([0, 1, 3, 5, 7, 8, 10]),
  lydian: Object.freeze([0, 2, 4, 6, 7, 9, 11]),
  mixolydian: Object.freeze([0, 2, 4, 5, 7, 9, 10]),
  aeolian: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
  harmonicMinor: Object.freeze([0, 2, 3, 5, 7, 8, 11]),
  majorPentatonic: Object.freeze([0, 2, 4, 7, 9]),
  minorPentatonic: Object.freeze([0, 3, 5, 7, 10]),
});

export const MODE_NAMES: readonly ModeName[] = Object.freeze(Object.keys(MODES) as ModeName[]);

export const HEPTATONIC_MODES: readonly HeptatonicMode[] = Object.freeze(
  MODE_NAMES.filter((m): m is HeptatonicMode => MODES[m].length === 7),
);

export function isModeName(value: unknown): value is ModeName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MODES, value);
}

export function isHeptatonicMode(value: unknown): value is HeptatonicMode {
  return isModeName(value) && MODES[value].length === 7;
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const LETTER_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Letter (any case), then up to two sharps or up to two flats (ASCII or Unicode). */
const NAME_RE = /^([A-Ga-g])([#♯]{1,2}|[b♭]{1,2})?$/;
const NOTE_RE = /^([A-Ga-g])([#♯]{1,2}|[b♭]{1,2})?(-?\d+)$/;

/** Euclidean modulo: always in [0, m). */
export function mod(n: number, m: number): number {
  const r = n % m;
  return r < 0 ? r + m : r === 0 ? 0 : r;
}

function accidentalOffset(acc: string | undefined): number {
  if (!acc) return 0;
  const sign = acc[0] === "#" || acc[0] === "♯" ? 1 : -1;
  return sign * acc.length;
}

/** Semitones above C of a spelled note, NOT wrapped (so "Cb" → -1, "B#" → 12). */
function spelledOffset(letter: string, acc: string | undefined): number {
  return LETTER_PC[letter.toUpperCase()] + accidentalOffset(acc);
}

/** "Bb" → 10, "C#" → 1, "Cb" → 11, "e" → 4. Throws on anything else (including octave numbers). */
export function noteNameToPc(name: string): number {
  const m = typeof name === "string" ? NAME_RE.exec(name) : null;
  if (!m) throw new Error(`Invalid note name: ${JSON.stringify(name)}`);
  return mod(spelledOffset(m[1], m[2]), 12);
}

/** "C4" → 60, "C#4" → 61, "Bb2" → 46, "E-1" → 4, "Cb4" → 59, "B#3" → 60. Throws on invalid input. */
export function noteToMidi(note: string): number {
  const m = typeof note === "string" ? NOTE_RE.exec(note) : null;
  if (!m) throw new Error(`Invalid note: ${JSON.stringify(note)}`);
  const octave = Number(m[3]);
  return (octave + 1) * 12 + spelledOffset(m[1], m[2]);
}

/** 60 → "C4", 61 → "C#4" (or "Db4" with preferFlats). Throws on non-integers. */
export function midiToNote(midi: number, preferFlats = false): string {
  if (!Number.isInteger(midi)) throw new Error(`MIDI note must be an integer: ${midi}`);
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  return `${names[mod(midi, 12)]}${Math.floor(midi / 12) - 1}`;
}

/** Equal temperament, A4 (69) = 440 Hz. Fractional MIDI values give detuned frequencies. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Pitch class 0..11 of a MIDI note (negative notes wrap correctly). */
export function pitchClass(midi: number): number {
  return mod(midi, 12);
}

function modeIntervals(mode: ModeName): readonly number[] {
  if (!isModeName(mode)) throw new Error(`Unknown mode: ${JSON.stringify(mode)}`);
  return MODES[mode];
}

/** Pitch classes of a scale, starting at the root, in degree order. */
export function scalePcs(rootPc: number, mode: ModeName): number[] {
  const root = mod(Math.round(rootPc), 12);
  return modeIntervals(mode).map((i) => mod(root + i, 12));
}

/** Ascending MIDI notes of the scale within [lowMidi, highMidi] (inclusive). Empty if low > high. */
export function scaleMidi(rootPc: number, mode: ModeName, lowMidi: number, highMidi: number): number[] {
  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) {
    throw new Error(`Invalid MIDI range: [${lowMidi}, ${highMidi}]`);
  }
  const pcs = new Set(scalePcs(rootPc, mode));
  const out: number[] = [];
  for (let midi = Math.ceil(lowMidi); midi <= highMidi; midi++) {
    if (pcs.has(pitchClass(midi))) out.push(midi);
  }
  return out;
}
