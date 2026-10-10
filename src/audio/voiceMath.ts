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

export interface Claim {
  /** False when every note is already triggered at that moment (nothing to play). */
  play: boolean;
  /** Start time: an existing hit's time if the request merged into it. */
  time: number;
  /** Notes not yet triggered at that moment (empty for unpitched hits). */
  notes: number[];
  /** Requested notes (or 1 unpitched hit) that were already triggered there. */
  merged: number;
  /** True when the request landed on an existing hit. */
  joined: boolean;
}

/**
 * Remembers one role's recent hits so requests that land on the same moment (within `window`
 * seconds) become a single trigger, even when they arrive in different frames: duplicate notes
 * are skipped and new ones join the earlier hit's start time.
 */
export class HitMerger {
  private hits: { time: number; notes: number[] }[] = [];

  constructor(readonly window: number) {}

  /** `notes` empty = an unpitched hit. `now` is the current context time (requests are never earlier). */
  claim(time: number, notes: readonly number[], now: number): Claim {
    if (this.hits.some((h) => h.time < now - this.window)) {
      this.hits = this.hits.filter((h) => h.time >= now - this.window);
    }
    const hit = this.hits.find((h) => Math.abs(h.time - time) <= this.window);
    if (!hit) {
      this.hits.push({ time, notes: [...notes] });
      return { play: true, time, notes: [...notes], merged: 0, joined: false };
    }
    if (notes.length === 0) return { play: false, time: hit.time, notes: [], merged: 1, joined: true };
    const fresh = notes.filter((n) => !hit.notes.includes(n));
    hit.notes.push(...fresh);
    return { play: fresh.length > 0, time: hit.time, notes: fresh, merged: notes.length - fresh.length, joined: true };
  }

  clear(): void {
    this.hits = [];
  }
}

/** Frequency in Hz of a MIDI note (A4 = 69 = 440 Hz). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
