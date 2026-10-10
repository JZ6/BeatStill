/**
 * When the player's weapon fires: on the conductor's grid, at the weapon's note value, with a
 * responsive first shot. Pure TypeScript (no Phaser), so the rules are unit-testable.
 *
 * Grid
 * - While fire is held, a shot fires on every tick that is a multiple of the effective interval
 *   (absolute grid: tick % interval === 0, so 1/4 and 1/8 weapons land on the beats). These come
 *   from the conductor's tick events and carry that tick and its lateBy, so the note can be
 *   scheduled at the exact grid time.
 *
 * Slots
 * - The grid divides time into slots [boundary, boundary + interval). A slot holds at most one
 *   shot: a shot fired anywhere in it (held, late grace, 16th fallback or immediate) "uses" it.
 *   So tapping can never beat the weapon's note value.
 *
 * First shot of a fresh press (resolved at the end of the press frame, unless a boundary crossed
 * during that frame already fired it on the grid):
 * 1. Late grace: if the slot's boundary happened at most `grace` REAL seconds ago (base
 *    BASE_FIRE_GRACE = 0.06 s, + Quick Draw) and the slot is unused, fire immediately.
 * 2. Otherwise, if the slot is already used, wait for the next boundary (no shortcut).
 * 3. Otherwise wait for the next boundary, if its predicted real wait (at the current tempo and
 *    time scale) is at most MAX_FIRST_SHOT_WAIT = 0.15 s.
 * 4. Slow motion stretches grid slots far apart in real time: if that wait is longer, fire on the
 *    next 16th step (FALLBACK_TICKS = 6) instead, if that is at most 0.15 s away.
 * 5. If even the next 16th is further than that, fire immediately.
 * Immediate shots (1, 5) are off the grid and carry no tick: their note takes the normal event
 * path. 16th-fallback shots (4) carry their step's tick and lateBy.
 * - Spacing: after an immediate or 16th first shot, a grid boundary less than half an interval
 *   later is skipped, so the first two shots are never closer than half the note value.
 * - Releasing fire cancels a first shot that is still waiting.
 */
import { TICKS_PER_STEP } from "../core/Conductor";

/** Base late-grace window for the first shot, in real seconds. Quick Draw adds to it. */
export const BASE_FIRE_GRACE = 0.06;
/** Longest real wait (seconds) for a first shot before falling back to a 16th or firing at once. */
export const MAX_FIRST_SHOT_WAIT = 0.15;
/** The finer grid a first shot falls back to when the weapon's own grid is too far away. */
export const FALLBACK_TICKS = TICKS_PER_STEP;

/** grid: on a multiple of the interval; step: a first shot on a 16th; immediate: off the grid. */
export type ShotKind = "grid" | "step" | "immediate";

export interface FireShot {
  kind: ShotKind;
  /** True for the first shot of a press; later shots while held are always "grid". */
  first: boolean;
  /** The conductor tick the shot fired on (grid and step shots). */
  tick?: number;
  /** Real seconds between that tick and the end of the frame (TickEvent.lateBy). */
  lateBy?: number;
}

/** The part of a conductor tick event the clock reads. */
export interface FireTick {
  tick: number;
  lateBy: number;
}

/** End-of-frame conductor state (a structural subset of Conductor, so tests can fake it). */
export interface FireClockView {
  tickPosition: number;
  realSecondsPerTick(): number;
}

type PressState = "none" | "new" | "waiting";

export class FireClock {
  /** Real seconds of live play (advanced by beginFrame). */
  private realNow = 0;
  private held = false;
  private interval = 1;
  /** The most recent boundary of the current interval and its real time. */
  private boundary: { tick: number; at: number } | null = null;
  /** A shot has been fired since `boundary` (the slot is used). */
  private slotUsed = false;
  private press: PressState = "none";
  /** A first shot waiting for this 16th-step tick. */
  private fallbackTick: number | null = null;
  /** Grid boundaries before this tick position are skipped (spacing after a first shot). */
  private skipBefore = -Infinity;

  /** The interval (ticks) the grid currently uses. */
  get intervalTicks(): number {
    return this.interval;
  }

  /** Whether a fresh press is still waiting for its first shot. */
  get waiting(): boolean {
    return this.press !== "none";
  }

