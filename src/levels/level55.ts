import type { LevelDef } from "../systems/Levels";

export const level55: LevelDef = {
  id: 55,
  name: "Bullet Cathedral",
  description: "Pray you survive",
  shipRx: 0.5, shipRy: 0.9,
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.4, ry: 0.1 },
      { type: "sniper", rx: 0.6, ry: 0.1 },
      { type: "tank", rx: 0.5, ry: 0.15 },
    ],
    initialBullets: (() => {
      const bullets: { rx: number; ry: number; angle: number; speed: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const cx = 0.3 + i * 0.2;
        const cy = 0.35;
        const r = 0.12;
        for (let a = 0; a <= Math.PI; a += 0.08) {
          bullets.push({
            rx: cx + Math.cos(a) * r,
            ry: cy - Math.sin(a) * r,
            angle: 0, speed: 0,
          });
        }
        bullets.push({ rx: cx - r, ry: cy, angle: 0, speed: 0 });
        bullets.push({ rx: cx + r, ry: cy, angle: 0, speed: 0 });
        for (let y = cy; y <= cy + 0.2; y += 0.03) {
          bullets.push({ rx: cx - r, ry: y, angle: 0, speed: 0 });
          bullets.push({ rx: cx + r, ry: y, angle: 0, speed: 0 });
        }
      }
      return bullets;
    })(),
  }],
};
