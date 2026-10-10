/**
 * The Conductor is the single game clock: musical time and game time are the
 * same thing. Each frame it advances by `realDt × timeScale` seconds of game
 * time, which is `× bpm / 60` beats. Every tick crossed during the frame is
 * reported, with how long ago (in real seconds) it happened, so audio can be
 * scheduled at the exact fractional moment with a constant latency instead of
 * being quantized to frame boundaries.
 *
 * Resolution: 24 ticks per beat. A 16th note ("step") is 6 ticks, an 8th-note
 * triplet is 8 ticks, a 32nd note is 3 ticks.
 *
 * Pure TypeScript: no Phaser/Tone imports, so it is unit-testable in Node.
 */

export const TICKS_PER_BEAT = 24;
export const TICKS_PER_STEP = 6; // one 16th note
export const STEPS_PER_BEAT = TICKS_PER_BEAT / TICKS_PER_STEP;
/** Frames longer than this (tab switch, GC hitch) are clamped to avoid huge jumps. */
export const MAX_REAL_DT = 0.1;

export interface TickEvent {
  /** Absolute tick index (integer, starts at 0). */
  tick: number;
  /** Absolute beat position of this tick (tick / TICKS_PER_BEAT). */
  beat: number;
  /** Bar index (0-based). */
  bar: number;
  /** Tick index within the bar. */
  tickInBar: number;
  /** True on 16th-note boundaries. */
  isStep: boolean;
  /** True on beat boundaries. */
  isBeat: boolean;
  /** True on bar boundaries (downbeats). */
  isBar: boolean;
  /** Real seconds between the moment this tick occurred and the end of the frame (≥ 0). */
  lateBy: number;
}

export interface AdvanceResult {
  /** Real seconds this frame (after clamping; 0 while paused). */
  realDt: number;
  /** Game seconds this frame (realDt × timeScale; 0 while paused). */
  gameDt: number;
  /** Ticks crossed this frame, in order. */
  ticks: TickEvent[];
}

export interface ConductorConfig {
  bpm: number;
  beatsPerBar?: number;
  timeScale?: number;
}

export class Conductor {
  private _bpm: number;
  readonly beatsPerBar: number;
  /** Current time scale (0..1], set every frame by the time-dilation system. */
  timeScale: number;
  private pos = 0; // fractional tick position
  private lastTick = -1; // last tick index emitted
  private _paused = false;

  constructor(config: ConductorConfig) {
    this._bpm = Conductor.validBpm(config.bpm);
    this.beatsPerBar = Math.max(1, Math.floor(config.beatsPerBar ?? 4));
    this.timeScale = config.timeScale ?? 1;
  }

  private static validBpm(bpm: number): number {
    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error(`invalid bpm: ${bpm}`);
    return bpm;
  }

  get bpm(): number {
    return this._bpm;
  }

  /** Changes tempo immediately, keeping the current musical position. */
  setBpm(bpm: number): void {
    this._bpm = Conductor.validBpm(bpm);
  }

  get paused(): boolean {
    return this._paused;
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    this._paused = false;
  }

  get ticksPerBar(): number {
    return TICKS_PER_BEAT * this.beatsPerBar;
  }

  /** Fractional tick position. */
  get tickPosition(): number {
    return this.pos;
  }

  /** Fractional beat position. */
  get beat(): number {
    return this.pos / TICKS_PER_BEAT;
  }

  /** Current bar index. */
  get bar(): number {
    return Math.floor(this.pos / this.ticksPerBar);
  }

  /** Fractional beat within the current bar, in [0, beatsPerBar). */
  get beatInBar(): number {
    return (this.pos % this.ticksPerBar) / TICKS_PER_BEAT;
  }

  /** Fractional position within the current beat, in [0, 1). */
  get beatPhase(): number {
    return (this.pos % TICKS_PER_BEAT) / TICKS_PER_BEAT;
  }

  /** Last tick index that has been emitted (-1 before the first advance). */
  get currentTick(): number {
    return this.lastTick;
  }

  /** Real seconds per tick at the current tempo and time scale (Infinity when timeScale is 0). */
  realSecondsPerTick(): number {
    const ticksPerGameSecond = (this._bpm / 60) * TICKS_PER_BEAT;
    return 1 / (ticksPerGameSecond * this.timeScale);
  }

  /** Game seconds per beat (independent of time scale). */
  gameSecondsPerBeat(): number {
    return 60 / this._bpm;
  }

  /** Converts a duration in game seconds to beats. */
  gameSecondsToBeats(seconds: number): number {
    return (seconds * this._bpm) / 60;
  }

  /** Converts beats to game seconds. */
  beatsToGameSeconds(beats: number): number {
    return (beats * 60) / this._bpm;
  }

  /** Real seconds until the given absolute tick at the current tempo/time scale (≤ 0 if already passed). */
  realSecondsUntilTick(tick: number): number {
    return (tick - this.pos) * this.realSecondsPerTick();
  }

  /** The next absolute tick index (> current position) that is a multiple of `interval` ticks. */
  nextMultiple(interval: number): number {
    const i = Math.max(1, Math.floor(interval));
    return (Math.floor(this.pos / i) + 1) * i;
  }

  /** Jumps to an absolute tick position (default 0). The tick at that position will be emitted next advance. */
  reset(tick = 0): void {
    this.pos = Math.max(0, tick);
    this.lastTick = Math.ceil(this.pos) - 1;
  }

  advance(realDtSeconds: number): AdvanceResult {
    if (this._paused || !(realDtSeconds > 0)) return { realDt: 0, gameDt: 0, ticks: [] };
    const realDt = Math.min(realDtSeconds, MAX_REAL_DT);
    const scale = Math.max(0, this.timeScale);
    const gameDt = realDt * scale;
    const dTicks = gameDt * (this._bpm / 60) * TICKS_PER_BEAT;
    const from = this.pos;
    const to = from + dTicks;
    const ticks: TickEvent[] = [];
    // Epsilon absorbs float accumulation error so a tick landing exactly on a
    // frame boundary is emitted in that frame rather than the next.
    const last = Math.floor(to + 1e-9);
    const tpb = this.ticksPerBar;
    for (let k = this.lastTick + 1; k <= last; k++) {
      const fraction = dTicks > 0 ? Math.min(1, Math.max(0, (k - from) / dTicks)) : 1;
      const tickInBar = k % tpb;
      ticks.push({
        tick: k,
        beat: k / TICKS_PER_BEAT,
        bar: Math.floor(k / tpb),
        tickInBar,
        isStep: k % TICKS_PER_STEP === 0,
        isBeat: k % TICKS_PER_BEAT === 0,
        isBar: tickInBar === 0,
        lateBy: realDt * (1 - fraction),
      });
    }
    if (ticks.length > 0) this.lastTick = last;
    this.pos = to;
    return { realDt, gameDt, ticks };
  }
}
