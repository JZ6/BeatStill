/**
 * Voice bookkeeping for the audio engine. Pure TypeScript (no Tone, Phaser or DOM), unit-testable.
 * All times are AudioContext seconds.
 */

/** Smallest gap between two starts on one monophonic voice (Tone requires strictly increasing starts). */
export const MIN_START_GAP = 0.001;

/**
 * Start time for a note on a monophonic voice whose last start was `last`: `wanted` if it is at
 * least `gap` later, else `last + gap`. Returns null when that would delay the note by more than
 * `maxBump` seconds (the caller drops it instead of playing it audibly late).
 */
export function monotonicStart(last: number, wanted: number, maxBump: number, gap = MIN_START_GAP): number | null {
  if (!Number.isFinite(wanted)) return null;
  const earliest = last + gap;
  if (!Number.isFinite(earliest) || wanted >= earliest) return wanted;
  return earliest - wanted <= maxBump ? earliest : null;
}

interface Span {
  start: number;
  end: number;
  count: number;
}

/**
 * Tracks the time spans during which an instrument's voices are busy, so new notes can be capped
 * to its polyphony at every moment they would sound (including notes scheduled ahead).
 */
export class VoiceLedger {
  private spans: Span[] = [];
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  /** Number of tracked spans (for tests and diagnostics). */
  get size(): number {
    return this.spans.length;
  }

  /** Forgets spans that ended at or before `now`. */
  prune(now: number): void {
    if (this.spans.some((s) => s.end <= now)) this.spans = this.spans.filter((s) => s.end > now);
  }

  /** Voices busy at time `t`. */
  busyAt(t: number): number {
    let n = 0;
    for (const s of this.spans) if (s.start <= t && t < s.end) n += s.count;
    return n;
  }

  /** How many of `wanted` new voices fit in [start, end) without exceeding capacity at any moment. */
  fit(start: number, end: number, wanted: number): number {
    if (!(wanted > 0) || !(end > start)) return 0;
    let peak = this.busyAt(start);
    for (const s of this.spans) {
      if (s.start > start && s.start < end) peak = Math.max(peak, this.busyAt(s.start));
    }
    return Math.max(0, Math.min(Math.floor(wanted), this.capacity - peak));
  }

  /** Records `count` voices busy in [start, end). */
  add(start: number, end: number, count: number): void {
    if (count > 0 && end > start) this.spans.push({ start, end, count });
  }

  clear(): void {
    this.spans = [];
  }
}

export interface SlotState {
  lastStart: number;
  busyUntil: number;
}

/**
 * Picks a pool slot for a note at `time`: the slot that has been free the longest if any is free,
 * otherwise the one started earliest (it gets retriggered). Slots in `exclude` are skipped.
 * Returns -1 if every slot is excluded.
 */
export function pickSlot(slots: readonly SlotState[], time: number, exclude: ReadonlySet<number> = new Set()): number {
  let free = -1;
  let oldest = -1;
  slots.forEach((s, i) => {
    if (exclude.has(i)) return;
    if (s.busyUntil <= time && (free < 0 || s.busyUntil < slots[free].busyUntil)) free = i;
    if (oldest < 0 || s.lastStart < slots[oldest].lastStart) oldest = i;
  });
  return free >= 0 ? free : oldest;
}

/** Frequency in Hz of a MIDI note (A4 = 69 = 440 Hz). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
