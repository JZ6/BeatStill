/**
 * Harmony: key, mode and a looping Roman-numeral chord progression.
 * Pure TypeScript (no Phaser, Tone or DOM), unit-testable.
 *
 * Numeral grammar (one token per chord, separated by whitespace; "|" tokens are ignored):
 *   [b|#] NUMERAL [°|o|dim|ø|+|aug] [7|maj7] [sus2|sus4] [:BARS]
 * - NUMERAL is I..VII (major triad) or i..vii (minor triad); mixed case is invalid.
 * - b/# shifts the chord root a semitone relative to the MODE's degree (in aeolian "VII" is
 *   already the flat seventh; "bVII" would lower it again).
 * - °/o/dim → diminished, +/aug → augmented, ø → half-diminished seventh (ø7 also accepted).
 * - sus2/sus4 replace the third (cannot be combined with dim/aug/ø).
 * - "7": an uppercase major-quality numeral gets a dominant (minor) seventh, e.g. V7 is
 *   dominant in every mode and I7 is C7 in C. Anything else (lowercase, °, +) stacks the
 *   mode's diatonic seventh on the root: ii7 = m7, vii°7 = ø7 in ionian and °7 in
 *   harmonic minor, i7 = minor-major 7 in harmonic minor. Use "maj7" for a major seventh.
 * - ":BARS" (positive integer) sets how many bars the chord lasts (default 1).
 */
import { isHeptatonicMode, mod, noteNameToPc, pitchClass, scaleMidi, scalePcs } from "./theory";
import type { HeptatonicMode } from "./theory";

export type TriadQuality = "major" | "minor" | "diminished" | "augmented";
export type SeventhKind = "none" | "seventh" | "maj7" | "halfDim";

export interface ParsedNumeral {
  /** The token without its bar-length suffix, e.g. "bVII", "V7". */
  symbol: string;
  /** Semitone shift of the root relative to the mode degree: -1, 0 or +1. */
  accidental: number;
  /** Scale degree index, 0 (I) .. 6 (VII). */
  degree: number;
  upper: boolean;
  quality: TriadQuality;
  sus: 0 | 2 | 4;
  seventh: SeventhKind;
}

export interface ProgressionEntry {
  numeral: ParsedNumeral;
  bars: number;
}

export interface Chord {
  symbol: string;
  rootPc: number;
  /** Pitch classes, root first, then third (or sus tone), fifth and optional seventh. */
  pcs: readonly number[];
}

export interface HarmonyOptions {
  /** Tonic note name, e.g. "E", "Bb". */
  key: string;
  mode: HeptatonicMode;
  progression: string;
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const TOKEN_RE =
  /^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°|o|dim|ø|\+|aug)?(7|maj7)?(sus2|sus4)?(?::(\d+))?$/;

const TRIADS: Readonly<Record<TriadQuality, readonly number[]>> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
};

function parseToken(token: string): ProgressionEntry {
  const m = TOKEN_RE.exec(token);
  if (!m) throw new Error(`Invalid chord numeral: ${JSON.stringify(token)}`);
  const [, acc, numeral, marker, seventhTok, susTok, barsTok] = m;
  const upper = numeral === numeral.toUpperCase();
  let quality: TriadQuality = upper ? "major" : "minor";
  let seventh: SeventhKind = seventhTok === "maj7" ? "maj7" : seventhTok === "7" ? "seventh" : "none";
  if (marker === "°" || marker === "o" || marker === "dim") quality = "diminished";
  else if (marker === "+" || marker === "aug") quality = "augmented";
  else if (marker === "ø") {
    if (seventh === "maj7") throw new Error(`Half-diminished chord cannot have maj7: ${token}`);
    quality = "diminished";
    seventh = "halfDim";
  }
  const sus = susTok === "sus2" ? 2 : susTok === "sus4" ? 4 : 0;
  if (sus && marker) throw new Error(`sus cannot be combined with ${marker}: ${token}`);
  const bars = barsTok === undefined ? 1 : Number(barsTok);
  if (!Number.isSafeInteger(bars) || bars < 1) throw new Error(`Invalid bar length in ${JSON.stringify(token)}`);
  const accidental = acc === "b" || acc === "♭" ? -1 : acc ? 1 : 0;
  const symbol = barsTok === undefined ? token : token.slice(0, token.lastIndexOf(":"));
  return {
    numeral: { symbol, accidental, degree: NUMERALS.indexOf(numeral.toUpperCase()), upper, quality, sus, seventh },
    bars,
  };
}

