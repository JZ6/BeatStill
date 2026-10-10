import Phaser from "phaser";
import type { TickEvent } from "../core/Conductor";
import type { GameScene } from "../scenes/GameScene";
import { GAME_W, GAME_H, px } from "../systems/GameConfig";
import { options } from "../systems/GameOptions";
import { HAPTIC_BAR, HAPTIC_DEATH, HAPTIC_HIT, vibrate } from "../systems/feedback";
import { PulseEnvelope, pulseStrength } from "./PulseEnvelope";

const EDGE_COLOR = 0xffaa44;
/** Peak layer alpha on a downbeat (beats get half): normal, and with Reduce Flashing (softer, slower). */
const EDGE_PEAK = 0.45;
const EDGE_PEAK_REDUCED = 0.2;
const EDGE_DECAY = 6;
const EDGE_DECAY_REDUCED = 2.5;
/** Nested border strokes from the screen edge inward, fading toward the centre. */
const EDGE_BANDS = [0.9, 0.5, 0.25, 0.1];
/** Above the HUD (100), below the pause overlay (200). */
const EDGE_DEPTH = 150;

/**
 * Beat feedback that doesn't rely on hearing, both off by default:
 * - Beat Visualizer: a subtle pulse around the screen edge on every beat (strongest on downbeats),
 *   decaying in real time; gentler and slower with Reduce Flashing.
 * - Haptics: a short vibration on bar downbeats, a longer one on player hits and death.
 * Options are read live, so toggling them in the pause menu applies at once.
 */
export class BeatFeedback {
  private readonly edge: Phaser.GameObjects.Graphics;
  private readonly envelope = new PulseEnvelope(EDGE_DECAY);
  private readonly softEnvelope = new PulseEnvelope(EDGE_DECAY_REDUCED);

  constructor(scene: GameScene) {
    this.edge = scene.add.graphics().setDepth(EDGE_DEPTH).setScrollFactor(0);
    const width = px(6);
    EDGE_BANDS.forEach((alpha, i) => {
      const inset = width / 2 + i * width;
      this.edge.lineStyle(width, EDGE_COLOR, alpha);
      this.edge.strokeRect(inset, inset, GAME_W - inset * 2, GAME_H - inset * 2);
    });
    this.edge.setVisible(false);

    scene.gameEvents.on("playerHit", () => vibrate(HAPTIC_HIT));
    scene.gameEvents.on("playerDied", () => vibrate(HAPTIC_DEATH));
  }

  /** Every conductor tick: beats pulse the edge, downbeats also vibrate. */
  onTick(t: TickEvent) {
    if (t.isBar) vibrate(HAPTIC_BAR);
    const strength = pulseStrength(t);
    if (strength <= 0 || !options.beatVisualizer) return;
    (options.reduceFlashing ? this.softEnvelope : this.envelope).trigger(strength);
    this.apply();
  }

  /** Every frame with REAL seconds (also while paused or after game over). */
  update(realDt: number) {
    if (this.envelope.level <= 0 && this.softEnvelope.level <= 0) return;
    this.envelope.update(realDt);
    this.softEnvelope.update(realDt);
    this.apply();
  }

  private apply() {
    const level = options.beatVisualizer
      ? Math.max(this.envelope.level * EDGE_PEAK, this.softEnvelope.level * EDGE_PEAK_REDUCED)
      : 0;
    this.edge.setVisible(level > 0);
    if (level > 0) this.edge.setAlpha(level);
  }
}
