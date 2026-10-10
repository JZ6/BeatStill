import type { LevelDef } from "../systems/Levels";

export const level19: LevelDef = {
  id: 19,
  name: "Bullet Rain",
  description: "Slow bullets fall from above",
  music: { bpm: 114, key: "C" },
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
        // Integer steps in hundredths: x 0.08..0.92 step 0.06 (gap 0.42-0.58), y 0.05..0.65 step 0.1.
        for (let xi = 8; xi <= 92; xi += 6) {
          if (xi > 42 && xi < 58) continue;
          for (let yi = 5; yi <= 70; yi += 10) {
            bullets.push({ rx: xi / 100, ry: yi / 100, angle: Math.PI / 2, speed: 40 });
          }
        }
        return bullets;
      })(),
    },
  ],
};
