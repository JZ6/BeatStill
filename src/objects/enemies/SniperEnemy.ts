import { Enemy } from "./Enemy";
import { aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";

export class SniperEnemy extends Enemy {
  readonly enemyType = "sniper" as const;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 1, 20, 2000, 0xff2266, 10);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 5);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return aimed(angleToPlayer, 1, 0, 280);
  }
}
