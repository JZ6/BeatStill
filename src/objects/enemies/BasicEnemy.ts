import { Enemy } from "./Enemy";
import { radial } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";

export class BasicEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "basic", 2400);
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
  }

  protected getFirePattern(_angleToPlayer: number, gameScene: GameScene): BulletConfig[] {
    return radial(Math.min(4 + Math.floor(gameScene.wave / 2), 10), 160);
  }
}
