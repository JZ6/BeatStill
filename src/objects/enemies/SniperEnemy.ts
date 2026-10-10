import { Enemy } from "./Enemy";
import type { BulletConfig } from "../BulletPattern";
import { sniperVolley } from "./volleys";

export class SniperEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "sniper");
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return sniperVolley(angleToPlayer);
  }
}
