import type { Conductor } from "../core/Conductor";
import type { MusicDirector } from "../music/MusicDirector";
import type { Palette } from "../music/palettes";
import { latencySeconds, options } from "../systems/GameOptions";
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
 * the time scale and re-voices the drone when the director's chord changes. It also keeps the
 * director on the player's audio options (latency, heartbeat), so changes apply live, from the
 * next frame, to whichever music is playing (run, menu or a preview).
 */
export class MusicDriver {
  private droneVersion = -1;

  constructor(
    readonly director: MusicDirector,
    private readonly engine: AudioEngine = getAudioEngine(),
  ) {
    this.syncOptions();
  }

  /** Call once per frame, after the frame's conductor ticks and game events reached the director. */
  update(timeScale: number): void {
    this.syncOptions();
    const requests = this.director.drain();
    // Before audio is unlocked the requests are simply discarded (nothing could sound).
    if (this.engine.started) for (const req of requests) this.engine.play(req);
    this.engine.setTimeScale(timeScale);
    if (this.director.droneVersion !== this.droneVersion) {
      this.droneVersion = this.director.droneVersion;
      this.engine.setDrone(this.director.droneChord());
    }
  }

  /** Re-voices the drone on the next update (after something else took over the engine, e.g. a theme preview). */
  refreshDrone(): void {
    this.droneVersion = -1;
  }

  /** Applies Options → Audio Latency and Heartbeat to the director. */
  private syncOptions(): void {
    this.director.setLatency(latencySeconds(options.audioLatencyMs));
    if (this.director.heartbeatEnabled !== options.heartbeat) this.director.setHeartbeat(options.heartbeat);
  }

  /** Engine, director and conductor all switch to `palette`. */
  setPalette(palette: Palette, conductor: Conductor): void {
    this.engine.setPalette(palette);
    this.director.setPalette(palette);
    conductor.setBpm(palette.bpm);
  }
}