  /**
   * Call once per live frame BEFORE this frame's ticks: whether fire is held this frame, the
   * effective interval in ticks, and the frame's real seconds (the conductor's realDt).
   */
  beginFrame(held: boolean, interval: number, realDt: number): void {
    if (realDt > 0) this.realNow += realDt;
    const next = Number.isFinite(interval) ? Math.max(1, Math.floor(interval)) : 1;
    if (next !== this.interval) {
      // Slots of the old grid mean nothing on the new one.
      this.interval = next;
      this.boundary = null;
      this.slotUsed = false;
    }
    if (held && !this.held) {
      this.press = "new";
      this.fallbackTick = null;
    } else if (!held) {
      this.press = "none";
      this.fallbackTick = null;
      this.skipBefore = -Infinity;
    }
    this.held = held;
  }

  /** Call for every conductor tick of the frame, in order. Returns the shot fired on it, if any. */
  onTick(t: FireTick): FireShot | null {
    const lateBy = Number.isFinite(t.lateBy) ? Math.max(0, t.lateBy) : 0;
    const onGrid = t.tick % this.interval === 0;
    if (onGrid) {
      this.boundary = { tick: t.tick, at: this.realNow - lateBy };
      this.slotUsed = false;
    }
    if (!this.held) return null;
    if (onGrid) {
      if (t.tick < this.skipBefore) {
        // Too close to the first shot, which stands in for this slot.
        this.slotUsed = true;
        return null;
      }
      return this.take("grid", t.tick, lateBy);
    }
    if (this.fallbackTick !== null && t.tick >= this.fallbackTick) {
      this.skipBefore = t.tick + this.interval / 2;
      return this.take("step", t.tick, lateBy);
    }
    return null;
  }

  /**
   * Call once per live frame AFTER this frame's ticks. Resolves a fresh press that the grid did
   * not already serve: returns an immediate shot, or schedules the first shot (next boundary or
   * next 16th) and returns null. `grace` is the late-grace window in real seconds.
   */
  endFrame(view: FireClockView, grace: number = BASE_FIRE_GRACE): FireShot | null {
    if (!this.held || this.press !== "new") return null;
    const pos = view.tickPosition;
    const window = Number.isFinite(grace) ? Math.max(0, grace) : BASE_FIRE_GRACE;
    // 1. Late grace: the slot's boundary just passed and nothing has fired in the slot.
    if (this.boundary && !this.slotUsed && this.realNow - this.boundary.at <= window + 1e-9) {
      return this.immediate(pos);
    }
    this.press = "waiting";
    // 2. One shot per slot: a used slot always waits for the next boundary.
    if (this.slotUsed) return null;
    const secondsPerTick = view.realSecondsPerTick();
    // 3. The next boundary is close enough in real time.
    const next = (Math.floor(pos / this.interval) + 1) * this.interval;
    if (this.withinWait(next - pos, secondsPerTick)) return null;
    // 4. Slow motion: the next 16th instead.
    const step = (Math.floor(pos / FALLBACK_TICKS) + 1) * FALLBACK_TICKS;
    if (step < next && this.withinWait(step - pos, secondsPerTick)) {
      this.fallbackTick = step;
      return null;
    }
    // 5. Both too far away: fire now.
    return this.immediate(pos);
  }

  /** Forgets all timing state (new run). */
  reset(): void {
    this.realNow = 0;
    this.held = false;
    this.boundary = null;
    this.slotUsed = false;
    this.press = "none";
    this.fallbackTick = null;
    this.skipBefore = -Infinity;
  }

  private withinWait(ticks: number, secondsPerTick: number): boolean {
    const wait = ticks * secondsPerTick;
    return Number.isFinite(wait) && wait <= MAX_FIRST_SHOT_WAIT;
  }

  private take(kind: "grid" | "step", tick: number, lateBy: number): FireShot {
    const first = this.press !== "none";
    this.press = "none";
    this.fallbackTick = null;
    this.slotUsed = true;
    return { kind, first, tick, lateBy };
  }

  private immediate(pos: number): FireShot {
    this.press = "none";
    this.fallbackTick = null;
    this.slotUsed = true;
    this.skipBefore = pos + this.interval / 2;
    return { kind: "immediate", first: true };
  }
}
