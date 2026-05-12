import { Enemy } from "./Enemy";
import type { BulletConfig } from "../BulletPattern";

export class PhantomDecoy extends Enemy {
  readonly enemyType = "phantom_decoy" as const;
  private flickerTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 1, 0, 99999, 0x4488ff, 28);
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
    this.draw(this.color);
  }

  protected getFirePattern(): BulletConfig[] {
    return [];
  }
}
