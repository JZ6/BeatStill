/**
 * Bar-line scheduling for song structure: waves are sections that start on bar lines, mutators
 * switch on phrase boundaries. Ticks are the Conductor's absolute tick indices.
 * Pure TypeScript (no Phaser/Tone), so it is unit-testable.
 */

function validInterval(interval: number): number {
  return Math.max(1, Math.floor(Number.isFinite(interval) ? interval : 1));
}

/** The first multiple of `interval` ticks at or after `tick` (ticks below 0 count as 0). */
function nextMultipleAtOrAfter(tick: number, interval: number): number {
  const i = validInterval(interval);
  const t = Math.max(0, Number.isFinite(tick) ? Math.ceil(tick) : 0);
  return Math.ceil(t / i) * i;
}

/** The first bar-line tick at or after `tick`. Pass `conductor.currentTick + 1` for "the next bar line not yet emitted". */
export function nextBarLine(tick: number, ticksPerBar: number): number {
  return nextMultipleAtOrAfter(tick, ticksPerBar);
}

/** The first phrase boundary (a bar line whose bar index is a multiple of `barsPerPhrase`) at or after `tick`. */
export function nextPhraseBoundary(tick: number, ticksPerBar: number, barsPerPhrase = 4): number {
  return nextMultipleAtOrAfter(tick, validInterval(ticksPerBar) * validInterval(barsPerPhrase));
}

/**
 * The tick a section may start on: the first bar line at or after `fromTick` that is also at least
 * `minBars` bars after the previous section's start (`prevStartTick`, null for the first section).
 */
export function sectionStartTick(fromTick: number, ticksPerBar: number, prevStartTick: number | null, minBars = 1): number {
  const tpb = validInterval(ticksPerBar);
  const bars = Math.max(0, Math.floor(Number.isFinite(minBars) ? minBars : 1));
  const earliest = prevStartTick === null || !Number.isFinite(prevStartTick) ? fromTick : Math.max(fromTick, prevStartTick + bars * tpb);
  return nextBarLine(earliest, tpb);
}

export interface PendingEntry<K> {
  /** The tick it was scheduled for. */
  tick: number;
  what: K;
}

/**
 * A guard for one scheduled spawn (a wave, a level completion, a boss): it can't be scheduled twice
 * and can't be skipped. take() is called on every conductor tick, in order, and hands the entry out
 * exactly once, on the first tick at or after the scheduled one.
 */
export class PendingSpawn<K> {
  private entry: PendingEntry<K> | null = null;

  get isPending(): boolean {
    return this.entry !== null;
  }

  /** The scheduled tick, or null when nothing is pending. */
  get tick(): number | null {
    return this.entry?.tick ?? null;
  }

  /** What is scheduled, or null when nothing is pending. */
  get what(): K | null {
    return this.entry?.what ?? null;
  }

  /** Schedules `what` for `tick`. Returns false (and changes nothing) if something is already pending. */
  schedule(tick: number, what: K): boolean {
    if (this.entry !== null || !Number.isFinite(tick)) return false;
    this.entry = { tick, what };
    return true;
  }

  /** The pending entry once `tick` has reached its tick (then nothing is pending), else null. */
  take(tick: number): PendingEntry<K> | null {
    const e = this.entry;
    if (e === null || !(tick >= e.tick)) return null;
    this.entry = null;
    return e;
  }

  cancel(): void {
    this.entry = null;
  }
}
