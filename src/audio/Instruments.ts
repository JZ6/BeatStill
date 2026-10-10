/**
 * Builds Tone instruments from palette InstrumentSpecs and schedules notes on them without ever
 * exceeding their polyphony or tripping Tone's "start time must be strictly greater" assertion.
 *
 * Three shapes:
 * - PolyInstrument: a PolySynth of the spec's voice class. A VoiceLedger caps notes to
 *   spec.maxVoices at every moment they would sound; excess notes are reported as dropped.
 * - MonoInstrument: one monophonic synth (maxVoices 1). Starts are kept strictly increasing.
 * - PoolInstrument: NoiseSynth / PluckSynth can't be wrapped in a PolySynth, so maxVoices
 *   instances are used round-robin, each with strictly increasing starts.
 */
import * as Tone from "tone";
import type { InstrumentKind, InstrumentSpec } from "../music/palettes";
import { VoiceLedger, monotonicStart, pickSlot } from "./voiceMath";

/** Longest delay accepted to keep one voice's starts strictly increasing; later notes are dropped. */
const MAX_BUMP = 0.12;
/** Extra seconds a voice counts as busy after its release (Tone frees it on the source's onstop event). */
const RELEASE_MARGIN = 0.1;
/** Spare PolySynth voices beyond the ledger's cap, so Tone itself never has to drop a note. */
const POLY_HEADROOM = 1;
const MIN_DURATION = 0.01;

type Options = Record<string, unknown>;
type MonoKind = Exclude<InstrumentKind, "poly" | "noise" | "pluck">;

export interface PlayResult {
  scheduled: number;
  dropped: number;
}

export interface EngineInstrument {
  /** Every voice ends here; the engine routes it to the buses and effect sends. */
  readonly channel: Tone.Gain;
  /** Seconds a note keeps sounding after its release starts. */
  readonly releaseTail: number;
  /** Notes that can sound at once (1 = a single monophonic voice). */
  readonly polyphony: number;
  /** Schedules notes (Hz; empty for unpitched) at AudioContext time `time`; `now` is the current context time. */
  play(freqs: readonly number[], duration: number, time: number, velocity: number, now: number): PlayResult;
  releaseAll(time: number): void;
  dispose(): void;
}

export interface HeldInstrument extends EngineInstrument {
  /** Starts sustained notes (no release scheduled). */
  hold(freqs: readonly number[], time: number, velocity: number): void;
  /** Releases notes started with hold(). */
  unhold(freqs: readonly number[], time: number): void;
}

interface Voiced {
  volume: { value: number };
  connect(destination: Tone.InputNode): unknown;
  dispose(): unknown;
}

interface MonoVoice extends Voiced {
  triggerAttackRelease(note: number, duration: number, time: number, velocity: number): unknown;
  triggerRelease(time?: number): unknown;
}

interface PolyVoices extends Voiced {
  triggerAttackRelease(notes: number[], duration: number, time: number, velocity: number): unknown;
  triggerAttack(notes: number[], time: number, velocity: number): unknown;
  triggerRelease(notes: number[], time: number): unknown;
  releaseAll(time?: number): unknown;
}

