import { Enemy } from "./Enemy";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";
import { basicVolley } from "./volleys";

export class BasicEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "basic");
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
  }

  protected getFirePattern(_angleToPlayer: number, gameScene: GameScene): BulletConfig[] {
    return basicVolley(gameScene.wave);
  }
}
