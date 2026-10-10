import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import type { Conductor } from "../core/Conductor";
import { GAME_EVENT_TYPES, type GameEventMap, type GameEventType } from "../core/GameEvents";
import { MusicDirector } from "../music/MusicDirector";
import type { Palette } from "../music/palettes";
import { getAudioEngine } from "../audio/AudioEngine";
import { MusicDriver, type MusicControl } from "../audio/MusicDriver";
import { options } from "../systems/GameOptions";

/** After game over the engine's time scale sinks to this in real time (lowpass closes, drone swells). */
const DEATH_TIME_SCALE = 0.03;
/** Rate (1/s) of that sink. */
const DEATH_SINK_RATE = 1.5;

/**
 * The run's music: forwards every GameEvent and conductor tick to a MusicDirector and plays what it
 * asks for through the shared AudioEngine. Owns the audio unlock (first pointer or key press) and
 * the pause / tab-hidden mute. Created per run; destroy() on scene shutdown.
 */
export class MusicSystem implements MusicControl {
  readonly director: MusicDirector;
  private readonly driver: MusicDriver;
  private readonly engine = getAudioEngine();
  private readonly cleanups: (() => void)[] = [];
  private frozen = false;
  private hidden = false;
  private lastTimeScale = 1;
  private deathTimeScale: number | null = null;

  constructor(
    private readonly scene: GameScene,
    palette: Palette,
  ) {
    this.director = new MusicDirector(palette, scene.conductor);
    this.driver = new MusicDriver(this.director, this.engine);
    // Kept by the engine until audio starts; volume is re-applied on every run.
    this.engine.setPalette(palette);
    this.engine.setVolume(options.masterVolume / 100);

    for (const type of GAME_EVENT_TYPES) this.cleanups.push(this.forward(type));
    this.cleanups.push(scene.onTick((t) => this.director.onTick(t)));
    this.bindUnlock();
    this.bindVisibility();
  }

  get conductor(): Conductor {
    return this.scene.conductor;
  }

  /** Per live frame, after the conductor advanced and gameplay emitted this frame's events. */
  update(timeScale: number): void {
    this.lastTimeScale = timeScale;
    this.driver.update(timeScale);
  }

  /** Per frame after game over: the death run plays and the world's sound sinks in real time. */
  updateGameOver(realDt: number): void {
    const from = this.deathTimeScale ?? this.lastTimeScale;
    this.deathTimeScale = from + (DEATH_TIME_SCALE - from) * (1 - Math.exp(-DEATH_SINK_RATE * realDt));
    this.driver.update(this.deathTimeScale);
  }

  /** Pause menu / relic picker: silence everything (the conductor is frozen by the scene). */
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    this.syncPaused();
  }

  setPalette(palette: Palette): void {
    this.driver.setPalette(palette, this.scene.conductor);
  }

  /** Scene shutdown: stop listening and release sounding notes. The engine itself lives on. */
  destroy(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.director.reset();
    this.engine.releaseAll();
    this.engine.setPaused(false);
  }

  private forward<K extends GameEventType>(type: K): () => void {
    return this.scene.gameEvents.on(type, (payload: GameEventMap[K]) => this.director.handleEvent(type, payload));
  }

  /** Browsers allow audio only after a gesture: start on the first pointer press or key press. */
  private bindUnlock(): void {
    if (this.engine.started) return;
    const unlock = () => {
      if (this.engine.started) return;
      this.engine.start().catch((err: unknown) => {
        console.warn("[MusicSystem] audio did not start:", err instanceof Error ? err.message : err);
      });
    };
    this.scene.input.on("pointerdown", unlock);
    // A native listener, so resume() runs inside the key event (Phaser queues key events to the next frame).
    window.addEventListener("keydown", unlock);
    this.cleanups.push(() => {
      this.scene.input.off("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    });
  }

  /** Phaser stops its loop while the tab is hidden, but the AudioContext keeps playing. */
  private bindVisibility(): void {
    const events = this.scene.game.events;
    const onHidden = () => {
      this.hidden = true;
      this.syncPaused();
    };
    const onVisible = () => {
      this.hidden = false;
      this.syncPaused();
    };
    events.on(Phaser.Core.Events.HIDDEN, onHidden);
    events.on(Phaser.Core.Events.VISIBLE, onVisible);
    this.cleanups.push(() => {
      events.off(Phaser.Core.Events.HIDDEN, onHidden);
      events.off(Phaser.Core.Events.VISIBLE, onVisible);
    });
  }

  private syncPaused(): void {
    this.engine.setPaused(this.frozen || this.hidden);
  }
}