interface PoolVoice {
  node: Voiced;
  trigger(freq: number | undefined, duration: number, time: number, velocity: number): void;
  release(time: number): void;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Palettes are deep-frozen; give Tone its own mutable copy. */
function cloneOptions(o: Options): Options {
  const copy: Options = JSON.parse(JSON.stringify(o));
  return copy;
}

function releaseOf(spec: InstrumentSpec): number {
  const o = spec.options;
  const env = o.envelope;
  const r = spec.kind === "pluck" ? o.release : isRecord(env) ? env.release : undefined;
  return typeof r === "number" && Number.isFinite(r) && r >= 0 ? r : 0.5;
}

function makeMono(kind: MonoKind, o: Options): MonoVoice {
  switch (kind) {
    case "synth":
      return new Tone.Synth(o as ConstructorParameters<typeof Tone.Synth>[0]);
    case "mono":
      return new Tone.MonoSynth(o as ConstructorParameters<typeof Tone.MonoSynth>[0]);
    case "fm":
      return new Tone.FMSynth(o as ConstructorParameters<typeof Tone.FMSynth>[0]);
    case "am":
      return new Tone.AMSynth(o as ConstructorParameters<typeof Tone.AMSynth>[0]);
    case "membrane":
      return new Tone.MembraneSynth(o as ConstructorParameters<typeof Tone.MembraneSynth>[0]);
    case "metal":
      return new Tone.MetalSynth(o as ConstructorParameters<typeof Tone.MetalSynth>[0]);
  }
}

function makePoly(kind: MonoKind | "poly", o: Options, maxPolyphony: number): PolyVoices {
  switch (kind) {
    case "poly":
    case "synth":
      return new Tone.PolySynth<Tone.Synth>({ voice: Tone.Synth, maxPolyphony, options: o as Tone.PolySynthOptions<Tone.Synth>["options"] });
    case "mono":
      return new Tone.PolySynth<Tone.MonoSynth>({ voice: Tone.MonoSynth, maxPolyphony, options: o as Tone.PolySynthOptions<Tone.MonoSynth>["options"] });
    case "fm":
      return new Tone.PolySynth<Tone.FMSynth>({ voice: Tone.FMSynth, maxPolyphony, options: o as Tone.PolySynthOptions<Tone.FMSynth>["options"] });
    case "am":
      return new Tone.PolySynth<Tone.AMSynth>({ voice: Tone.AMSynth, maxPolyphony, options: o as Tone.PolySynthOptions<Tone.AMSynth>["options"] });
    case "membrane":
      return new Tone.PolySynth<Tone.MembraneSynth>({ voice: Tone.MembraneSynth, maxPolyphony, options: o as Tone.PolySynthOptions<Tone.MembraneSynth>["options"] });
    case "metal":
      return new Tone.PolySynth<Tone.MetalSynth>({ voice: Tone.MetalSynth, maxPolyphony, options: o as Tone.PolySynthOptions<Tone.MetalSynth>["options"] });
  }
}

function makePoolVoice(kind: "noise" | "pluck", o: Options): PoolVoice {
  if (kind === "noise") {
    const s = new Tone.NoiseSynth(o as ConstructorParameters<typeof Tone.NoiseSynth>[0]);
    return {
      node: s,
      trigger: (_freq, duration, time, velocity) => s.triggerAttackRelease(duration, time, velocity),
      release: (time) => s.triggerRelease(time),
    };
  }
  const s = new Tone.PluckSynth(o as ConstructorParameters<typeof Tone.PluckSynth>[0]);
  return {
    node: s,
    // PluckSynth ignores velocity.
    trigger: (freq, duration, time) => s.triggerAttackRelease(freq ?? 220, duration, time),
    release: (time) => s.triggerRelease(time),
  };
}

function attach(node: Voiced, spec: InstrumentSpec, channel: Tone.Gain): void {
  node.volume.value = spec.volume;
  node.connect(channel);
}

class PolyInstrument implements HeldInstrument {
  readonly channel = new Tone.Gain(1);
  readonly releaseTail: number;
  readonly polyphony: number;
  private readonly ledger: VoiceLedger;

  constructor(
    private readonly voices: PolyVoices,
    spec: InstrumentSpec,
    capacity: number,
  ) {
    this.releaseTail = releaseOf(spec);
    this.ledger = new VoiceLedger(capacity);
    this.polyphony = this.ledger.capacity;
    attach(voices, spec, this.channel);
  }

  play(freqs: readonly number[], duration: number, time: number, velocity: number, now: number): PlayResult {
    if (freqs.length === 0) return { scheduled: 0, dropped: 1 };
    this.ledger.prune(now);
    // PolySynth takes a voice as soon as the start is within its context's lookAhead.
    const from = Math.max(now, time - this.channel.context.lookAhead);
    const end = time + duration + this.releaseTail + RELEASE_MARGIN;
    const fit = this.ledger.fit(from, end, freqs.length);
    if (fit <= 0) return { scheduled: 0, dropped: freqs.length };
    this.voices.triggerAttackRelease(freqs.slice(0, fit), Math.max(MIN_DURATION, duration), time, velocity);
    this.ledger.add(from, end, fit);
    return { scheduled: fit, dropped: freqs.length - fit };
  }

  hold(freqs: readonly number[], time: number, velocity: number): void {
    if (freqs.length > 0) this.voices.triggerAttack([...freqs], time, velocity);
  }

  unhold(freqs: readonly number[], time: number): void {
    if (freqs.length > 0) this.voices.triggerRelease([...freqs], time);
  }

  releaseAll(time: number): void {
    this.voices.releaseAll(time);
  }

