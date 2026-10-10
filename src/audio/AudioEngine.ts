/**
 * The Tone.js audio engine: one instrument per palette role, a master bus, effect sends and a
 * real-time drone. Notes arrive as MusicDirector NoteRequests and are scheduled at absolute
 * AudioContext times (`currentTime + when`); the Tone Transport is not used.
 *
 * Graph
 *   instruments ─► music bus ─► lowpass (follows timeScale) ─┐
 *        ├─ reverb send ─► reverb ─► return ─► music bus     │
 *        └─ delay send  ─► delay  ─► return ─► music bus     ├─► pause gain ─► compressor ─► limiter(-1 dB) ─► volume ─► destination
 *   drone voices ─► drone gain (follows timeScale) ─► gentle lowpass ─┘
 *
 * Every setter may be called before start(): the state is kept and applied once the graph exists.
 * Dropped notes and errors are counted in stats(), and the first of each kind is console.debug'ed.
 */
import * as Tone from "tone";
import { ROLES, isPitched, registerMidi } from "../music/palettes";
import type { Palette, Role } from "../music/palettes";
import { droneLevel, lowpassCutoff } from "../music/MusicDirector";
import type { NoteRequest } from "../music/MusicDirector";
import { createHeldInstrument, createInstrument } from "./Instruments";
import type { EngineInstrument, HeldInstrument } from "./Instruments";
import { midiToHz } from "./voiceMath";

export interface AudioEngineStats {
  started: boolean;
  contextState: string;
  /** Notes handed to Tone since the page loaded. */
  scheduled: number;
  /** Notes not played (voice caps, late starts, missing instruments, not started). */
  dropped: number;
  /** Unexpected exceptions while building or playing. */
  errors: number;
  palette: string | null;
}

/** Drone gain at droneLevel() = 1 (the palette's drone volume already sets its loudness). */
const DRONE_MAX = 1;
const DRONE_VELOCITY = 0.7;
const DRONE_FILTER_HZ = 2500;
/** setTargetAtTime constant for time-scale following: settles in ≈ 0.1 s. */
const FOLLOW_TIME_CONSTANT = 0.03;
const PAUSE_RAMP = 0.08;
const VOLUME_RAMP = 0.05;
/** Volume 0 ramps to this (inaudible) instead of -Infinity, which can't be ramped. */
const MUTE_DB = -120;
const REVERB_RETURN = 0.7;
const DELAY_RETURN = 0.6;
/** A retired palette is disposed this long after its release starts (covers notes scheduled ahead). */
const RETIRE_EXTRA_S = 2;
const RETIRE_MAX_S = 6;

interface Graph {
  musicBus: Tone.Gain;
  lowpass: Tone.Filter;
  reverb: Tone.Reverb;
  delay: Tone.FeedbackDelay;
  droneGain: Tone.Gain;
  pauseGain: Tone.Gain;
  volume: Tone.Volume;
}

interface Voice {
  instrument: EngineInstrument;
  sends: Tone.Gain[];
  pitched: boolean;
  /** Played by pitched voices when a request has no notes. */
  fallbackMidi: number;
}

