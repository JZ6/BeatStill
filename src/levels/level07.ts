import type { LevelDef } from "../systems/Levels";

export const level07: LevelDef = {
  id: 7,
  name: "Spiral Galaxy",
  description: "Four spirals, fragile cover",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "spiral", rx: 0.2, ry: 0.2 },
        { type: "spiral", rx: 0.8, ry: 0.2 },
        { type: "spiral", rx: 0.2, ry: 0.7 },
        { type: "spiral", rx: 0.8, ry: 0.7 },
      ],
      walls: [
        { rx: 0.42, ry: 0.42, rw: 0.16, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.42, ry: 0.56, rw: 0.16, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.42, ry: 0.42, rw: 0.02, rh: 0.16, type: "glass", hp: 3 },
        { rx: 0.56, ry: 0.42, rw: 0.02, rh: 0.16, type: "glass", hp: 3 },
      ],
    },
  ],
};