  dispose(): void {
    this.voices.dispose();
    this.channel.dispose();
  }
}

class MonoInstrument implements EngineInstrument {
  readonly channel = new Tone.Gain(1);
  readonly releaseTail: number;
  readonly polyphony = 1;
  private lastStart = -Infinity;

  constructor(
    private readonly voice: MonoVoice,
    spec: InstrumentSpec,
    private readonly fallbackHz: number,
  ) {
    this.releaseTail = releaseOf(spec);
    attach(voice, spec, this.channel);
  }

  play(freqs: readonly number[], duration: number, time: number, velocity: number): PlayResult {
    const wanted = Math.max(1, freqs.length);
    const start = monotonicStart(this.lastStart, time, MAX_BUMP);
    if (start === null) return { scheduled: 0, dropped: wanted };
    this.voice.triggerAttackRelease(freqs[0] ?? this.fallbackHz, Math.max(MIN_DURATION, duration), start, velocity);
    this.lastStart = start;
    return { scheduled: 1, dropped: wanted - 1 };
  }

  releaseAll(time: number): void {
    this.voice.triggerRelease(Math.max(time, this.lastStart + 0.001));
  }

  dispose(): void {
    this.voice.dispose();
    this.channel.dispose();
  }
}

class PoolInstrument implements EngineInstrument {
  readonly channel = new Tone.Gain(1);
  readonly releaseTail: number;
  readonly polyphony: number;
  private readonly slots: { voice: PoolVoice; lastStart: number; busyUntil: number }[];

  constructor(kind: "noise" | "pluck", spec: InstrumentSpec) {
    this.releaseTail = releaseOf(spec);
    const count = Math.max(1, Math.floor(spec.maxVoices));
    this.polyphony = count;
    this.slots = [];
    for (let i = 0; i < count; i++) {
      const voice = makePoolVoice(kind, cloneOptions(spec.options));
      attach(voice.node, spec, this.channel);
      this.slots.push({ voice, lastStart: -Infinity, busyUntil: -Infinity });
    }
  }

  play(freqs: readonly number[], duration: number, time: number, velocity: number): PlayResult {
    const notes: (number | undefined)[] = freqs.length > 0 ? [...freqs] : [undefined];
    const used = new Set<number>();
    const dur = Math.max(MIN_DURATION, duration);
    let scheduled = 0;
    for (const freq of notes) {
      const i = pickSlot(this.slots, time, used);
      if (i < 0) break;
      used.add(i);
      const slot = this.slots[i];
      const start = monotonicStart(slot.lastStart, time, MAX_BUMP);
      if (start === null) continue;
      slot.voice.trigger(freq, dur, start, velocity);
      slot.lastStart = start;
      slot.busyUntil = start + dur + this.releaseTail;
      scheduled++;
    }
    return { scheduled, dropped: notes.length - scheduled };
  }

  releaseAll(time: number): void {
    for (const s of this.slots) {
      if (s.busyUntil > time) s.voice.release(Math.max(time, s.lastStart + 0.001));
    }
  }

  dispose(): void {
    for (const s of this.slots) s.voice.node.dispose();
    this.channel.dispose();
  }
}

/** Builds the instrument for a spec. `fallbackHz` is played by pitched voices given no notes. */
export function createInstrument(spec: InstrumentSpec, fallbackHz: number): EngineInstrument {
  const kind = spec.kind;
  const voices = Math.max(1, Math.floor(spec.maxVoices));
  if (kind === "noise" || kind === "pluck") return new PoolInstrument(kind, spec);
  const options = cloneOptions(spec.options);
  if (kind === "poly" || voices > 1) {
    return new PolyInstrument(makePoly(kind, options, voices + POLY_HEADROOM), spec, voices);
  }
  return new MonoInstrument(makeMono(kind, options), spec, fallbackHz);
}

/**
 * Builds a polyphonic instrument that can also sustain held notes (the drone), with room for
 * old notes releasing while new ones attack. Returns null for kinds that can't be polyphonic.
 */
export function createHeldInstrument(spec: InstrumentSpec): HeldInstrument | null {
  if (spec.kind === "noise" || spec.kind === "pluck") return null;
  const voices = Math.max(1, Math.floor(spec.maxVoices));
  return new PolyInstrument(makePoly(spec.kind, cloneOptions(spec.options), Math.max(8, voices * 4)), spec, voices);
}
