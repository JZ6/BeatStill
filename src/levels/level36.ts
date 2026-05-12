import type { LevelDef } from "../systems/Levels";

export const level36: LevelDef = {
  id: 36,
  name: "The Phantom Returns",
  description: "Time bends again",
  waves: [
    {
      enemies: [
        { type: "snake", rx: 0.2, ry: 0.3 },
        { type: "snake", rx: 0.8, ry: 0.3 },
        { type: "snake", rx: 0.5, ry: 0.6 },
        { type: "spiral", rx: 0.3, ry: 0.5 },
        { type: "spiral", rx: 0.7, ry: 0.5 },
      ],
      walls: [
        { rx: 0.2, ry: 0.15, rw: 0.02, rh: 0.7, type: "bounce" },
        { rx: 0.78, ry: 0.15, rw: 0.02, rh: 0.7, type: "bounce" },
        { rx: 0.4, ry: 0.4, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "phantom", rx: 0.5, ry: 0.2 },
      ],
    },
  ],
};
