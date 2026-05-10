import Phaser from "phaser";
import type { GameScene } from "../scenes/GameScene";
import { GAME_W, GAME_H } from "../systems/GameConfig";

const SIZE_CONFIG = {
  large: { radius: 40 },
  medium: { radius: 24 },
  small: { radius: 12 },
} as const;

type AsteroidSize = keyof typeof SIZE_CONFIG;

const NEXT_SIZE: Record<AsteroidSize, AsteroidSize | null> = {
  large: "medium",
  medium: "small",
  small: null,
};

export class Asteroid extends Phaser.GameObjects.Graphics {
  radius: number;
  size: AsteroidSize;
  vx: number;
  vy: number;
  rotationSpeed: number;
  vertices: { x: number; y: number }[];

  constructor(scene: Phaser.Scene, x: number, y: number, size: AsteroidSize) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setDepth(3);

    this.radius = SIZE_CONFIG[size].radius;
    this.size = size;

    const centerX = GAME_W / 2;
    const centerY = GAME_H / 2;
    const angle = Math.atan2(centerY - y, centerX - x);
    const speed = Phaser.Math.Between(30, 80);
    this.vx = Math.cos(angle + Phaser.Math.FloatBetween(-0.5, 0.5)) * speed;
    this.vy = Math.sin(angle + Phaser.Math.FloatBetween(-0.5, 0.5)) * speed;
    this.rotationSpeed = Phaser.Math.FloatBetween(-2, 2);

    const points = Phaser.Math.Between(6, 10);
    this.vertices = [];
    for (let i = 0; i < points; i++) {
      const a = (Math.PI * 2 * i) / points;
      const r = this.radius * Phaser.Math.FloatBetween(0.7, 1.0);
      this.vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    this.drawAsteroid();
  }

  private tracePath() {
    this.beginPath();
    this.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (let i = 1; i < this.vertices.length; i++) {
      this.lineTo(this.vertices[i].x, this.vertices[i].y);
    }
    this.closePath();
  }

  drawAsteroid() {
    this.clear();

    this.lineStyle(3, 0xff44ff, 0.2);
    this.tracePath();
    this.strokePath();

    this.lineStyle(1.5, 0xff44ff, 0.8);
    this.tracePath();
    this.strokePath();
  }

  update(delta: number, timeScale: number) {
    const dt = delta / 1000;
    this.x += this.vx * timeScale * dt;
    this.y += this.vy * timeScale * dt;
    this.rotation += this.rotationSpeed * timeScale * dt;

    if (this.x < -80 || this.x > GAME_W + 80 || this.y < -80 || this.y > GAME_H + 80) {
      this.destroy();
    }
  }

  split(gameScene: GameScene) {
    const next = NEXT_SIZE[this.size];
    if (next) {
      for (let i = 0; i < 2; i++) {
        const a = new Asteroid(gameScene, this.x, this.y, next);
        a.vx = Phaser.Math.FloatBetween(-80, 80);
        a.vy = Phaser.Math.FloatBetween(-80, 80);
        gameScene.asteroids.add(a);
      }
    }
    this.destroy();
  }
}
