/**
 * Boss timing on the musical grid: phases as song sections and grid-aligned timers.
 * Pure TypeScript (no Phaser), so the rules are unit-testable.
 */
import { STEPS_PER_BEAT } from "../../core/Conductor";

export interface BossPhaseConfig {
  /** Max-hp fractions at or below which phase 2, 3, … begin, in descending order. */
  thresholds: readonly number[];
  /** Beats after the bar line of a phase change during which the boss is invulnerable and holds fire (0: none). */
  transitionBeats: number;
  /** Also invulnerable from crossing a threshold until the phase changes, so a burst can't skip a section. */
  shieldWhilePending: boolean;
}

/**
 * Phases come from hp (fractions of max hp). Crossing a threshold queues the phase; it takes effect
 * on the next bar line, like a new section of the song, followed by an optional transition hold.
 * One big hit can queue a phase two steps ahead; phases never go back.
 */
export class BossPhases {
  private current = 1;
  private queued = 0;
  private holdUntilStep = -Infinity;
  private lastStep = -Infinity;

  constructor(private readonly config: BossPhaseConfig) {}

  get phase(): number {
    return this.current;
  }

  /** The phase waiting for the next bar line (0: none). */
  get pending(): number {
    return this.queued;
  }

  /** Within the hold after a phase change (as of the last step seen). */
  get transitioning(): boolean {
    return this.lastStep < this.holdUntilStep;
  }

  /** Damage is ignored while this is true. */
  get invulnerable(): boolean {
    return this.transitioning || (this.config.shieldWhilePending && this.queued > 0);
  }

  /** The phase hp alone calls for: 1 + the number of thresholds at or above hp / maxHp. */
  phaseFor(hp: number, maxHp: number): number {
    if (!(maxHp > 0)) return 1;
    return 1 + this.config.thresholds.filter((t) => hp <= maxHp * t).length;
  }

  /** After hp changed: queues a later phase than the current and queued ones. Returns true if it queued one. */
  onHp(hp: number, maxHp: number): boolean {
    const target = this.phaseFor(hp, maxHp);
    if (target <= Math.max(this.current, this.queued)) return false;
    this.queued = target;
    return true;
  }

  /** Call on every step, in order. On a bar line a queued phase takes effect: returns it (else 0). */
  onStep(step: number, isBar: boolean): number {
    this.lastStep = step;
    if (!isBar || this.queued <= this.current) return 0;
    this.current = this.queued;
    this.queued = 0;
    this.holdUntilStep = step + Math.max(0, this.config.transitionBeats) * STEPS_PER_BEAT;
    return this.current;
  }
}

/** A one-shot timer that comes due on a grid line (a beat or a bar), counted in steps. */
export class GridTimer {
  private nextStep = Infinity;

  /** The step it is due on (Infinity when stopped). */
  get next(): number {
    return this.nextStep;
  }

  /** Due on the first multiple of `unitSteps` at least `minSteps` after `fromStep`. */
  schedule(fromStep: number, minSteps: number, unitSteps: number): void {
    const unit = Math.max(1, Math.floor(unitSteps));
    this.nextStep = Math.ceil((fromStep + Math.max(0, minSteps)) / unit) * unit;
  }

  /** Like schedule(), but never later than what is already scheduled. */
  scheduleNoLater(fromStep: number, minSteps: number, unitSteps: number): void {
    const before = this.nextStep;
    this.schedule(fromStep, minSteps, unitSteps);
    this.nextStep = Math.min(before, this.nextStep);
  }

  stop(): void {
    this.nextStep = Infinity;
  }

  /** True when `step` is a grid line (`onLine`) at or after the scheduled step. Stays due until rescheduled. */
  due(step: number, onLine: boolean): boolean {
    return onLine && step >= this.nextStep;
  }
}
