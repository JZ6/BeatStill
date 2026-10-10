import { Enemy } from "./Enemy";
import { spiral } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";

export class SpiralEnemy extends Enemy {
  private spiralAngle = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "spiral", 300);
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
    this.spiralAngle = (this.spiralAngle + delta * timeScale * 0.002) % (Math.PI * 2);
  }

  protected getFirePattern(): BulletConfig[] {
    return spiral(4, 130, this.spiralAngle);
  }
}