interface Kit {
  palette: Palette;
  voices: Map<Role, Voice>;
  drone: HeldInstrument | null;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function uniqueNotes(midi: readonly number[]): number[] {
  const out = [...new Set(midi.filter((n) => Number.isFinite(n)).map((n) => Math.round(n)))];
  return out.sort((a, b) => a - b);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class AudioEngine {
  private graph: Graph | null = null;
  private startPromise: Promise<void> | null = null;
  private kit: Kit | null = null;
  private wantedPalette: Palette | null = null;
  private timeScale = 1;
  private paused = false;
  private volume = 1;
  private wantedDrone: number[] = [];
  private heldDrone: number[] = [];
  private lastCutoff = -1;
  private lastDroneGain = -1;
  private scheduled = 0;
  private dropped = 0;
  private errors = 0;
  private readonly reported = new Set<string>();

  /** True once the graph is built and the AudioContext has been resumed. */
  get started(): boolean {
    return this.graph !== null;
  }

  /** The palette the engine plays (or will build on start). */
  get palette(): Palette | null {
    return this.kit?.palette ?? this.wantedPalette;
  }

  /**
   * Resumes the AudioContext (call from a user gesture) and builds the graph once.
   * Safe to call repeatedly or concurrently; a failed start can be retried.
   */
  start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    const promise = this.boot();
    this.startPromise = promise;
    promise.catch(() => {
      if (this.startPromise === promise) this.startPromise = null;
    });
    return promise;
  }

  /** Switches instruments to `palette` (kept until start() if not started yet). */
  setPalette(palette: Palette): void {
    this.wantedPalette = palette;
    if (!this.graph || this.kit?.palette.id === palette.id) return;
    this.buildKit(palette);
  }

  /** Schedules a director request at `currentTime + req.when`. */
  play(req: NoteRequest): void {
    const kit = this.kit;
    if (!this.graph || !kit) {
      this.drop("not-started", Math.max(1, req.midi.length));
      return;
    }
    const voice = kit.voices.get(req.role);
    if (!voice) {
      this.drop(`no-instrument:${req.role}`, Math.max(1, req.midi.length));
      return;
    }
    try {
      const now = this.now();
      const time = now + (Number.isFinite(req.when) ? Math.max(0, req.when) : 0);
      const midi = voice.pitched ? req.midi.filter((n) => Number.isFinite(n)) : [];
      const freqs = voice.pitched ? (midi.length > 0 ? midi : [voice.fallbackMidi]).map(midiToHz) : [];
      const duration = Number.isFinite(req.duration) && req.duration > 0 ? req.duration : 0.1;
      const velocity = Number.isFinite(req.velocity) ? clamp(req.velocity, 0, 1) : 0.5;
      const result = voice.instrument.play(freqs, duration, time, velocity, now);
      this.scheduled += result.scheduled;
      if (result.dropped > 0) this.drop(`voices:${req.role}`, result.dropped);
    } catch (err) {
      this.fail(`play:${req.role}`, err);
    }
  }

  /** Follows the world's time scale: the lowpass closes and the drone swells as time slows. */
  setTimeScale(timeScale: number): void {
    this.timeScale = Number.isFinite(timeScale) ? clamp(timeScale, 0, 1) : 1;
    if (this.graph) this.applyTimeScale(this.graph, false);
  }

  /** Re-voices the drone: notes no longer wanted release, new ones attack, common tones sustain. */
  setDrone(midi: readonly number[]): void {
    this.wantedDrone = uniqueNotes(midi);
    if (this.graph) this.applyDrone();
  }

  /** Ramps everything (music and drone) to silence or back over ~80 ms. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    const g = this.graph;
    if (g) g.pauseGain.gain.rampTo(paused ? 0 : 1, PAUSE_RAMP, this.now());
  }

  /** Master volume 0..1 (ramped); 0 mutes. */
  setVolume(fraction: number): void {
    this.volume = Number.isFinite(fraction) ? clamp(fraction, 0, 1) : 1;
    const g = this.graph;
    if (g) g.volume.volume.rampTo(this.volumeDb(), VOLUME_RAMP, this.now());
  }

  /** Releases every sounding note and the drone (e.g. on a scene change). */
  releaseAll(): void {
    this.wantedDrone = [];
    this.heldDrone = [];
    const kit = this.kit;
    if (!this.graph || !kit) return;
    const now = this.now();
    for (const [role, voice] of kit.voices) {
      try {
        voice.instrument.releaseAll(now);
      } catch (err) {
        this.fail(`release:${role}`, err);
      }
    }
  }

  stats(): AudioEngineStats {
    let contextState = "unknown";
    try {
      contextState = Tone.getContext().state;
    } catch {
      contextState = "unavailable";
    }
    return {
      started: this.started,
      contextState,
      scheduled: this.scheduled,
      dropped: this.dropped,
      errors: this.errors,
      palette: this.palette?.id ?? null,
    };
  }

  // -------------------------------------------------------------------------------------------

  private async boot(): Promise<void> {
    // First statement, so it runs synchronously inside the caller's user gesture.
    await Tone.start();
    if (this.graph) return;
    const graph = this.buildGraph();
    await graph.reverb.ready;
    this.graph = graph;
    graph.volume.volume.value = this.volumeDb();
    graph.pauseGain.gain.value = this.paused ? 0 : 1;
    this.applyTimeScale(graph, true);
    if (this.wantedPalette) this.buildKit(this.wantedPalette);
  }

  private buildGraph(): Graph {
    const volume = new Tone.Volume(0).toDestination();
    const limiter = new Tone.Limiter(-1).connect(volume);
    const compressor = new Tone.Compressor({ threshold: -16, ratio: 3, knee: 6, attack: 0.005, release: 0.15 }).connect(limiter);
    const pauseGain = new Tone.Gain(1).connect(compressor);
    const lowpass = new Tone.Filter({ type: "lowpass", frequency: lowpassCutoff(1), rolloff: -12, Q: 0.5 }).connect(pauseGain);
    const musicBus = new Tone.Gain(1).connect(lowpass);

    const reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: 1 });
    reverb.connect(new Tone.Gain(REVERB_RETURN).connect(musicBus));
    const delay = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.3, wet: 1 });
    delay.connect(new Tone.Gain(DELAY_RETURN).connect(musicBus));

    const droneFilter = new Tone.Filter({ type: "lowpass", frequency: DRONE_FILTER_HZ, rolloff: -12, Q: 0.5 }).connect(pauseGain);
    const droneGain = new Tone.Gain(0).connect(droneFilter);
    return { musicBus, lowpass, reverb, delay, droneGain, pauseGain, volume };
  }

  private buildKit(palette: Palette): void {
    const g = this.graph;
    if (!g) return;
    const voices = new Map<Role, Voice>();
    let drone: HeldInstrument | null = null;
    for (const role of ROLES) {
      const spec = palette.instruments[role];
      if (!spec) continue;
      try {
        const fallbackMidi = registerMidi(spec)?.[0] ?? 48;
        let instrument: EngineInstrument;
        if (role === "drone") {
          drone = createHeldInstrument(spec);
          instrument = drone ?? createInstrument(spec, midiToHz(fallbackMidi));
        } else {
          instrument = createInstrument(spec, midiToHz(fallbackMidi));
        }
        instrument.channel.connect(role === "drone" ? g.droneGain : g.musicBus);
        const sends: Tone.Gain[] = [];
        if (spec.reverb && spec.reverb > 0) sends.push(this.send(instrument.channel, spec.reverb, g.reverb));
        if (spec.delay && spec.delay > 0) sends.push(this.send(instrument.channel, spec.delay, g.delay));
        voices.set(role, { instrument, sends, pitched: isPitched(spec), fallbackMidi });
      } catch (err) {
        this.fail(`build:${role}`, err);
      }
    }
    // A dotted 8th at the palette tempo.
    g.delay.delayTime.rampTo(clamp((0.75 * 60) / palette.bpm, 0.05, 0.9), 0.05, this.now());

    const old = this.kit;
    this.kit = { palette, voices, drone };
    this.heldDrone = [];
    if (old) this.retire(old);
    this.applyDrone();
  }

  private send(from: Tone.Gain, level: number, to: Tone.InputNode): Tone.Gain {
    const gain = new Tone.Gain(clamp(level, 0, 1));
    from.connect(gain);
    gain.connect(to);
    return gain;
  }

  /** Releases a replaced palette now and disposes it once its tails (and notes scheduled ahead) are done. */
  private retire(kit: Kit): void {
    const now = this.now();
    let tail = 0;
    for (const [role, voice] of kit.voices) {
      tail = Math.max(tail, voice.instrument.releaseTail);
      try {
        voice.instrument.releaseAll(now);
      } catch (err) {
        this.fail(`release:${role}`, err);
      }
    }
    const delayMs = Math.min(RETIRE_MAX_S, tail + RETIRE_EXTRA_S) * 1000;
    setTimeout(() => {
      for (const [role, voice] of kit.voices) {
        try {
          for (const s of voice.sends) s.dispose();
          voice.instrument.dispose();
        } catch (err) {
          this.fail(`dispose:${role}`, err);
        }
      }
    }, delayMs);
  }

  private applyTimeScale(g: Graph, immediate: boolean): void {
    const now = this.now();
    const cutoff = lowpassCutoff(this.timeScale);
    const gain = droneLevel(this.timeScale) * DRONE_MAX;
    if (immediate || Math.abs(cutoff - this.lastCutoff) > this.lastCutoff * 0.01) {
      if (immediate) g.lowpass.frequency.setValueAtTime(cutoff, now);
      else g.lowpass.frequency.setTargetAtTime(cutoff, now, FOLLOW_TIME_CONSTANT);
      this.lastCutoff = cutoff;
    }
    if (immediate || Math.abs(gain - this.lastDroneGain) > 0.005) {
      if (immediate) g.droneGain.gain.setValueAtTime(gain, now);
      else g.droneGain.gain.setTargetAtTime(gain, now, FOLLOW_TIME_CONSTANT);
      this.lastDroneGain = gain;
    }
  }

  private applyDrone(): void {
    const drone = this.kit?.drone ?? null;
    const next = this.wantedDrone;
    if (!drone) {
      this.heldDrone = [];
      return;
    }
    const prev = this.heldDrone;
    const off = prev.filter((n) => !next.includes(n));
    const on = next.filter((n) => !prev.includes(n));
    if (off.length === 0 && on.length === 0) return;
    const now = this.now();
    try {
      drone.unhold(off.map(midiToHz), now + 0.01);
      drone.hold(on.map(midiToHz), now + 0.02, DRONE_VELOCITY);
    } catch (err) {
      this.fail("drone", err);
    }
    this.heldDrone = next;
  }

  private volumeDb(): number {
    return this.volume <= 0 ? MUTE_DB : Math.max(MUTE_DB, Tone.gainToDb(this.volume));
  }

  private now(): number {
    return Tone.getContext().currentTime;
  }

  private drop(kind: string, count: number): void {
    this.dropped += count;
    this.reportOnce(`drop ${kind}`, `${count} note(s) dropped`);
  }

  private fail(kind: string, err: unknown): void {
    this.errors++;
    this.reportOnce(`error ${kind}`, errorText(err));
  }

  private reportOnce(kind: string, detail: string): void {
    if (this.reported.has(kind)) return;
    this.reported.add(kind);
    console.debug(`[AudioEngine] ${kind}: ${detail} (further ones are only counted)`);
  }
}

let engine: AudioEngine | null = null;

/** The app-wide engine (one AudioContext). Scenes release notes on exit but never dispose it. */
export function getAudioEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}
