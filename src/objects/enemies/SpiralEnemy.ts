import { Enemy } from "./Enemy";
import { spiral } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";

export class SpiralEnemy extends Enemy {
  readonly enemyType = "spiral" as const;
  private spiralAngle = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 3, 25, 400, 0xaa44ff, 18);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 7);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
    this.spiralAngle = (this.spiralAngle + delta * timeScale * 0.002) % (Math.PI * 2);
  }

  protected getFirePattern(): BulletConfig[] {
    return spiral(3, 100, this.spiralAngle);
  }
}
