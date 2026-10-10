/**
 * An enemy instance's firing rhythm on the conductor's 16th-note grid.
 * Pure TypeScript (no Phaser), so the firing rules are unit-testable.
 *
 * Rules
 * - The enemy fires on step `s` when its pattern hits at `s + offset` (patternAt).
 * - Spawn grace: no shots during the first SPAWN_GRACE_STEPS steps it sees; hits in the grace are skipped.
 * - A hit that comes due while the enemy can't fire (mid-teleport, phase transition) is held, not
 *   lost: it fires on the first step the enemy can fire again. At most one shot is held.
 */
import { doubleDensity, patternAt } from "../../music/patterns";

/** Steps after spawn (counted from the first step an enemy sees) during which it never fires. */
export const SPAWN_GRACE_STEPS = 4;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) [x, y] = [y, x % y];
  return x;
}

/**
 * A random phase offset for a pattern of `length` steps: a multiple of `offsetStep` (mod length).
 * `randomInt(n)` must return an integer in [0, n). Returns 0 for empty patterns or offsetStep ≤ 0.
 */
export function pickOffset(length: number, offsetStep: number, randomInt: (n: number) => number): number {
  const len = Math.floor(length);
  const step = Math.floor(offsetStep);
  if (!(len > 0) || !(step > 0)) return 0;
  const choices = len / gcd(len, step);
  const k = Math.min(choices - 1, Math.max(0, Math.floor(randomInt(choices))));
  return mod(k * step, len);
}

const TAU = Math.PI * 2;

/**
 * Spiral arms turn this much per 16th step: 3π/16 per 8th, the old 2 rad/s look at 100 bpm. The
 * Phantom's phase-3 arms turned at the same 2 rad/s and use it too.
 */
export const SPIRAL_STEP_ANGLE = (3 * Math.PI) / 32;

/** The Sentinel's phase-3 arms (and inner square) per 16th step: its old 3 rad/s at 100 bpm (9 turns per 8 bars). */
export const SENTINEL_SPIRAL_STEP_ANGLE = (9 * Math.PI) / 64;

/**
 * A spiral's arm angle on `step` (radians in [0, 2π)), from its `phase`, turning `stepAngle` per
 * step. Locked to the grid: the same step always gives the same angle, whatever the frame rate.
 * Fractional steps (the conductor's position between steps) turn smoothly, for drawing.
 */
export function spiralAngle(step: number, phase: number, stepAngle: number = SPIRAL_STEP_ANGLE): number {
  return mod(phase + step * stepAngle, TAU);
}

/** The snake's weave, locked to the beat: one cycle per beat, shifted by `phase` (beats). In [-1, 1]. */
export function weave(beat: number, phase: number): number {
  return Math.sin(TAU * (beat + phase));
}

/** The weave as a 0..1 pitch suggestion: the snake's sideways swing becomes the melody's contour. */
export function weavePitchHint(beat: number, phase: number): number {
  return 0.5 + 0.5 * weave(beat, phase);
}

/** Number of doublings (0, 1, 2, …) for a density factor (1, 2, 4, …); factors ≤ 1 give 0. */
export function densityDoublings(factor: number): number {
  return Number.isFinite(factor) && factor > 1 ? Math.max(0, Math.round(Math.log2(factor))) : 0;
}

export class EnemyRhythm {
  private base: readonly boolean[];
  private hits: readonly boolean[];
  private offset: number;
  private doublings = 0;
  private firstStep: number | null = null;
  private held = false;

  constructor(pattern: readonly boolean[], offset = 0) {
    this.base = [...pattern];
    this.hits = this.base;
    this.offset = this.hits.length > 0 ? mod(Math.floor(offset), this.hits.length) : 0;
  }

  /** The hits being played (after density changes). */
  get pattern(): readonly boolean[] {
    return this.hits;
  }

  /** Steps the pattern is shifted by: step `s` plays pattern index `(s + phaseOffset) mod length`. */
  get phaseOffset(): number {
    return this.offset;
  }

  /** Whether a shot is held, waiting for the enemy to be able to fire. */
  get holding(): boolean {
    return this.held;
  }

  /**
   * Replaces the pattern (keeping the density). With `anchorStep`, that step becomes the pattern's
   * first step (a boss section starting on a bar line); otherwise the offset carries over.
   */
  setPattern(pattern: readonly boolean[], anchorStep?: number): void {
    this.base = [...pattern];
    this.hits = this.densified();
    const len = this.hits.length;
    if (len === 0) this.offset = 0;
    else if (anchorStep !== undefined && Number.isFinite(anchorStep)) this.offset = mod(-Math.floor(anchorStep), len);
    else this.offset = mod(this.offset, len);
  }

  /** Doubles the hit density `doublings` times (e.g. the bullet_storm mutator); 0 restores the pattern. */
  setDensity(doublings: number): void {
    this.doublings = Number.isFinite(doublings) ? Math.max(0, Math.floor(doublings)) : 0;
    this.hits = this.densified();
  }

  /** Whether the pattern hits on `step` (ignores the spawn grace and held shots). */
  hitsOn(step: number): boolean {
    return patternAt(this.hits, step, this.offset);
  }

  /** Call once per step, in order. Returns true if the enemy fires on this step. */
  onStep(step: number, canFire: boolean): boolean {
    if (this.firstStep === null) this.firstStep = step;
    if (step - this.firstStep < SPAWN_GRACE_STEPS) return false;
    if (!this.held && !this.hitsOn(step)) return false;
    if (!canFire) {
      this.held = true;
      return false;
    }
    this.held = false;
    return true;
  }

  private densified(): readonly boolean[] {
    let hits: readonly boolean[] = this.base;
    for (let i = 0; i < this.doublings; i++) hits = doubleDensity(hits);
    return hits;
  }
}
