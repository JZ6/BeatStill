import { Enemy } from "./Enemy";
import { radial, aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";

export class TankEnemy extends Enemy {
  readonly enemyType = "tank" as const;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 6, 15, 3500, 0xff4444, 24);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 8);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return [...radial(6, 90), ...aimed(angleToPlayer, 3, 0.4, 140)];
  }
}
