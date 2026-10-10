import { Enemy } from "./Enemy";
import { radial, aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";

export class TankEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tank", 2800);
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return [...radial(8, 120), ...aimed(angleToPlayer, 4, 0.5, 180)];
  }
}
