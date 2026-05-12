import type { LevelDef } from "../systems/Levels";

export const level19: LevelDef = {
  id: 19,
  name: "Bullet Rain",
  description: "Slow bullets fall from above",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        { type: "basic", rx: 0.2, ry: 0.1 },
        { type: "basic", rx: 0.5, ry: 0.05 },
        { type: "basic", rx: 0.8, ry: 0.1 },
        { type: "basic", rx: 0.35, ry: 0.2 },
        { type: "tracker", rx: 0.65, ry: 0.15 },
        { type: "tracker", rx: 0.4, ry: 0.3 },
      ],
      initialBullets: (() => {
        const bullets: { rx: number; ry: number; angle: number; speed: number }[] = [];
        for (let x = 0.08; x <= 0.92; x += 0.06) {
          if (x > 0.42 && x < 0.58) continue;
          for (let y = 0.05; y <= 0.7; y += 0.1) {
            bullets.push({ rx: x, ry: y, angle: Math.PI / 2, speed: 40 });
          }
        }
        return bullets;
      })(),
    },
  ],
};
