/**
 * Time dilation: player activity drives the time scale (Superhot-style).
 * Pure TypeScript, unit-testable. All rates here are in REAL time so that the
 * response to input does not itself slow down in slow motion.
 */

export interface DilationInput {
  /** Movement intent magnitude, 0..1 (keyboard: 0 or 1; analog stick: 0..1). */
  move: number;
  /** Aim angular speed in radians per REAL second (≥ 0). */
  aimSpeed: number;
  /** True while the player is holding fire. */
  firing: boolean;
}

export interface DilationTuning {
  min: number;
  max: number;
  /** Contribution of full movement (0..1 of the min→max range). */
  moveWeight: number;
  /** Contribution of holding fire. */
  fireWeight: number;
  /** Maximum contribution of aim spinning. */
  spinWeight: number;
  /** Aim speed (rad/s) at which spinning contributes its full weight. */
  spinFullSpeed: number;
  /** Exponential approach rate (1/s) when speeding up. */
  riseRate: number;
  /** Exponential approach rate (1/s) when slowing down. */
  fallRate: number;
}

export const DEFAULT_DILATION: DilationTuning = {
  min: 0.03,
  max: 1,
  moveWeight: 0.7,
  fireWeight: 0.6,
  spinWeight: 0.35,
  spinFullSpeed: 8,
  riseRate: 10,
  fallRate: 6,
};

const clamp01 = (v: number) => (v > 1 ? 1 : v > 0 ? v : 0);

/** Activity level 0..1 from player input. Contributions add, so moving + shooting + spinning = full speed. */
export function dilationActivity(input: DilationInput, t: DilationTuning = DEFAULT_DILATION): number {
  const move = clamp01(Number.isFinite(input.move) ? input.move : 0) * t.moveWeight;
  const fire = input.firing ? t.fireWeight : 0;
  const spinRatio = t.spinFullSpeed > 0 ? clamp01((Number.isFinite(input.aimSpeed) ? input.aimSpeed : 0) / t.spinFullSpeed) : 0;
  return clamp01(move + fire + spinRatio * t.spinWeight);
}

export function dilationTarget(input: DilationInput, t: DilationTuning = DEFAULT_DILATION): number {
  return t.min + (t.max - t.min) * dilationActivity(input, t);
}

export class TimeDilation {
  readonly tuning: DilationTuning;
  scale: number;
  target: number;

  constructor(tuning: Partial<DilationTuning> = {}) {
    this.tuning = { ...DEFAULT_DILATION, ...tuning };
    this.scale = this.tuning.min;
    this.target = this.tuning.min;
  }

  /** Advances smoothing by `realDt` seconds and returns the new scale. Frame-rate independent. */
  update(input: DilationInput, realDt: number): number {
    const t = this.tuning;
    this.target = dilationTarget(input, t);
    if (realDt > 0) {
      const rate = this.target > this.scale ? t.riseRate : t.fallRate;
      this.scale += (this.target - this.scale) * (1 - Math.exp(-rate * realDt));
    }
    this.scale = Math.min(t.max, Math.max(t.min, this.scale));
    return this.scale;
  }

  reset(scale = this.tuning.min): void {
    this.scale = Math.min(this.tuning.max, Math.max(this.tuning.min, scale));
    this.target = this.scale;
  }
}

/** Wraps an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let r = ((a + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  if (r <= -Math.PI) r += twoPi;
  return r;
}

/** Tracks smoothed angular speed (rad per real second) of an aim angle. */
export class AngularSpeedTracker {
  private last: number | null = null;
  speed = 0;

  constructor(private readonly smoothingRate = 15) {}

  update(angle: number, realDt: number): number {
    if (!Number.isFinite(angle)) return this.speed;
    if (this.last === null || !(realDt > 0)) {
      this.last = angle;
      return this.speed;
    }
    const instant = Math.abs(wrapAngle(angle - this.last)) / realDt;
    this.last = angle;
    this.speed += (instant - this.speed) * (1 - Math.exp(-this.smoothingRate * realDt));
    return this.speed;
  }

  reset(angle: number | null = null): void {
    this.last = angle;
    this.speed = 0;
  }
}
