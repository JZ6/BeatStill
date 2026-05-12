import type { LevelDef } from "../systems/Levels";

export const level31: LevelDef = {
  id: 31,
  name: "Dodge This",
  description: "Thread the needle",
  shipRx: 0.9, shipRy: 0.5,
  waves: [{
    enemies: [
      { type: "spiral", rx: 0.15, ry: 0.3 },
      { type: "spiral", rx: 0.15, ry: 0.7 },
    ],
    initialBullets: (() => {
      const bullets: { rx: number; ry: number; angle: number; speed: number }[] = [];
      for (let gx = 0.05; gx <= 0.85; gx += 0.035) {
        for (let gy = 0.05; gy <= 0.95; gy += 0.035) {
          const laneX = Math.abs((gx * 10) % 1 - 0.5) < 0.15;
          const laneY = Math.abs((gy * 8) % 1 - 0.5) < 0.15;
          if (!laneX && !laneY) {
            bullets.push({ rx: gx, ry: gy, angle: 0, speed: 0 });
          }
        }
      }
      return bullets;
    })(),
  }],
};
