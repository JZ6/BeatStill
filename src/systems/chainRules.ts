/**
 * Chain timing in beats of conductor time, so chain windows dilate with time like everything else
 * (the timers count down by gameDt × bpm / 60). Pure TypeScript, unit-testable.
 */

/** Base chain window: ≈ the old 800 ms at 100–120 bpm. */
export const CHAIN_WINDOW_BEATS = 1.5;
/** After a chain of tier ≥ 2 breaks, a kill within this long resumes it one tier lower (was 400 ms). */
export const CHAIN_GRACE_BEATS = 0.75;
/** Chain window added per Chain Sustain level (in-run upgrade). */
export const CHAIN_SUSTAIN_BEATS = 0.5;
/** Chain window added per Chain Link level (shop). */
export const CHAIN_LINK_BEATS = 0.25;

/** The chain window in beats with `bonusBeats` from upgrades and the shop (negative bonuses are ignored). */
export function chainWindowBeats(bonusBeats: number): number {
  return CHAIN_WINDOW_BEATS + (Number.isFinite(bonusBeats) ? Math.max(0, bonusBeats) : 0);
}

/** Metronome relic: a kill within this many beats of a beat is on the beat (a 32nd either side). */
export const METRONOME_TOLERANCE_BEATS = 0.125;
/** Metronome relic: extra chain count for an on-beat kill. */
export const METRONOME_CHAIN_BONUS = 1;
/** Metronome relic: score multiplier for an on-beat kill. */
export const METRONOME_SCORE_MULT = 1.5;

/** Distance in beats from `beat` to the nearest whole beat, in [0, 0.5]. */
export function beatDistance(beat: number): number {
  if (!Number.isFinite(beat)) return 0.5;
  return Math.abs(beat - Math.round(beat));
}

/** Whether `beat` is within `tolerance` beats of a whole beat. */
export function isOnBeat(beat: number, tolerance: number = METRONOME_TOLERANCE_BEATS): boolean {
  return beatDistance(beat) <= tolerance + 1e-9;
}
