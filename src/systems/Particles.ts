import Phaser from "phaser";
import { options } from "./GameOptions";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

function maxParticles() { return options.particleQuality; }

export class ParticleSystem {
  private particles: Particle[] = [];
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(8);
  }

  burst(x: number, y: number, color: number, count: number, speed = 80, size = 3) {
    for (let i = 0; i < count && this.particles.length < maxParticles(); i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.6 + Math.random() * 0.8,
        maxLife: 0.6 + Math.random() * 0.8,
        size: size * (0.5 + Math.random() * 0.5),
        color,
      });
    }
  }

  trail(x: number, y: number, color: number, count = 2) {
    for (let i = 0; i < count && this.particles.length < maxParticles(); i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.2 + Math.random() * 0.3,
        size: 1.5 + Math.random(),
        color,
      });
    }
  }

  update(delta: number, timeScale: number) {
    if (maxParticles() === 0) { this.graphics.clear(); this.particles.length = 0; return; }
    const dt = (delta / 1000) * timeScale;
    this.graphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta / 1000 * timeScale;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;

      const alpha = (p.life / p.maxLife) * 0.8;
      this.graphics.fillStyle(p.color, alpha);
      this.graphics.fillCircle(p.x, p.y, p.size * (p.life / p.maxLife));
    }
  }

  destroy() {
    this.graphics.destroy();
  }
}
