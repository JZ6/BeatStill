import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import type { Conductor } from "../core/Conductor";
import { GAME_EVENT_TYPES, type GameEventMap, type GameEventType } from "../core/GameEvents";
import { MusicDirector } from "../music/MusicDirector";
import type { Palette } from "../music/palettes";
import { getAudioEngine } from "../audio/AudioEngine";
import { MusicDriver, type MusicControl } from "../audio/MusicDriver";
import { droneGainFor, options } from "../systems/GameOptions";

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
  private _baseBpm: number;
  /** The mutators' tempo multiplier (setTempoScale), kept across palette switches. */
  private tempoMult = 1;
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
    this._baseBpm = palette.bpm;
    this.director = new MusicDirector(palette, scene.conductor);
    this.driver = new MusicDriver(this.director, this.engine);
    // Kept by the engine until audio starts; volume and drone level are re-applied on every run.
    this.engine.setPalette(palette);
    this.engine.setVolume(options.masterVolume / 100);
    this.engine.setDroneGain(droneGainFor(options.droneVolume));

    for (const type of GAME_EVENT_TYPES) this.cleanups.push(this.forward(type));
    this.cleanups.push(scene.onTick((t) => this.director.onTick(t)));
    this.bindUnlock();
    this.bindVisibility();
  }

  get conductor(): Conductor {
    return this.scene.conductor;
  }

  /** The run's tempo before mutators: the palette's (or the level's override); a palette switch replaces it. */
  get baseBpm(): number {
    return this._baseBpm;
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

  /**
   * Switches instruments, harmony and tempo at runtime (the dev panel). The mutators' section
   * modifiers carry over: the key offset is re-applied to the new home key and the tempo
   * multiplier to the new palette's tempo.
   */
  setPalette(palette: Palette): void {
    const keyOffset = this.director.keyOffset;
    this.driver.setPalette(palette, this.scene.conductor);
    this._baseBpm = palette.bpm;
    this.director.setKeyOffset(keyOffset);
    this.setTempoScale(this.tempoMult);
  }

  /** Semitones the harmony sits above (or below) the run's home key. */
  get keyOffset(): number {
    return this.director.keyOffset;
  }

  /** A section change: the harmony moves to `offset` semitones from the home key, from this moment. */
  setKeyOffset(offset: number): void {
    this.director.setKeyOffset(offset);
  }

  /**
   * Tempo = base × `mult` (the double_time mutator). The conductor keeps its musical position, so
   * every rhythm grid speeds up from here; the director reads the conductor and the delay follows.
   */
  setTempoScale(mult: number): void {
    this.tempoMult = Number.isFinite(mult) && mult > 0 ? mult : 1;
    const bpm = this._baseBpm * this.tempoMult;
    this.scene.conductor.setBpm(bpm);
    this.engine.setTempo(bpm);
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
