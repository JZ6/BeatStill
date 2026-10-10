import type { LevelDef } from "../systems/Levels";

export const level29: LevelDef = {
  id: 29,
  name: "Bullet Cathedral",
  description: "Navigate the architecture",
  shipRx: 0.5, shipRy: 0.9,
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.15, ry: 0.2 },
        { type: "sniper", rx: 0.85, ry: 0.2 },
        { type: "sniper", rx: 0.5, ry: 0.1 },
        { type: "tank", rx: 0.3, ry: 0.5 },
        { type: "tank", rx: 0.7, ry: 0.5 },
      ],
      initialBullets: (() => {
        const bullets: { rx: number; ry: number; angle: number; speed: number }[] = [];
        const arches = [0.25, 0.5, 0.75];
        for (const cx of arches) {
          const r = 0.1;
          // Integer steps avoid float drift. The arc skips its two end points (k = 0, 12)
          // because the columns below start at those same positions.
          for (let k = 1; k < 12; k++) {
            const a = (k * Math.PI) / 12;
            bullets.push({
              rx: cx + Math.cos(a) * r,
              ry: 0.3 - Math.sin(a) * r,
              angle: 0, speed: 0,
            });
          }
          for (let yi = 30; yi <= 60; yi += 4) {
            bullets.push({ rx: cx - r, ry: yi / 100, angle: 0, speed: 0 });
            bullets.push({ rx: cx + r, ry: yi / 100, angle: 0, speed: 0 });
          }
        }
        return bullets;
      })(),
    },
  ],
};
