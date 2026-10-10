import { Conductor, type TickEvent } from "../core/Conductor";
import { MusicDirector, isHeartbeatTick } from "../music/MusicDirector";
import type { Palette } from "../music/palettes";
import { getAudioEngine } from "./AudioEngine";
import { MusicDriver, type MusicControl } from "./MusicDriver";

/** The menu's clock never fully stops, so the heart keeps (slowly) beating. */
const MIN_TIME_SCALE = 0.03;

/**
 * The start menu's music: its own Conductor (palette tempo) running at the menu's time scale, and a
 * MusicDirector with no gameplay events, so only the heartbeat and the drone (retuned on bar lines)
 * sound. `onHeartbeat` fires on the same ticks as the heartbeat's "lub" (beats 1 and 3), so the EKG
 * picture matches the sound. The clock runs before audio is unlocked too (picture only).
 */
export class MenuMusic implements MusicControl {
  readonly conductor: Conductor;
  readonly director: MusicDirector;
  private readonly driver: MusicDriver;

  constructor(
    palette: Palette,
    private readonly onHeartbeat: (tick: TickEvent) => void,
  ) {
    this.conductor = new Conductor({ bpm: palette.bpm, timeScale: MIN_TIME_SCALE });
    this.director = new MusicDirector(palette, this.conductor);
    this.driver = new MusicDriver(this.director);
    getAudioEngine().setPalette(palette);
  }

  /** Per frame, with REAL seconds and the menu's pointer-driven time scale. */
  update(realDt: number, timeScale: number): void {
    const ts = Number.isFinite(timeScale) ? Math.min(1, Math.max(MIN_TIME_SCALE, timeScale)) : MIN_TIME_SCALE;
    this.conductor.timeScale = ts;
    const { ticks } = this.conductor.advance(realDt);
    for (const t of ticks) {
      this.director.onTick(t);
      if (isHeartbeatTick(t, this.conductor.beatsPerBar)) this.onHeartbeat(t);
    }
    this.driver.update(ts);
  }

  /** Back to the downbeat, so the next frame beats (e.g. right when audio is unlocked). */
  restart(): void {
    this.director.reset();
    this.conductor.reset(0);
  }

  setPalette(palette: Palette): void {
    this.driver.setPalette(palette, this.conductor);
  }

  /** Stops the clock and clears pending notes (scene shutdown). */
  stop(): void {
    this.conductor.pause();
    this.director.reset();
  }
}
