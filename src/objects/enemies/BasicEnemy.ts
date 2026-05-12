import { Enemy } from "./Enemy";
import { radial } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";

export class BasicEnemy extends Enemy {
  readonly enemyType = "basic" as const;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 2, 40, 3000, 0x44ff44, 16);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 4);
  }

  protected updateMovement(delta: number, timeScale: number) {
    if (this.moveTowardTarget(delta / 1000, timeScale)) {
      this.pickNewTarget();
    }
  }

  protected getFirePattern(_angleToPlayer: number, gameScene: GameScene): BulletConfig[] {
    return radial(Math.min(3 + Math.floor(gameScene.wave / 3), 6), 120);
  }
}
