import type { LevelDef } from "../systems/Levels";

export const level48: LevelDef = {
  id: 48,
  name: "Whack-a-Mole",
  description: "Find them behind the glass",
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.15, ry: 0.2 },
      { type: "sniper", rx: 0.5, ry: 0.15 },
      { type: "sniper", rx: 0.85, ry: 0.25 },
      { type: "sniper", rx: 0.25, ry: 0.55 },
      { type: "sniper", rx: 0.6, ry: 0.5 },
      { type: "sniper", rx: 0.8, ry: 0.65 },
      { type: "sniper", rx: 0.35, ry: 0.8 },
      { type: "sniper", rx: 0.7, ry: 0.85 },
    ],
    walls: (() => {
      const w: { rx: number; ry: number; rw: number; rh: number; type: "glass"; hp: number }[] = [];
      for (let gx = 0.1; gx <= 0.85; gx += 0.12) {
        for (let gy = 0.1; gy <= 0.85; gy += 0.14) {
          w.push({ rx: gx, ry: gy, rw: 0.06, rh: 0.06, type: "glass", hp: 1 });
        }
      }
      return w;
    })(),
  }],
};
