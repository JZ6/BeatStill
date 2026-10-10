/**
 * Note picking for the theme preview phrase (Collection → Customize → ▶). Pure TypeScript.
 */
import type { Harmony } from "./Harmony";
import { mod, pitchClass } from "./theory";

/**
 * Up to four ascending chord tones of progression chord `index`, from its lowest root at or above
 * the register's bottom: root, third, fifth and the octave (or the seventh of a seventh chord).
 */
export function arpeggioNotes(harmony: Harmony, index: number, register: readonly [number, number]): number[] {
  const [lo, hi] = register;
  const chord = harmony.chordAtBar(index);
  const tones = harmony.chordTones(index, lo, Math.max(hi, lo + 24));
  const start = Math.max(0, tones.findIndex((n) => pitchClass(n) === chord.rootPc));
  return tones.slice(start, start + 4);
}

/** The lowest note with pitch class `pc` at or above `low`. */
export function noteAtOrAbove(pc: number, low: number): number {
  return low + mod(pc - pitchClass(low), 12);
}
