import { Conductor, type TickEvent } from "../core/Conductor";
import { MusicDirector } from "../music/MusicDirector";
import { registerMidi, type Palette } from "../music/palettes";
import { getAudioEngine } from "./AudioEngine";
import { MusicDriver } from "./MusicDriver";

const PAD_VELOCITY = 0.45;
const FALLBACK_PAD: [number, number] = [48, 72];

/**
 * Auditions a palette (e.g. a level's song settings) outside a run, for a few bars: its own
 * Conductor at time scale 1, a MusicDirector for the heartbeat and the drone (which follows the
 * chords), and a pad chord on every bar line, driven by requestAnimationFrame. Stops by itself after
 * `bars` bars, or on stop(); either way every note is released and `onEnd` is called once.
 */
export class PreviewMusic {
  private readonly conductor: Conductor;
  private readonly director: MusicDirector;
  private readonly driver: MusicDriver;
  private readonly engine = getAudioEngine();
  private raf: number | null = null;
  private lastFrame: number | null = null;
  private stopped = false;

  constructor(
    private readonly palette: Palette,
    private readonly bars = 4,
    private readonly onEnd?: () => void,
  ) {
    this.conductor = new Conductor({ bpm: palette.bpm, timeScale: 1 });
    this.director = new MusicDirector(palette, this.conductor);
    this.driver = new MusicDriver(this.director, this.engine);
  }

  /** Starts audio (call from a click: browsers need a gesture) and plays from the downbeat. */
  async start(): Promise<void> {
    this.engine.setPalette(this.palette);
    try {
      await this.engine.start();
    } catch (err) {
      console.warn("[PreviewMusic] audio did not start:", err instanceof Error ? err.message : err);
      this.stop();
      return;
    }
    if (this.stopped) return;
    this.engine.setPaused(false);
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.director.reset();
    this.engine.releaseAll();
    this.onEnd?.();
  }

  private readonly frame = (now: number): void => {
    if (this.stopped) return;
    const realDt = this.lastFrame === null ? 0 : (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    // The first frame has no elapsed time: a tiny step emits tick 0, so the downbeat sounds at once.
    const { ticks } = this.conductor.advance(realDt > 0 ? realDt : 1e-6);
    for (const t of ticks) {
      if (t.bar >= this.bars) {
        this.driver.update(1);
        this.stop();
        return;
      }
      this.director.onTick(t);
      if (t.isBar) this.playPad(t);
    }
    this.driver.update(1);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** The bar's chord in the bottom octave of the pad register, held for the bar. */
  private playPad(t: TickEvent): void {
    const [lo] = registerMidi(this.palette.instruments.pad) ?? FALLBACK_PAD;
    const midi = this.director.harmony.chordTones(t.bar, lo, lo + 12);
    const barSeconds = this.conductor.beatsToGameSeconds(this.conductor.beatsPerBar);
    // The director's latency (Options → Audio Latency), so the pad lands with the heartbeat.
    const when = Math.max(0, this.director.latencySeconds - t.lateBy);
    this.engine.play({ role: "pad", midi, when, duration: barSeconds * 0.95, velocity: PAD_VELOCITY });
  }
}
