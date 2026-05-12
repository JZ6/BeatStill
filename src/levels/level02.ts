import type { LevelDef } from "../systems/Levels";

export const level02: LevelDef = {
  id: 2,
  name: "First Contact",
  description: "Six hostiles, no cover",
  shipRx: 0.5, shipRy: 0.8,
  waves: [
    {
      enemies: [
        { type: "basic", rx: 0.2, ry: 0.15 },
        { type: "basic", rx: 0.5, ry: 0.1 },
        { type: "basic", rx: 0.8, ry: 0.15 },
        { type: "basic", rx: 0.3, ry: 0.35 },
        { type: "basic", rx: 0.7, ry: 0.35 },
        { type: "basic", rx: 0.5, ry: 0.5 },
      ],
    },
  ],
};
