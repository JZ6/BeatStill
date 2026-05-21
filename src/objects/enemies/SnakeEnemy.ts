import { Enemy } from "./Enemy";
import { aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";

export class SnakeEnemy extends Enemy {
  readonly enemyType = "snake" as const;
  private snakePhase = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 2, 50, 2400, 0x44ddff, 14);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    this.drawPolygon(color, 2);
  }

  protected updateMovement(delta: number, timeScale: number, gameScene: GameScene) {
    this.targetX = gameScene.ship.x;
    this.targetY = gameScene.ship.y;
    this.snakePhase += delta * timeScale * 0.005;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = delta / 1000;

    if (dist > 5) {
      const headAngle = Math.atan2(dy, dx);
      const weave = Math.sin(this.snakePhase * 3) * 0.6;
      const moveAngle = headAngle + weave;
      this.x += Math.cos(moveAngle) * this.speed * timeScale * dt;
      this.y += Math.sin(moveAngle) * this.speed * timeScale * dt;
    }

  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return aimed(angleToPlayer, 3, 0.3, 200);
  }
}
