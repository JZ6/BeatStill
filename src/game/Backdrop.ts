import Phaser from "phaser";
import type { TickEvent } from "../core/Conductor";
import { GAME_W, GAME_H } from "../systems/GameConfig";
import { options } from "../systems/GameOptions";
import { PulseEnvelope, pulseStrength } from "./PulseEnvelope";

const GRID_SPACING = 64;
const PULSE_COLOR = 0xffaa44;
/** Line alpha of the pulse grid at full flash; the layer's alpha scales it. Keep it subtle. */
const PULSE_LINE_ALPHA = 0.14;

function drawGrid(g: Phaser.GameObjects.Graphics) {
  for (let x = 0; x <= GAME_W; x += GRID_SPACING) g.lineBetween(x, 0, x, GAME_H);
  for (let y = 0; y <= GAME_H; y += GRID_SPACING) g.lineBetween(0, y, GAME_W, y);
}

/**
 * The static background plus a beat pulse: a second, warmer copy of the grid drawn once
 * whose alpha flashes on each beat (stronger on bar downbeats) and decays in real time.
 * Only the layer alpha changes per frame, and the layer is hidden while it is dark.
 * Options → Reduce Flashing turns the pulse off (read live).
 */
export class Backdrop {
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly pulseLayer: Phaser.GameObjects.Graphics;
  private readonly envelope = new PulseEnvelope();

  constructor(scene: Phaser.Scene) {
    this.base = scene.add.graphics().setDepth(-1);
    this.base.fillGradientStyle(0x0a0806, 0x0a0806, 0x12100c, 0x12100c, 1);
    this.base.fillRect(0, 0, GAME_W, GAME_H);
    this.base.lineStyle(1, 0x1a1612, 0.3);
    drawGrid(this.base);

    this.pulseLayer = scene.add.graphics().setDepth(-0.5);
    this.pulseLayer.lineStyle(1, PULSE_COLOR, PULSE_LINE_ALPHA);
    drawGrid(this.pulseLayer);
    this.apply();
  }

  /** Feed every conductor tick; beats and downbeats trigger a flash (none with Reduce Flashing). */
  onTick(t: TickEvent) {
    const strength = pulseStrength(t);
    if (strength <= 0 || options.reduceFlashing) return;
    this.envelope.trigger(strength);
    this.apply();
  }

  /** Decays the flash. Call every frame with REAL seconds (also while paused or after game over). */
  update(realDt: number) {
    if (this.envelope.level <= 0) return;
    if (options.reduceFlashing) this.envelope.level = 0;
    else this.envelope.update(realDt);
    this.apply();
  }

  private apply() {
    const level = this.envelope.level;
    this.pulseLayer.setVisible(level > 0);
    if (level > 0) this.pulseLayer.setAlpha(level);
  }
}