/** Parses a single numeral (no bar suffix allowed). */
export function parseNumeral(symbol: string): ParsedNumeral {
  const entry = parseToken(symbol);
  if (entry.numeral.symbol !== symbol) throw new Error(`Unexpected bar length in numeral: ${symbol}`);
  return entry.numeral;
}

/** Parses a whole progression, e.g. "i:2 VI III VII". Throws on an empty or invalid progression. */
export function parseProgression(progression: string): ProgressionEntry[] {
  if (typeof progression !== "string") throw new Error("Progression must be a string");
  const tokens = progression.split(/\s+/).filter((t) => t !== "" && t !== "|");
  if (tokens.length === 0) throw new Error("Progression is empty");
  return tokens.map(parseToken);
}

/** Builds the chord for a numeral in a key (tonic pitch class) and 7-note mode. */
export function chordFromNumeral(numeral: ParsedNumeral | string, keyPc: number, mode: HeptatonicMode): Chord {
  if (!isHeptatonicMode(mode)) throw new Error(`Harmony needs a 7-note mode, got ${JSON.stringify(mode)}`);
  const n = typeof numeral === "string" ? parseNumeral(numeral) : numeral;
  const scale = scalePcs(keyPc, mode);
  const rootPc = mod(scale[n.degree] + n.accidental, 12);
  const intervals = [...TRIADS[n.quality]];
  if (n.sus) intervals[1] = n.sus === 2 ? 2 : 5;
  if (n.seventh === "maj7") intervals.push(11);
  else if (n.seventh === "halfDim") intervals.push(10);
  else if (n.seventh === "seventh") {
    if (n.upper && n.quality === "major") {
      intervals.push(10);
    } else {
      // The scale tone a seventh above the (unaltered) degree; guard odd altered roots.
      const diatonic = mod(scale[(n.degree + 6) % 7] - rootPc, 12);
      intervals.push(diatonic >= 9 && diatonic <= 11 ? diatonic : 10);
    }
  }
  return {
    symbol: n.symbol,
    rootPc,
    pcs: Object.freeze(intervals.map((i) => mod(rootPc + i, 12))),
  };
}

interface Segment {
  numeral: ParsedNumeral;
  startBar: number;
  bars: number;
  chord: Chord;
}

function checkRange(low: number, high: number): void {
  if (!Number.isFinite(low) || !Number.isFinite(high)) throw new Error(`Invalid MIDI range: [${low}, ${high}]`);
}

export class Harmony {
  private _keyPc: number;
  private readonly _mode: HeptatonicMode;
  private readonly segments: Segment[];
  /** Total length of one pass through the progression, in bars. */
  readonly progressionLength: number;

  constructor(options: HarmonyOptions) {
    if (!isHeptatonicMode(options.mode)) {
      throw new Error(`Harmony needs a 7-note mode, got ${JSON.stringify(options.mode)}`);
    }
    this._keyPc = noteNameToPc(options.key);
    this._mode = options.mode;
    let startBar = 0;
    this.segments = parseProgression(options.progression).map(({ numeral, bars }) => {
      const seg = { numeral, startBar, bars, chord: chordFromNumeral(numeral, this._keyPc, this._mode) };
      startBar += bars;
      return seg;
    });
    this.progressionLength = startBar;
  }

  get keyPc(): number {
    return this._keyPc;
  }

  get mode(): HeptatonicMode {
    return this._mode;
  }

