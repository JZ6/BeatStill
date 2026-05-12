import { Enemy } from "./Enemy";
import { aimed } from "../BulletPattern";
import type { BulletConfig } from "../BulletPattern";
import type { GameScene } from "../../scenes/GameScene";

export class SnakeEnemy extends Enemy {
  readonly enemyType = "snake" as const;
  private snakePhase = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 2, 50, 3000, 0x44ddff, 14);
    this.draw(this.color);
  }

  protected drawShape(color: number) {
    const r = this.radius;
    const segments = 6;
    const segLen = (r * 2) / segments;
    const amplitude = r * 0.5;

    const drawWave = (rad: number, alpha: number, width: number) => {
      this.lineStyle(width, color, alpha);
      this.beginPath();
      for (let i = 0; i <= segments; i++) {
        const py = -r + i * segLen;
        const px = Math.sin(this.snakePhase + i * 1.2) * amplitude * (rad / r);
        if (i === 0) this.moveTo(px, py); else this.lineTo(px, py);
      }
      this.strokePath();
    };

    drawWave(r + 4, 0.3, 3);
    drawWave(r, 1, 1.5);
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

    this.draw(this.color);
  }

  protected getFirePattern(angleToPlayer: number): BulletConfig[] {
    return aimed(angleToPlayer, 2, 0.2, 150);
  }
}
