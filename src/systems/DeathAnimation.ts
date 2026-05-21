import Phaser from "phaser";
import { GAME_H, px } from "./GameConfig";

interface Fragment {
  gfx: Phaser.GameObjects.Graphics;
  vx: number;
  vy: number;
  spin: number;
  life: number;
}

const DURATION = 1500;
const FRAGMENT_COUNT = 10;
const SLOWMO_DURATION = 500;

export class DeathAnimation {
  private fragments: Fragment[] = [];
  private elapsed = 0;
  private scene: Phaser.Scene;
  private onComplete: () => void;
  private done = false;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number, onComplete: () => void) {
    this.scene = scene;
    this.onComplete = onComplete;

    scene.cameras.main.shake(300, 0.015);

    const size = px(6);
    for (let i = 0; i < FRAGMENT_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / FRAGMENT_COUNT + (Math.random() - 0.5) * 0.4;
      const speed = 80 + Math.random() * 120;

      const gfx = scene.add.graphics();
      gfx.setPosition(x, y);
      gfx.setDepth(100);

      const s = size * (0.6 + Math.random() * 0.8);
      gfx.fillStyle(color, 1);
      gfx.fillTriangle(
        -s, s * 0.6,
        s, s * 0.3,
        0, -s,
      );

      this.fragments.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 8,
        life: 1,
      });
    }
  }

  update(delta: number): boolean {
    if (this.done) return true;

    this.elapsed += delta;
    const progress = Math.min(this.elapsed / DURATION, 1);
    const slowmo = this.elapsed < SLOWMO_DURATION ? 0.3 : 1;
    const dt = (delta / 1000) * slowmo;

    for (const f of this.fragments) {
      f.vy += 60 * dt;
      f.gfx.x += f.vx * dt;
      f.gfx.y += f.vy * dt;
      f.gfx.rotation += f.spin * dt;

      f.life = 1 - progress;
      f.gfx.setAlpha(f.life);

      if (f.gfx.y > GAME_H + 50) {
        f.vy = 0;
        f.vx = 0;
      }
    }

    if (progress >= 1) {
      this.cleanup();
      return true;
    }
    return false;
  }

  private cleanup() {
    this.done = true;
    for (const f of this.fragments) {
      f.gfx.destroy();
    }
    this.fragments = [];
    this.onComplete();
  }

  stop() {
    if (this.done) return;
    this.done = true;
    for (const f of this.fragments) {
      f.gfx.destroy();
    }
    this.fragments = [];
  }
}
