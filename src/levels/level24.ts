import type { LevelDef } from "../systems/Levels";

export const level24: LevelDef = {
  id: 24,
  name: "The Phantom",
  description: "Face the shadow",
  shipRx: 0.5, shipRy: 0.8,
  waves: [
    {
      enemies: [
        { type: "snake", rx: 0.2, ry: 0.3 },
        { type: "snake", rx: 0.8, ry: 0.3 },
        { type: "snake", rx: 0.5, ry: 0.5 },
        { type: "spiral", rx: 0.3, ry: 0.15 },
        { type: "spiral", rx: 0.7, ry: 0.15 },
      ],
      walls: [
        { rx: 0.12, ry: 0.1, rw: 0.02, rh: 0.7, type: "bounce" },
        { rx: 0.86, ry: 0.1, rw: 0.02, rh: 0.7, type: "bounce" },
        { rx: 0.45, ry: 0.4, rw: 0.1, rh: 0.02, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "phantom", rx: 0.5, ry: 0.2 },
      ],
    },
  ],
};
