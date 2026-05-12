import type { LevelDef } from "../systems/Levels";

export const level30: LevelDef = {
  id: 30,
  name: "The Sentinel Returns",
  description: "The fortress fights back",
  waves: [
    {
      enemies: [
        { type: "tank", rx: 0.2, ry: 0.15 },
        { type: "tank", rx: 0.8, ry: 0.15 },
        { type: "tank", rx: 0.2, ry: 0.5 },
        { type: "tank", rx: 0.8, ry: 0.5 },
      ],
      walls: [
        { rx: 0.15, ry: 0.1, rw: 0.02, rh: 0.8, type: "bounce" },
        { rx: 0.83, ry: 0.1, rw: 0.02, rh: 0.8, type: "bounce" },
        { rx: 0.15, ry: 0.1, rw: 0.7, rh: 0.02, type: "bounce" },
        { rx: 0.15, ry: 0.88, rw: 0.7, rh: 0.02, type: "bounce" },
      ],
    },
    {
      enemies: [
        { type: "sentinel", rx: 0.5, ry: 0.2 },
      ],
    },
  ],
};
