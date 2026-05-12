import type { LevelDef } from "../systems/Levels";

export const level22: LevelDef = {
  id: 22,
  name: "Checkerboard",
  description: "Glass and bounce in a grid",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        { type: "basic", rx: 0.15, ry: 0.2 },
        { type: "basic", rx: 0.85, ry: 0.2 },
        { type: "basic", rx: 0.15, ry: 0.7 },
        { type: "basic", rx: 0.85, ry: 0.7 },
        { type: "sniper", rx: 0.2, ry: 0.45 },
        { type: "sniper", rx: 0.8, ry: 0.45 },
        { type: "sniper", rx: 0.5, ry: 0.15 },
        { type: "sniper", rx: 0.5, ry: 0.75 },
      ],
      walls: [
        { rx: 0.27, ry: 0.27, rw: 0.06, rh: 0.06, type: "glass", hp: 2 },
        { rx: 0.47, ry: 0.27, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.67, ry: 0.27, rw: 0.06, rh: 0.06, type: "glass", hp: 2 },
        { rx: 0.27, ry: 0.47, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.47, ry: 0.47, rw: 0.06, rh: 0.06, type: "glass", hp: 2 },
        { rx: 0.67, ry: 0.47, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.27, ry: 0.67, rw: 0.06, rh: 0.06, type: "glass", hp: 2 },
        { rx: 0.47, ry: 0.67, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.67, ry: 0.67, rw: 0.06, rh: 0.06, type: "glass", hp: 2 },
      ],
    },
  ],
};
