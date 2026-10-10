/**
 * Note values on the conductor grid (24 ticks per beat): the ladder of intervals that fire-rate
 * upgrades climb, display names, and the interval a weapon fires at.
 * Pure TypeScript (no Phaser/Tone), so it is unit-testable.
 */
import { TICKS_PER_BEAT } from "../core/Conductor";

/** Ticks in a whole note (4 beats). */
const WHOLE_NOTE = 4 * TICKS_PER_BEAT;
/** Shortest denominator noteName() recognises (1/64). */
const MAX_DENOMINATOR = 64;
const EPSILON = 1e-9;

/**
 * Musical intervals in ticks, slowest to fastest:
 * 1/1, 1/2, dotted 1/4, 1/4, dotted 1/8, 1/4T, 1/8, 1/8T, 1/16, 1/16T, 1/32.
 * Each Rapid Fire level moves a weapon one rung faster.
 */
export const TICK_LADDER: readonly number[] = Object.freeze([96, 48, 36, 24, 18, 16, 12, 8, 6, 4, 3]);

/** The shortest interval anything fires at: a 32nd note. */
export const MIN_FIRE_TICKS = 3;

const near = (a: number, b: number): boolean => Math.abs(a - b) < EPSILON;

/**
 * Display name of an interval in ticks: "1/8", "1/8T" (triplet), "dotted 1/4", …
 * Intervals that aren't a plain, dotted or triplet note value up to 1/64 read "N ticks".
 */
export function noteName(ticks: number): string {
  if (!Number.isFinite(ticks) || ticks <= 0) return "?";
  const kinds: [factor: number, name: (d: number) => string][] = [
    [1, (d) => `1/${d}`],
    [1.5, (d) => `dotted 1/${d}`],
    [2 / 3, (d) => `1/${d}T`],
  ];
  for (const [factor, name] of kinds) {
    for (let d = 1; d <= MAX_DENOMINATOR; d *= 2) {
      if (near(ticks, (WHOLE_NOTE / d) * factor)) return name(d);
    }
  }
  return `${ticks} ticks`;
}

/**
 * Index of `ticks` on TICK_LADDER. An interval not on the ladder maps to the first rung at or
 * below it (the nearest faster rung); anything faster than the last rung maps to the last.
 */
export function ladderIndex(ticks: number): number {
  const exact = TICK_LADDER.indexOf(ticks);
  if (exact >= 0) return exact;
  const below = Number.isFinite(ticks) ? TICK_LADDER.findIndex((t) => t <= ticks) : -1;
  return below >= 0 ? below : TICK_LADDER.length - 1;
}

/** The interval `rungs` steps faster than `ticks` on TICK_LADDER, stopping at the last rung. */
export function climbLadder(ticks: number, rungs: number): number {
  const r = Number.isFinite(rungs) ? Math.max(0, Math.floor(rungs)) : 0;
  return TICK_LADDER[Math.min(ladderIndex(ticks) + r, TICK_LADDER.length - 1)];
}

/**
 * Ticks between a weapon's shots: its note value moved `fireRateLevel` rungs up the ladder. The
 * Overclock relic then plays it an octave faster (half the interval), never below a 32nd note.
 */
export function fireIntervalTicks(noteTicks: number, fireRateLevel: number, overclock = false): number {
  const rung = climbLadder(noteTicks, fireRateLevel);
  return overclock ? Math.max(MIN_FIRE_TICKS, Math.round(rung / 2)) : rung;
}
