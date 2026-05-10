import Phaser from "phaser";

const LIFETIME = 8000;
const FADE_START = 6000;
const SIZE = 8;

export class Shard extends Phaser.GameObjects.Graphics {
  elapsed = 0;
  alive = true;
  private startY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setDepth(7);
    this.startY = y;
    this.draw(1);
  }

  private draw(alpha: number) {
    this.clear();

    this.fillStyle(0xffaa44, alpha * 0.15);
    this.fillCircle(0, 0, SIZE * 2.5);

    this.fillStyle(0xffaa44, alpha * 0.7);
    this.beginPath();
    this.moveTo(0, -SIZE);
    this.lineTo(SIZE * 0.6, 0);
    this.lineTo(0, SIZE);
    this.lineTo(-SIZE * 0.6, 0);
    this.closePath();
    this.fillPath();

    this.lineStyle(1, 0xffdd88, alpha);
    this.beginPath();
    this.moveTo(0, -SIZE);
    this.lineTo(SIZE * 0.6, 0);
    this.lineTo(0, SIZE);
    this.lineTo(-SIZE * 0.6, 0);
    this.closePath();
    this.strokePath();
  }

  update(delta: number, timeScale: number) {
    if (!this.alive) return;
    this.elapsed += delta * timeScale;

    this.y = this.startY + Math.sin(this.elapsed * 0.003) * 4;
    this.rotation += 1.2 * timeScale * (delta / 1000);

    if (this.elapsed > FADE_START) {
      const fade = 1 - (this.elapsed - FADE_START) / (LIFETIME - FADE_START);
      this.draw(Math.max(fade, 0));
    }

    if (this.elapsed >= LIFETIME) {
      this.kill();
    }
  }

  kill() {
    this.alive = false;
    this.destroy();
  }
}
