import type { LevelDef } from "../systems/Levels";

export const level41: LevelDef = {
  id: 41,
  name: "Bullet Rain",
  description: "Weave through the downpour",
  shipRx: 0.5, shipRy: 0.85,
  waves: [{
    enemies: [
      { type: "basic", rx: 0.2, ry: 0.3 },
      { type: "basic", rx: 0.4, ry: 0.25 },
      { type: "basic", rx: 0.6, ry: 0.3 },
      { type: "basic", rx: 0.8, ry: 0.25 },
      { type: "tracker", rx: 0.3, ry: 0.5 },
      { type: "tracker", rx: 0.5, ry: 0.45 },
      { type: "tracker", rx: 0.7, ry: 0.5 },
      { type: "tracker", rx: 0.5, ry: 0.6 },
    ],
    initialBullets: (() => {
      const bullets: { rx: number; ry: number; angle: number; speed: number }[] = [];
      for (let col = 0.08; col <= 0.92; col += 0.06) {
        for (let row = 0.05; row <= 0.7; row += 0.08) {
          if (Math.abs(col - 0.5) < 0.04) continue;
          bullets.push({ rx: col, ry: row, angle: Math.PI / 2, speed: 40 });
        }
      }
      return bullets;
    })(),
  }],
};
