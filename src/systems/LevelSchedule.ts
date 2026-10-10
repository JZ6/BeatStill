// When each wave of a level spawns, as pure tick math (no Phaser), so the rules are unit-testable.
import { PendingSpawn, nextBarLine, sectionStartTick } from "../core/barSchedule";

export type LevelStep = { kind: "wave"; index: number } | { kind: "complete" };

/** A wave's minimum section length in bars: its `bars` (floored) when that is a number ≥ 1, else 1. */
export function waveMinBars(bars: unknown): number {
  return typeof bars === "number" && Number.isFinite(bars) && bars >= 1 ? Math.floor(bars) : 1;
}

/**
 * Level waves are song sections that start on bar lines:
 * - the first wave spawns on the first bar line of the run;
 * - once a wave's field is clear, the next wave (or, after the last one, the level completion) is
 *   scheduled on the next bar line that is at least the wave's `bars` (default 1) after its spawn.
 * A pending-spawn guard means each step is scheduled at most once and fires exactly once, on the
 * first tick at or after its bar line.
 */
export class LevelSchedule {
  private readonly pending = new PendingSpawn<LevelStep>();
  private lastStartTick: number | null = null;
  private index = -1;
  private done = false;

  /** `waveBars`: each wave's optional `bars`, in order. */
  constructor(
    private readonly waveBars: readonly unknown[],
    private readonly ticksPerBar: number,
  ) {}

  /** Index of the wave that spawned last (-1 before the first). */
  get waveIndex(): number {
    return this.index;
  }

  get isComplete(): boolean {
    return this.done;
  }

  /** The tick the next step is scheduled for, or null. */
  get pendingTick(): number | null {
    return this.pending.tick;
  }

  get pendingStep(): LevelStep | null {
    return this.pending.what;
  }

  /** Schedules the first wave on the first bar line at or after `fromTick`. Only once. */
  start(fromTick: number): boolean {
    if (this.done || this.index >= 0 || this.pending.isPending) return false;
    const first: LevelStep = this.waveBars.length > 0 ? { kind: "wave", index: 0 } : { kind: "complete" };
    return this.pending.schedule(nextBarLine(fromTick, this.ticksPerBar), first);
  }

  /**
   * The current wave's field is clear: schedules the next wave or the completion. `fromTick` is the
   * first tick not yet emitted (conductor.currentTick + 1). Returns whether something was scheduled.
   */
  onFieldClear(fromTick: number): boolean {
    if (this.done || this.index < 0 || this.pending.isPending) return false;
    const at = sectionStartTick(fromTick, this.ticksPerBar, this.lastStartTick, waveMinBars(this.waveBars[this.index]));
    const next = this.index + 1;
    const step: LevelStep = next < this.waveBars.length ? { kind: "wave", index: next } : { kind: "complete" };
    return this.pending.schedule(at, step);
  }

  /** Call on every conductor tick, in order: the step that is due on this tick (at most once), else null. */
  onTick(tick: number): LevelStep | null {
    const due = this.pending.take(tick);
    if (!due) return null;
    if (due.what.kind === "wave") {
      this.index = due.what.index;
      this.lastStartTick = tick;
    } else {
      this.done = true;
    }
    return due.what;
  }
}
