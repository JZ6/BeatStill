/**
 * MusicDirector: turns gameplay events and conductor ticks into note requests.
 * Pure TypeScript (no Phaser, Tone or DOM) and deterministic: the same clock readings and event
 * sequence always give the same requests. The audio engine drains the queue once per frame and
 * schedules each request at `audioNow + when`.
 *
 * Timing
 * - Tick-driven sounds (heartbeat, bar-line stingers, warning pulses): when = max(0, latency − lateBy).
 * - Events that happened on a conductor tick carry its `tick` and `lateBy` (enemy volleys fire on
 *   16th steps, player shots on their weapon's grid, boss phases, waves and level completions land
 *   on bar lines): they play at
 *   exactly that moment, when = max(0, latency − lateBy), with that tick's chord, and are never
 *   re-quantized.
 * - Other event sounds snap to the next 16th if it is at most `maxQuantizeWait` real seconds away;
 *   otherwise (deep slow-mo) they play at once (when = latency). playerDied never waits.
 * - Durations are in beats: seconds = beats·60/bpm / max(timeScale, 0.35), so slow-mo stretches a
 *   note at most ≈2.9×. Event figures (arpeggios, runs) space notes by that same bounded 16th:
 *   exactly on the grid at full speed, still recognisable in slow-mo.
 *
 * Harmony: pitches come from the chord of the bar the sound lands in: chord tones on beats,
 * chord tones or Harmony.safeScaleTones off the beat, never avoid notes. Deliberate exceptions:
 * playerHit (minor 2nd), bossWarning (♭9), bossDefeated (V→I) and levelCompleted (tonic).
 *
 * Aggregation: requests for one role whose `when` are within 5 ms merge: notes are unioned up to
 * the role's maxVoices and velocity = min(1, base + 0.12·log2(count)).
 */
import { TICKS_PER_BEAT, TICKS_PER_STEP } from "../core/Conductor";
import type { TickEvent } from "../core/Conductor";
import type { GameEventMap } from "../core/GameEvents";
import { ENEMY_DEFS } from "../objects/enemies/registry";
import { ALL_WEAPONS } from "../systems/Weapons";
import { Harmony, chordFromNumeral } from "./Harmony";
import type { Chord } from "./Harmony";
import { isPitched, registerMidi } from "./palettes";
import type { Palette, Role } from "./palettes";
import { mod, pitchClass, scalePcs } from "./theory";

type EnemyKind = GameEventMap["enemyFired"]["enemyType"];

export interface NoteRequest {
  role: Role;
  /** MIDI notes; empty for unpitched roles. */
  midi: number[];
  /** Real seconds from now (≥ 0). */
  when: number;
  /** Real seconds. */
  duration: number;
  /** 0..1. */
  velocity: number;
}

/** The part of the Conductor the director reads (a structural subset, so tests can fake it). */
export interface DirectorClock {
  bpm: number;
  timeScale: number;
  bar: number;
  beatInBar: number;
  currentTick: number;
  /** Optional; defaults to 4. */
  beatsPerBar?: number;
  realSecondsPerTick(): number;
  realSecondsUntilTick(tick: number): number;
  nextMultiple(interval: number): number;
}

export interface MusicDirectorOptions {
  /** Fixed scheduling latency in seconds (default 0.05; see setLatency). */
  latency?: number;
  /** Longest real wait (seconds) for snapping an event to the next 16th (default 0.12). */
  maxQuantizeWait?: number;
  /** Whether the heartbeat plays (default true; see setHeartbeat). */
  heartbeat?: boolean;
}

/** Longest scheduling latency setLatency accepts, in seconds. */
export const MAX_LATENCY = 0.5;

/** Enemy type → musical role, from the enemy registry. */
export const ENEMY_ROLES: Readonly<Record<EnemyKind, Role>> = Object.freeze(
  Object.fromEntries(ENEMY_DEFS.map((d) => [d.type, d.role])) as Record<EnemyKind, Role>,
);

/** Role for an enemy type; unknown types fall back to "perc". */
export function roleForEnemy(type: string): Role {
  return (ENEMY_ROLES as Readonly<Record<string, Role>>)[type] ?? "perc";
}

/** Per-weapon note length (beats) and velocity for player shots, from the weapon registry. */
export const WEAPON_ARTICULATION: Readonly<Record<string, { beats: number; velocity: number }>> = Object.freeze(
  Object.fromEntries(ALL_WEAPONS.map((w) => [w.id, { ...w.articulation }])),
);
const DEFAULT_ARTICULATION = { beats: 0.25, velocity: 0.5 };
/** Smallest interval (semitones) between a shot's melody note and its harmony notes: a minor third. */
const MIN_HARMONY_INTERVAL = 3;

