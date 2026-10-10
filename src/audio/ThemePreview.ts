import { Conductor, TICKS_PER_BEAT, type TickEvent } from "../core/Conductor";
import { MusicDirector } from "../music/MusicDirector";
import { registerMidi, type Palette, type Role } from "../music/palettes";
import { arpeggioNotes, noteAtOrAbove } from "../music/previewPhrase";
import { latencySeconds, options } from "../systems/GameOptions";
import { getAudioEngine } from "./AudioEngine";

/** Phrase length in bars (at time scale 1). */
export const PREVIEW_BARS = 2;
/** Each progression chord lasts half a bar, so a 4-chord progression fits the 2-bar phrase. */
const TICKS_PER_CHORD = 2 * TICKS_PER_BEAT;
/** The arpeggio moves in 8th notes: root, third, fifth, octave (or seventh) per chord. */
const TICKS_PER_ARP_NOTE = TICKS_PER_BEAT / 2;
const ARP_VELOCITY = 0.55;
const BASS_VELOCITY = 0.5;
const FALLBACK_REGISTER: [number, number] = [48, 72];

let current: ThemePreview | null = null;

/** True while a theme preview plays (the menu's own music yields to it). */
export function themePreviewActive(): boolean {
  return current !== null;
}

/** The palette id of the preview that is playing, or null. */
export function themePreviewId(): string | null {
  return current?.palette.id ?? null;
}

/** Stops the playing preview, if any (e.g. when the collection closes). */
export function stopThemePreview(): void {
  current?.stop();
}

/**
 * A short audition of a sound theme for the collection: a 2-bar phrase at time scale 1 with the
 * heartbeat (if enabled) and an 8th-note arpeggio through the palette's progression (one chord per
 * half bar, with its bass root). Only one plays at a time: starting one stops the previous one.
 * The engine plays the theme's instruments for the phrase and gets its previous palette back after.
 */
export class ThemePreview {
  private readonly conductor: Conductor;
  private readonly director: MusicDirector;
  private readonly engine = getAudioEngine();
  private previous: Palette | null = null;
  private raf: number | null = null;
  private lastFrame: number | null = null;
  private stopped = false;

  /** Stops any playing preview and starts `palette`'s (call from a click: browsers need a gesture). */
  static play(palette: Palette, onEnd?: () => void): ThemePreview {
    stopThemePreview();
    const preview = new ThemePreview(palette, onEnd);
    current = preview;
    void preview.start();
    return preview;
  }

  private constructor(
    readonly palette: Palette,
    private readonly onEnd?: () => void,
  ) {
    this.conductor = new Conductor({ bpm: palette.bpm, timeScale: 1 });
    this.director = new MusicDirector(palette, this.conductor, {
      latency: latencySeconds(options.audioLatencyMs),
      heartbeat: options.heartbeat,
    });
  }

  get playing(): boolean {
    return !this.stopped;
  }

  private async start(): Promise<void> {
    this.previous = this.engine.palette;
    // Synchronous up to engine.start(), so it runs inside the click.
    this.engine.setDrone([]);
    this.engine.setPalette(this.palette);
    this.engine.setTimeScale(1);
    try {
      await this.engine.start();
    } catch (err) {
      console.warn("[ThemePreview] audio did not start:", err instanceof Error ? err.message : err);
      this.stop();
      return;
    }
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Ends the phrase now: releases its notes and gives the engine its previous palette back. Idempotent. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (current === this) current = null;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.director.reset();
    this.engine.releaseAll();
    const previous = this.previous;
    if (previous && previous.id !== this.palette.id) this.engine.setPalette(previous);
    this.onEnd?.();
  }

  private readonly frame = (now: number): void => {
    if (this.stopped) return;
    const realDt = this.lastFrame === null ? 0 : (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    // The first frame has no elapsed time: a tiny step emits tick 0, so the downbeat sounds at once.
    const { ticks } = this.conductor.advance(realDt > 0 ? realDt : 1e-6);
    for (const t of ticks) {
      if (t.bar >= PREVIEW_BARS) {
        this.flush();
        this.stop();
        return;
      }
      this.director.onTick(t);
      this.phraseTick(t);
    }
    this.flush();
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Plays the director's heartbeat requests. */
  private flush(): void {
    if (!this.engine.started) return;
    for (const req of this.director.drain()) this.engine.play(req);
  }

  private phraseTick(t: TickEvent): void {
    if (t.tick % TICKS_PER_ARP_NOTE !== 0) return;
    const chordIndex = Math.floor(t.tick / TICKS_PER_CHORD);
    const step = Math.floor((t.tick % TICKS_PER_CHORD) / TICKS_PER_ARP_NOTE);
    const when = Math.max(0, this.director.latencySeconds - t.lateBy);
    const beat = this.conductor.beatsToGameSeconds(1);
    const harmony = this.director.harmony;
    const arp = arpeggioNotes(harmony, chordIndex, this.register("arp"));
    if (arp.length > 0) {
      this.engine.play({ role: "arp", midi: [arp[step % arp.length]], when, duration: beat * 0.45, velocity: ARP_VELOCITY });
    }
    if (step === 0) {
      const root = noteAtOrAbove(harmony.chordAtBar(chordIndex).rootPc, this.register("bass")[0]);
      this.engine.play({ role: "bass", midi: [root], when, duration: beat * 1.8, velocity: BASS_VELOCITY });
    }
  }

  private register(role: Role): [number, number] {
    const spec = this.palette.instruments[role];
    return (spec && registerMidi(spec)) ?? FALLBACK_REGISTER;
  }
}
