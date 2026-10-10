import type { Conductor } from "../core/Conductor";
import type { MusicDirector } from "../music/MusicDirector";
import type { Palette } from "../music/palettes";
import { getAudioEngine, type AudioEngine } from "./AudioEngine";

/** What the dev panel needs to inspect and retune whichever music is playing (game or menu). */
export interface MusicControl {
  readonly director: MusicDirector;
  readonly conductor: Conductor;
  /** Swaps instruments, harmony and tempo at runtime. */
  setPalette(palette: Palette): void;
}

/**
 * Per-frame bridge from a MusicDirector to the audio engine: plays the drained requests, follows
 * the time scale and re-voices the drone when the director's chord changes.
 */
export class MusicDriver {
  private droneVersion = -1;

  constructor(
    readonly director: MusicDirector,
    private readonly engine: AudioEngine = getAudioEngine(),
  ) {}

  /** Call once per frame, after the frame's conductor ticks and game events reached the director. */
  update(timeScale: number): void {
    const requests = this.director.drain();
    // Before audio is unlocked the requests are simply discarded (nothing could sound).
    if (this.engine.started) for (const req of requests) this.engine.play(req);
    this.engine.setTimeScale(timeScale);
    if (this.director.droneVersion !== this.droneVersion) {
      this.droneVersion = this.director.droneVersion;
      this.engine.setDrone(this.director.droneChord());
    }
  }

  /** Engine, director and conductor all switch to `palette`. */
  setPalette(palette: Palette, conductor: Conductor): void {
    this.engine.setPalette(palette);
    this.director.setPalette(palette);
    conductor.setBpm(palette.bpm);
  }
}