export const MERGE_WINDOW = 0.005;
/** Durations stretch with slow-mo only down to this time scale. */
export const MIN_STRETCH = 0.35;
const FALLBACK_REGISTER: [number, number] = [60, 84];

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const unitScale = (timeScale: number): number => (Number.isFinite(timeScale) ? clamp(timeScale, 0, 1) : 1);

/** Drone gain 0..1: 0.25 at full speed, rising to 1 as time stops. */
export function droneLevel(timeScale: number): number {
  return 0.25 + 0.75 * Math.pow(1 - unitScale(timeScale), 1.5);
}

/** Master low-pass cutoff (Hz): exponential from ~700 Hz at timeScale 0.03 to ~18 kHz at 1. */
export function lowpassCutoff(timeScale: number): number {
  const ts = clamp(unitScale(timeScale), 0.03, 1);
  return 700 * Math.pow(18000 / 700, (ts - 0.03) / 0.97);
}

/** Ticks within the bar where the heartbeat's "lub" falls: beats 1 and 3 (just beat 1 in bars under 3 beats). */
export function heartbeatLubTicks(beatsPerBar = 4): number[] {
  return beatsPerBar >= 3 ? [0, 2 * TICKS_PER_BEAT] : [0];
}

/** True on a heartbeat "lub" tick, so visuals can pulse exactly with the sound. */
export function isHeartbeatTick(t: TickEvent, beatsPerBar = 4): boolean {
  return heartbeatLubTicks(beatsPerBar).includes(t.tickInBar);
}

/** Lowest MIDI note with pitch class `pc` at or above `from`. */
function atOrAbove(pc: number, from: number): number {
  return from + mod(pc - pitchClass(from), 12);
}

/** Index → position bouncing between 0 and length − 1: 0 1 2 3 2 1 0 1 … */
export function pingPong(index: number, length: number): number {
  if (!(length > 1) || !Number.isFinite(index)) return 0;
  const period = 2 * (length - 1);
  const i = mod(Math.floor(index), period);
  return i < length ? i : period - i;
}

interface Slot {
  when: number;
  tick: number;
  bar: number;
  /** On a beat: chord tones only. */
  strong: boolean;
}

interface Pending {
  role: Role;
  notes: number[];
  when: number;
  duration: number;
  base: number;
  count: number;
}

interface Cursor {
  pos: number;
  dir: number;
}

/** Moves the cursor to the next candidate in its direction, bouncing off the ends. */
function stepCursor(cursor: Cursor, candidates: readonly number[]): number {
  if (candidates.length === 0) return cursor.pos;
  for (let attempt = 0; attempt < 2; attempt++) {
    const next =
      cursor.dir > 0
        ? candidates.find((n) => n > cursor.pos)
        : [...candidates].reverse().find((n) => n < cursor.pos);
    if (next !== undefined) {
      cursor.pos = next;
      return next;
    }
    cursor.dir = -cursor.dir;
  }
  cursor.pos = candidates[0];
  return cursor.pos;
}

type Handlers = { [K in keyof GameEventMap]: (payload: GameEventMap[K]) => void };

export class MusicDirector {
  private readonly clock: DirectorClock;
  private latency: number;
  private heartbeatOn: boolean;
  private readonly maxQuantizeWait: number;
  private _palette!: Palette;
  private _harmony!: Harmony;
  private readonly registers = new Map<Role, [number, number]>();
  private queue: Pending[] = [];
  private scheduled: { tick: number; run: (slot: Slot) => void }[] = [];
  private readonly perSlot = new Map<string, { tick: number; notes: number[] }>();
  private readonly counters = new Map<string, number>();
  private leadCursor: Cursor = { pos: -1, dir: 1 };
  private melodyCursor: Cursor = { pos: -1, dir: 1 };
  private lastAbsorbStep = -Infinity;
  private lastPickupTick = -Infinity;
  private droneBar = 0;
  private droneKey = "";
  private _droneVersion = 0;
  private _keyOffset = 0;
  private readonly handlers: Handlers;

  constructor(palette: Palette, clock: DirectorClock, options: MusicDirectorOptions = {}) {
    this.clock = clock;
    this.latency = 0.05;
    this.setLatency(options.latency ?? 0.05);
    this.heartbeatOn = options.heartbeat ?? true;
    this.maxQuantizeWait = Math.max(0, options.maxQuantizeWait ?? 0.12);
    this.handlers = this.createHandlers();
    this.setPalette(palette);
    this._droneVersion = 0;
  }

  get palette(): Palette {
    return this._palette;
  }