  /** Chord at a bar index. The progression loops; negative bars count back from the end. */
  chordAtBar(bar: number): Chord {
    if (!Number.isFinite(bar)) throw new Error(`Invalid bar: ${bar}`);
    const b = mod(Math.floor(bar), this.progressionLength);
    for (const seg of this.segments) {
      if (b < seg.startBar + seg.bars) return seg.chord;
    }
    return this.segments[this.segments.length - 1].chord;
  }

  /** Ascending chord-tone MIDI notes in [lowMidi, highMidi]. */
  chordTones(bar: number, lowMidi: number, highMidi: number): number[] {
    checkRange(lowMidi, highMidi);
    const pcs = this.chordAtBar(bar).pcs;
    const out: number[] = [];
    for (let midi = Math.ceil(lowMidi); midi <= highMidi; midi++) {
      if (pcs.includes(pitchClass(midi))) out.push(midi);
    }
    return out;
  }

  /** Ascending MIDI notes of the key's scale in [lowMidi, highMidi]. */
  scaleTones(lowMidi: number, highMidi: number): number[] {
    return scaleMidi(this._keyPc, this._mode, lowMidi, highMidi);
  }

  isChordTone(midi: number, bar: number): boolean {
    return this.chordAtBar(bar).pcs.includes(pitchClass(midi));
  }

  /**
   * Notes that are safe to play over the chord at `bar`: every chord tone, plus the scale tones
   * that are not a half step above a chord tone (the classic avoid notes) and not a half step
   * below a chromatic (non-scale) chord tone, e.g. G is dropped over E7 in A aeolian.
   */
  safeScaleTones(bar: number, lowMidi: number, highMidi: number): number[] {
    checkRange(lowMidi, highMidi);
    const chord = new Set(this.chordAtBar(bar).pcs);
    const scale = new Set(scalePcs(this._keyPc, this._mode));
    const safe = (pc: number): boolean => {
      if (chord.has(pc)) return true;
      if (!scale.has(pc)) return false;
      if (chord.has(mod(pc - 1, 12))) return false;
      const above = mod(pc + 1, 12);
      return !(chord.has(above) && !scale.has(above));
    };
    const out: number[] = [];
    for (let midi = Math.ceil(lowMidi); midi <= highMidi; midi++) {
      if (safe(pitchClass(midi))) out.push(midi);
    }
    return out;
  }

  /** The chord tone closest to `midi` (rounded); ties resolve downward. */
  nearestChordTone(midi: number, bar: number): number {
    if (!Number.isFinite(midi)) throw new Error(`Invalid MIDI note: ${midi}`);
    const pcs = this.chordAtBar(bar).pcs;
    const m = Math.round(midi);
    for (let d = 0; d <= 12; d++) {
      if (pcs.includes(pitchClass(m - d))) return m - d;
      if (pcs.includes(pitchClass(m + d))) return m + d;
    }
    return m;
  }

  /**
   * Walks the chord tones inside a register: index 0 is the lowest, 1 the next one up, and
   * so on, wrapping back to the bottom past the top (negative indices count from the top).
   * If the register holds no chord tone, the chord tone nearest its centre is returned.
   */
  pickChordTone(bar: number, register: readonly [number, number], index: number): number {
    if (!Number.isFinite(index)) throw new Error(`Invalid chord-tone index: ${index}`);
    const [low, high] = register;
    const tones = this.chordTones(bar, low, high);
    if (tones.length === 0) return this.nearestChordTone((low + high) / 2, bar);
    return tones[mod(Math.floor(index), tones.length)];
  }

  /** Shifts the key by `semitones` (integer). Numerals stay the same; chords move with the key. */
  modulate(semitones: number): this {
    if (!Number.isInteger(semitones)) throw new Error(`Modulation must be whole semitones: ${semitones}`);
    this._keyPc = mod(this._keyPc + semitones, 12);
    for (const seg of this.segments) seg.chord = chordFromNumeral(seg.numeral, this._keyPc, this._mode);
    return this;
  }
}
