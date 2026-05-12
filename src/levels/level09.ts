import type { LevelDef } from "../systems/Levels";

export const level09: LevelDef = {
  id: 9,
  name: "Bullet Spiral",
  description: "Navigate the spiral path",
  shipRx: 0.9, shipRy: 0.5,
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.5, ry: 0.45 },
      { type: "sniper", rx: 0.5, ry: 0.55 },
    ],
    initialBullets: (() => {
      const bullets: { rx: number; ry: number; angle: number; speed: number }[] = [];
      const cx = 0.5, cy = 0.5;
      const step = 0.04;
      for (let gx = 0.05; gx <= 0.95; gx += step) {
        for (let gy = 0.05; gy <= 0.95; gy += step) {
          const dx = gx - cx;
          const dy = gy - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const spiralR = 0.06 + (((angle + Math.PI) / (Math.PI * 2)) * 0.35 + dist * 0.3) % 0.4;
          if (Math.abs(dist - spiralR) > 0.035) {
            bullets.push({ rx: gx, ry: gy, angle: 0, speed: 0 });
          }
        }
      }
      return bullets;
    })(),
  }],
};
