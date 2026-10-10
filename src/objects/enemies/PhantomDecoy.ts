import Phaser from "phaser";
import { Enemy } from "./Enemy";
import type { BulletConfig } from "../BulletPattern";
import type { PhantomBoss } from "./PhantomBoss";

export class PhantomDecoy extends Enemy {
  private flickerTimer = 0;
  private owner: PhantomBoss | null;

  constructor(scene: Phaser.Scene, x: number, y: number, owner: PhantomBoss | null = null) {
    super(scene, x, y, "phantom_decoy", 99999);
    this.owner = owner;
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    const r = this.radius;
    const flicker = Math.sin(this.flickerTimer * 0.01) * 0.15;
    const alpha = 0.35 + flicker;

    this.lineStyle(1.5, color, alpha);
    this.beginPath();
    this.moveTo(0, -r);
    this.lineTo(r * 0.6, 0);
    this.lineTo(0, r);
    this.lineTo(-r * 0.6, 0);
    this.closePath();
    this.strokePath();

    this.fillStyle(color, 0.08 + flicker * 0.3);
    this.beginPath();
    this.moveTo(0, -r);
    this.lineTo(r * 0.6, 0);
    this.lineTo(0, r);
    this.lineTo(-r * 0.6, 0);
    this.closePath();
    this.fillPath();
  }

  protected updateMovement(delta: number, timeScale: number) {
    this.flickerTimer += delta * timeScale;
    this.draw(this.currentColor());
  }

  protected getFirePattern(): BulletConfig[] {
    return [];
  }

  /** Runs once per destroy (GameObject.destroy() is a no-op after the first call); tells the owner exactly once. */
  protected preDestroy() {
    const owner = this.owner;
    this.owner = null;
    owner?.onDecoyDestroyed(this);
    super.preDestroy();
  }
}