  get harmony(): Harmony {
    return this._harmony;
  }

  /** The scheduling latency in seconds: tick sounds play at latency − lateBy, events at latency (+ the wait for their 16th). */
  get latencySeconds(): number {
    return this.latency;
  }

  /** Changes the scheduling latency for every later request (clamped to 0..MAX_LATENCY; non-finite values are ignored). */
  setLatency(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    this.latency = clamp(seconds, 0, MAX_LATENCY);
  }

  get heartbeatEnabled(): boolean {
    return this.heartbeatOn;
  }

  /** Turns the heartbeat on or off from the next tick (the rest of the music is unaffected). */
  setHeartbeat(on: boolean): void {
    this.heartbeatOn = on;
  }

  /** Requests waiting for the next drain() (diagnostics, e.g. crash reports). */
  get queueLength(): number {
    return this.queue.length;
  }

  /** Sounds scheduled for a future tick (e.g. boss warning pulses), for diagnostics. */
  get scheduledCount(): number {
    return this.scheduled.length;
  }

  /** Increments whenever droneChord() changes (checked on bar ticks) and on palette changes. */
  get droneVersion(): number {
    return this._droneVersion;
  }

  /** Semitones the harmony is transposed from the palette's key (section modulations); 0 after setPalette. */
  get keyOffset(): number {
    return this._keyOffset;
  }

  /**
   * Transposes the harmony to `offset` semitones from the palette's key (a section change). Every
   * later note, chord and the drone (re-voiced at once) follow the new key. Non-integers are ignored.
   */
  setKeyOffset(offset: number): void {
    if (!Number.isInteger(offset) || offset === this._keyOffset) return;
    this._harmony.modulate(offset - this._keyOffset);
    this._keyOffset = offset;
    // Notes cached for the current slot were picked in the old key.
    this.perSlot.clear();
    this.updateDrone(this.currentBar());
  }

  setPalette(palette: Palette): void {
    this._palette = palette;
    this._keyOffset = 0;
    this._harmony = new Harmony({ key: palette.key, mode: palette.mode, progression: palette.progression });
    this.registers.clear();
    for (const role of Object.keys(palette.instruments) as Role[]) {
      this.registers.set(role, registerMidi(palette.instruments[role]) ?? FALLBACK_REGISTER);
    }
    this.clearState();
    this.droneBar = this.currentBar();
    this.droneKey = this.chordKey(this.droneBar);
    this._droneVersion++;
  }

  /** Clears queued and scheduled notes and all melodic state (new run or restart). */
  reset(): void {
    this.clearState();
    this.updateDrone(this.currentBar());
  }

  handleEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
    const handler = this.handlers[type] as ((p: GameEventMap[K]) => void) | undefined;
    if (handler) handler(payload);
  }

  onTick(t: TickEvent): void {
    const slot: Slot = { when: Math.max(0, this.latency - t.lateBy), tick: t.tick, bar: t.bar, strong: t.isBeat };
    if (t.isBar) this.updateDrone(t.bar);
    if (this.scheduled.length > 0) {
      const due = this.scheduled.filter((s) => s.tick <= t.tick);
      if (due.length > 0) {
        this.scheduled = this.scheduled.filter((s) => s.tick > t.tick);
        for (const s of due) s.run(slot);
      }
    }
    this.heartbeat(t, slot);
  }

  /** Returns the aggregated requests (sorted by `when`) and clears the queue. */
  drain(): NoteRequest[] {
    const out = this.queue.map((e) => ({
      role: e.role,
      midi: [...e.notes].sort((a, b) => a - b),
      when: e.when,
      duration: e.duration,
      velocity: Math.min(1, e.base + 0.12 * Math.log2(e.count)),
    }));
    this.queue = [];
    return out.sort((a, b) => a.when - b.when);
  }

  /** Root, fifth and (if it fits) octave of the current chord in the drone register. */
  droneChord(): number[] {
    const chord = this.chord(this.droneBar);
    const [lo, hi] = this.reg("drone");
    const root = atOrAbove(chord.rootPc, lo);
    const out = [root, root + mod(chord.pcs[2] - chord.rootPc, 12)];
    if (root + 12 <= hi) out.push(root + 12);
    return out;
  }

  // -------------------------------------------------------------------------------------------
  // Clock and timing
  // -------------------------------------------------------------------------------------------

  private get beatsPerBar(): number {
    const b = this.clock.beatsPerBar;
    return b !== undefined && Number.isFinite(b) ? Math.max(1, Math.floor(b)) : 4;
  }

  private get ticksPerBar(): number {
    return TICKS_PER_BEAT * this.beatsPerBar;
  }

  private bpm(): number {
    const b = this.clock.bpm;
    return Number.isFinite(b) && b > 0 ? b : this._palette.bpm;
  }

  private currentBar(): number {
    const bar = this.clock.bar;
    return Number.isFinite(bar) ? Math.max(0, Math.floor(bar)) : 0;
  }

  private beatsToSeconds(beats: number): number {
    return (beats * 60) / this.bpm() / Math.max(unitScale(this.clock.timeScale), MIN_STRETCH);
  }

  /** A 16th note in real seconds, with the same bounded slow-mo stretch as durations. */
  private stepSeconds(): number {
    return this.beatsToSeconds(0.25);
  }

  /** Where an event sound lands: the next 16th if it is close enough, else right away. */
  private eventSlot(): Slot {
    const next = this.clock.nextMultiple(TICKS_PER_STEP);
    const wait = this.clock.realSecondsUntilTick(next);
    if (Number.isFinite(wait) && wait >= 0 && wait <= this.maxQuantizeWait) {
      return {
        when: this.latency + wait,
        tick: next,
        bar: Math.floor(next / this.ticksPerBar),
        strong: next % TICKS_PER_BEAT === 0,
      };
    }
    return this.immediateSlot();
  }

  private immediateSlot(): Slot {
    const bar = this.currentBar();
    const beat = Number.isFinite(this.clock.beatInBar) ? clamp(this.clock.beatInBar, 0, this.beatsPerBar) : 0;
    return { when: this.latency, tick: bar * this.ticksPerBar + Math.floor(beat * TICKS_PER_BEAT), bar, strong: false };
  }

  /**
   * The slot of an event that happened on a conductor tick `lateBy` real seconds ago: exactly then
   * (when = max(0, latency − lateBy)), never re-quantized. Null if the event carries no lateBy.
   * Without a tick, the last emitted tick stands in for the chord lookup.
   */
  private tickSlot(timing: { tick?: number; lateBy?: number }): Slot | null {
    const { lateBy, tick } = timing;
    if (lateBy === undefined || !Number.isFinite(lateBy)) return null;
    const raw = tick !== undefined && Number.isFinite(tick) ? tick : this.clock.currentTick;
    const at = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    return {
      when: Math.max(0, this.latency - Math.max(0, lateBy)),
      tick: at,
      bar: Math.floor(at / this.ticksPerBar),
      strong: at % TICKS_PER_BEAT === 0,
    };
  }

  private schedule(tick: number, run: (slot: Slot) => void): void {
    this.scheduled.push({ tick, run });
  }

  // -------------------------------------------------------------------------------------------
  // Queue
  // -------------------------------------------------------------------------------------------

  private push(role: Role, midi: readonly number[], when: number, beats: number, velocity: number): void {
    this.pushSeconds(role, midi, when, this.beatsToSeconds(beats), velocity);
  }

  private pushSeconds(role: Role, midi: readonly number[], when: number, duration: number, velocity: number): void {
    const spec = this._palette.instruments[role];
    if (!spec) return;
    const pitched = isPitched(spec);
    const notes = pitched ? midi.filter((n) => Number.isFinite(n)).map((n) => Math.round(n)) : [];
    if (pitched && notes.length === 0) return;
    const cap = Math.max(1, Math.floor(spec.maxVoices));
    const at = Math.max(0, when);
    const base = clamp(Number.isFinite(velocity) ? velocity : 0.5, 0, 1);
    let entry = this.queue.find((e) => e.role === role && Math.abs(e.when - at) <= MERGE_WINDOW + 1e-9);
    if (entry) {
      entry.duration = Math.max(entry.duration, duration);
      entry.base = Math.max(entry.base, base);
    } else {
      entry = { role, notes: [], when: at, duration, base, count: 0 };
      this.queue.push(entry);
    }
    entry.count++;
    for (const n of notes) if (!entry.notes.includes(n) && entry.notes.length < cap) entry.notes.push(n);
  }

  // -------------------------------------------------------------------------------------------
  // Pitch helpers
  // -------------------------------------------------------------------------------------------

  private reg(role: Role): [number, number] {
    return this.registers.get(role) ?? FALLBACK_REGISTER;
  }

  private pitched(role: Role): boolean {
    const spec = this._palette.instruments[role];
    return spec !== undefined && isPitched(spec);
  }

  private maxVoices(role: Role): number {
    const v = this._palette.instruments[role]?.maxVoices;
    return v !== undefined && Number.isFinite(v) ? Math.max(1, Math.floor(v)) : 1;
  }

  private chord(bar: number): Chord {
    return this._harmony.chordAtBar(bar);
  }

  private chordKey(bar: number): string {
    return this.chord(bar).pcs.join(",");
  }

  private tones(bar: number, role: Role): number[] {
    const [lo, hi] = this.reg(role);
    return this._harmony.chordTones(bar, lo, hi);
  }

  private safeTones(bar: number, role: Role): number[] {
    const [lo, hi] = this.reg(role);
    return this._harmony.safeScaleTones(bar, lo, hi);
  }

  /** Lowest note of `pc` at or above `fraction` of the register (falls back to the lowest one). */
  private pcIn(pc: number, role: Role, fraction = 0): number {
    const [lo, hi] = this.reg(role);
    const n = atOrAbove(pc, Math.round(lo + (hi - lo) * fraction));
    return n > hi ? atOrAbove(pc, lo) : n;
  }

  private rootIn(bar: number, role: Role, fraction = 0): number {
    return this.pcIn(this.chord(bar).rootPc, role, fraction);
  }

  /** A chord tone from the upper half of the register; `index` cycles through them. */
  private highTone(bar: number, role: Role, index: number): number {
    const t = this.tones(bar, role);
    const upper = t.slice(Math.floor(t.length / 2));
    return upper[mod(index, upper.length)];
  }

  /** Root, third, fifth, octave of `chord` (the first `count`), anchored at `fraction` of the register. */
  private voiceChord(chord: Chord, role: Role, count: number, fraction = 0): number[] {
    const [lo, hi] = this.reg(role);
    let root = this.pcIn(chord.rootPc, role, fraction);
    const shape = [0, mod(chord.pcs[1] - chord.rootPc, 12), mod(chord.pcs[2] - chord.rootPc, 12), 12];
    const used = shape.slice(0, clamp(Math.floor(count), 1, 4));
    const top = used[used.length - 1];
    while (root + top > hi && root - 12 >= lo) root -= 12;
    return used.map((i) => root + i);
  }

  private stack(bar: number, role: Role, count: number, fraction = 0): number[] {
    return this.voiceChord(this.chord(bar), role, count, fraction);
  }

  private tonicChord(): Chord {
    const scale = scalePcs(this._harmony.keyPc, this._harmony.mode);
    const major = mod(scale[2] - scale[0], 12) === 4;
    return chordFromNumeral(major ? "I" : "i", this._harmony.keyPc, this._harmony.mode);
  }

  private next(key: string): number {
    const n = this.counters.get(key) ?? 0;
    this.counters.set(key, n + 1);
    return n;
  }

  /** Computes notes once per slot and key, so a crowd firing on one 16th shares one pitch. */
  private once(key: string, slot: Slot, make: () => number[]): number[] {
    const prev = this.perSlot.get(key);
    if (prev && prev.tick === slot.tick) return prev.notes;
    const notes = make();
    this.perSlot.set(key, { tick: slot.tick, notes });
    return notes;
  }

  /** Steps a melodic cursor: chord tones on strong slots, safe scale tones on weak ones. */
  private walk(cursor: Cursor, slot: Slot, role: Role): number {
    return stepCursor(cursor, slot.strong ? this.tones(slot.bar, role) : this.safeTones(slot.bar, role));
  }

  private clearState(): void {
    this.queue = [];
    this.scheduled = [];
    this.perSlot.clear();
    this.counters.clear();
    this.leadCursor = { pos: -1, dir: 1 };
    this.melodyCursor = { pos: -1, dir: 1 };
    this.lastAbsorbStep = -Infinity;
    this.lastPickupTick = -Infinity;
  }

  private updateDrone(bar: number): void {
    this.droneBar = bar;
    const key = this.chordKey(bar);
    if (key !== this.droneKey) {
      this.droneKey = key;
      this._droneVersion++;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Tick-driven sounds
  // -------------------------------------------------------------------------------------------

  /** Lub on beats 1 and 3, dub a 16th later and softer. Louder as time slows. Silent while switched off. */
  private heartbeat(t: TickEvent, slot: Slot): void {
    if (!this.heartbeatOn) return;
    const lubs = heartbeatLubTicks(this.beatsPerBar);
    const lub = 0.45 + 0.3 * (1 - unitScale(this.clock.timeScale));
    for (const at of lubs) {
      if (t.tickInBar === at) {
        this.push("heart", [this.rootIn(t.bar, "heart")], slot.when, 0.25, lub);
      } else if (t.tickInBar === at + TICKS_PER_STEP) {
        this.push("heart", [this.rootIn(t.bar, "heart")], slot.when, 0.2, lub * 0.6);
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------------------------

  private createHandlers(): Handlers {
    return {
      playerFired: (p) => this.playerFired(p),
      enemyFired: (p) => this.enemyFired(p),
      enemyHit: (p) => {
        const slot = this.eventSlot();
        const notes = this.once("hit", slot, () => [this.highTone(slot.bar, "perc", this.next("hit"))]);
        const weight = p.maxHp > 0 ? clamp(p.damage / p.maxHp, 0, 1) : 0;
        this.push("perc", notes, slot.when, 0.12, 0.32 + 0.1 * weight);
      },
      enemyKilled: (p) => this.enemyKilled(p),
      chainBreak: (p) => {
        if (!(p.tier >= 2)) return;
        const slot = this.eventSlot();
        const t = this.tones(slot.bar, "stab");
        const i = clamp(Math.floor(t.length * 0.6), 1, t.length - 1);
        this.push("stab", [t[i]], slot.when, 0.25, 0.45);
        this.push("stab", [t[i - 1]], slot.when + this.stepSeconds(), 0.4, 0.38);
      },
      bulletClash: () => {
        const slot = this.eventSlot();
        const notes = this.once("clash", slot, () => [this.highTone(slot.bar, "metal", this.next("clash"))]);
        this.push("metal", notes, slot.when, 0.25, 0.5);
      },
      asteroidBreak: (p) => this.asteroidBreak(p),
      wallBounce: (p) => {
        const slot = this.eventSlot();
        const chord = this.chord(slot.bar);
        const pc = p.axis === "x" ? chord.rootPc : chord.pcs[2];
        this.push("perc", [this.pcIn(pc, "perc", 0.3)], slot.when, 0.1, p.owner === "player" ? 0.32 : 0.22);
      },
      wallAbsorb: () => {
        const slot = this.eventSlot();
        const step = Math.floor(slot.tick / TICKS_PER_STEP);
        if (step === this.lastAbsorbStep) return;
        this.lastAbsorbStep = step;
        this.push("perc", [this.rootIn(slot.bar, "perc")], slot.when, 0.08, 0.1);
      },
      glassCrack: (p) => {
        const slot = this.eventSlot();
        const t = this.tones(slot.bar, "bell").slice(0, 6);
        const frac = p.maxHp > 0 ? clamp(p.hp / p.maxHp, 0, 1) : 0;
        this.push("bell", [t[Math.round(frac * (t.length - 1))]], slot.when, 1, 0.45);
      },
      glassShatter: () => {
        const slot = this.eventSlot();
        const step = this.stepSeconds();
        const fall = this.tones(slot.bar, "bell").slice(0, 6).reverse().slice(0, 4);
        fall.forEach((n, i) => this.push("bell", [n], slot.when + i * step, 0.5, 0.55 - 0.05 * i));
        this.push("metal", [this.tones(slot.bar, "metal")[0]], slot.when, 1, 0.75);
      },
      playerHit: () => {
        const slot = this.eventSlot();
        const low = this.rootIn(slot.bar, "bass", 0.5);
        this.push("bass", [low, low + 1], slot.when, 0.5, 0.7);
        this.push("perc", [this.rootIn(slot.bar, "perc") + 1], slot.when, 0.15, 0.5);
      },
      playerDied: () => this.playerDied(),
      pickupCollected: (p) => {
        const slot = this.eventSlot();
        if (slot.tick - this.lastPickupTick > 2 * this.ticksPerBar) this.counters.set("pickup", 0);
        this.lastPickupTick = slot.tick;
        const t = this.tones(slot.bar, "bell");
        const notes = this.once("pickup", slot, () => [t[mod(this.next("pickup"), t.length)]]);
        this.push("bell", notes, slot.when, 1, 0.5);
        if (p.isWeapon) {
          const step = this.stepSeconds();
          this.stack(slot.bar, "lead", 3, 0.25).forEach((n, i) => this.push("lead", [n], slot.when + i * step, 0.5, 0.5));
        }
      },
      bossWarning: () => {
        // Four bass + kick pulses on the coming beats; the first carries a ♭9 above the chord root.
        const first = this.clock.nextMultiple(TICKS_PER_BEAT);
        for (let k = 0; k < 4; k++) {
          this.schedule(first + k * TICKS_PER_BEAT, (slot) => {
            this.push("bass", [this.rootIn(slot.bar, "bass")], slot.when, 0.5, 0.65);
            this.push("kick", [this.rootIn(slot.bar, "kick")], slot.when, 0.25, 0.6);
            if (k === 0) this.push("boss", [this.rootIn(slot.bar, "boss") + 13], slot.when, 2, 0.5);
          });
        }
      },
      bossPhaseChanged: (p) => {
        const stinger = (slot: Slot) => {
          const [root, , fifth, octave] = this.stack(slot.bar, "boss", 4);
          this.push("kick", [this.rootIn(slot.bar, "kick")], slot.when, 0.5, 0.8);
          this.push("boss", [root, fifth, octave], slot.when, 1, 0.75);
          this.push("metal", [this.highTone(slot.bar, "metal", 0)], slot.when, 1, 0.6);
          if (p.phase >= 2) this.push("stab", this.stack(slot.bar, "stab", 3, 0.25), slot.when, 0.5, 0.6);
        };
        // A phase that changed on a bar line (carrying its tick) is already on the downbeat.
        const slot = this.tickSlot(p);
        if (slot) stinger(slot);
        else this.schedule(this.clock.nextMultiple(this.ticksPerBar), stinger);
      },
      bossDefeated: () => {
        const slot = this.eventSlot();
        const step = this.stepSeconds();
        const dominant = chordFromNumeral("V", this._harmony.keyPc, this._harmony.mode);
        const tonic = this.tonicChord();
        this.voiceChord(dominant, "lead", 3, 0.25).forEach((n, i) => this.push("lead", [n], slot.when + i * step, 0.4, 0.6));
        const at = slot.when + 4 * step;
        this.push("lead", this.voiceChord(tonic, "lead", 4, 0.25), at, 2, 0.7);
        this.push("pad", this.voiceChord(tonic, "pad", 3), at, 3, 0.6);
        this.push("bass", [this.pcIn(tonic.rootPc, "bass")], at, 2, 0.7);
        this.push("kick", [this.pcIn(tonic.rootPc, "kick")], at, 0.5, 0.7);
      },
      // Both land on a bar line and carry its tick: they sound on that downbeat.
      waveStarted: (p) => {
        const slot = this.tickSlot(p) ?? this.eventSlot();
        this.push("bell", [this.rootIn(slot.bar, "bell")], slot.when, 1, 0.2);
      },
      levelCompleted: (p) => {
        const slot = this.tickSlot(p) ?? this.eventSlot();
        const step = this.stepSeconds();
        const tonic = this.tonicChord();
        this.voiceChord(tonic, "bell", 4).forEach((n, i) => this.push("bell", [n], slot.when + i * step, 1, 0.55));
        this.push("pad", this.voiceChord(tonic, "pad", 3), slot.when + 4 * step, 2, 0.5);
      },
    };
  }

  /**
   * The player's shots are the lead line. A shot timed on a conductor tick (held fire on the
   * weapon's grid, or a first shot on a 16th) sounds at exactly that tick, with that tick's chord;
   * an off-grid first shot takes the normal event path. The melody walks chord tones up then down
   * across shots (safe scale tones off the beat). bulletCount sets the voicing within the lead's
   * maxVoices: 1 = the melody note, 2 = a dyad, 3+ = that many chord tones.
   */
  private playerFired(p: GameEventMap["playerFired"]): void {
    const slot = this.tickSlot(p) ?? this.eventSlot();
    const art = WEAPON_ARTICULATION[p.weaponId] ?? DEFAULT_ARTICULATION;
    const [main] = this.once("lead", slot, () => [this.walk(this.leadCursor, slot, "lead")]);
    const bullets = Number.isFinite(p.bulletCount) ? Math.floor(p.bulletCount) : 1;
    const voices = clamp(bullets, 1, this.maxVoices("lead"));
    this.push("lead", [main, ...this.harmonize(slot.bar, "lead", main, voices - 1)], slot.when, art.beats, art.velocity);
  }

  /**
   * `count` chord tones to sound with `main`: the nearest ones below it, then above if the register
   * runs out. Each is at least a minor third from `main`, so an off-beat melody note (a scale tone
   * between chord tones) never forms a second with its harmony.
   */
  private harmonize(bar: number, role: Role, main: number, count: number): number[] {
    if (!(count > 0)) return [];
    const tones = this.tones(bar, role);
    const below = tones.filter((n) => n <= main - MIN_HARMONY_INTERVAL).reverse();
    const above = tones.filter((n) => n >= main + MIN_HARMONY_INTERVAL);
    return [...below, ...above].slice(0, count);
  }

  /**
   * The enemy's instrument plays its volley. Volleys fired on a step (with lateBy) sound at that
   * step's exact time; a crowd on one step merges into one request. The arp walks chord tones up
   * and down by the shooter's volley index; the melody takes the chord tone at pitchHint (0 = low,
   * 1 = high) of its register.
   */
  private enemyFired(p: GameEventMap["enemyFired"]): void {
    const role = roleForEnemy(p.enemyType);
    const slot = this.tickSlot(p) ?? this.eventSlot();
    const bar = slot.bar;
    const v = 0.4 + (p.elite ? 0.1 : 0);
    if (role === "arp" && p.index !== undefined && Number.isFinite(p.index)) {
      const t = this.tones(bar, role);
      return this.push(role, [t[pingPong(p.index, t.length)]], slot.when, 0.25, v);
    }
    if (role === "melody" && p.pitchHint !== undefined && Number.isFinite(p.pitchHint)) {
      const t = this.tones(bar, role);
      return this.push(role, [t[Math.round(clamp(p.pitchHint, 0, 1) * (t.length - 1))]], slot.when, 0.5, v);
    }
    switch (role) {
      case "bass":
        return this.push(role, [this.rootIn(bar, role)], slot.when, 0.5, v + 0.1);
      case "pad":
        return this.push(role, this.stack(bar, role, 3, 0.25), slot.when, 0.5, v - 0.05);
      case "stab":
        return this.push(role, this.stack(bar, role, 3, 0.25), slot.when, 0.2, v);
      case "boss": {
        const [root, , fifth] = this.stack(bar, role, 3);
        return this.push(role, [root, fifth], slot.when, 0.5, v + 0.15);
      }
      case "arp":
      case "bell": {
        const notes = this.once(role, slot, () => {
          const t = this.tones(bar, role);
          return [t[mod(this.next(role), t.length)]];
        });
        return this.push(role, notes, slot.when, role === "bell" ? 1 : 0.25, v);
      }
      case "melody":
      case "lead": {
        const cursor = role === "lead" ? this.leadCursor : this.melodyCursor;
        return this.push(role, this.once(role, slot, () => [this.walk(cursor, slot, role)]), slot.when, 0.5, v);
      }
      default: {
        const notes = this.pitched(role) ? [this.highTone(bar, role, 0)] : [];
        return this.push(role, notes, slot.when, role === "snare" ? 0.25 : 0.1, v - 0.05);
      }
    }
  }

  /** The enemy's role resolves on chord tones; chain tier adds voices (1, 2, 3, then triad + octave + bass root). */
  private enemyKilled(p: GameEventMap["enemyKilled"]): void {
    const role = roleForEnemy(p.enemyType);
    const slot = this.eventSlot();
    const tier = Number.isFinite(p.chainTier) ? Math.max(0, Math.floor(p.chainTier)) : 0;
    const voices = tier <= 1 ? 1 : Math.min(tier, 4);
    const fraction = Math.min(0.5, 0.1 * tier);
    const v = 0.55 + (p.elite ? 0.1 : 0) + (p.isBoss ? 0.2 : 0);
    if (this.pitched(role)) {
      this.push(role, this.stack(slot.bar, role, voices, fraction), slot.when, 0.75, v);
    } else {
      this.push(role, [], slot.when, 0.25, v);
      this.push("perc", this.stack(slot.bar, "perc", voices, fraction), slot.when, 0.5, v);
    }
    if (tier >= 4) this.push("bass", [this.rootIn(slot.bar, "bass")], slot.when, 1, v);
  }

  /** Size picks the register: large = low root (+ kick), medium = mid 3rd/5th, small = high bell. */
  private asteroidBreak(p: GameEventMap["asteroidBreak"]): void {
    const slot = this.eventSlot();
    const bar = slot.bar;
    if (p.size === "large") {
      this.push("bass", [this.rootIn(bar, "bass")], slot.when, 0.75, 0.6);
      this.push("kick", [this.rootIn(bar, "kick")], slot.when, 0.25, 0.5);
    } else if (p.size === "medium") {
      const pc = this.chord(bar).pcs[1 + (this.next("asteroid") % 2)];
      this.push("arp", [this.pcIn(pc, "arp")], slot.when, 0.4, 0.45);
    } else {
      this.push("bell", [this.highTone(bar, "bell", this.next("asteroidSmall"))], slot.when, 0.5, 0.35);
    }
  }

  /** Immediate descending run of safe tones with a real-time ritardando, plus a low root. */
  private playerDied(): void {
    this.scheduled = [];
    const bar = this.currentBar();
    const [lo, hi] = this.reg("lead");
    const ceiling = lo + (hi - lo) * 0.75;
    const run = this.safeTones(bar, "lead")
      .filter((n) => n <= ceiling)
      .reverse()
      .slice(0, 7);
    const gap = 60 / this.bpm() / 4;
    let at = this.latency;
    run.forEach((n, i) => {
      this.push("lead", [n], at, 0.5, 0.6 - 0.04 * i);
      at += gap * (1 + 0.25 * i);
    });
    this.push("bass", [this.rootIn(bar, "bass")], this.latency, 2, 0.6);
  }
}
