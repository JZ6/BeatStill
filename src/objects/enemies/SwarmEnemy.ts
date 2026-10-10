import { Enemy } from "./Enemy";
import { aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";

export class SwarmEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "swarm");
    this.draw(this.color);
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    this.targetX = gameScene.ship.x;
    this.targetY = gameScene.ship.y;
    this.moveTowardTarget(delta / 1000, timeScale, 1);
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return aimed(angleToPlayer, 2, 0.25, 170);
  }
}
