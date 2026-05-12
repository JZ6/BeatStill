import type { LevelDef } from "../systems/Levels";

export const level50: LevelDef = {
  id: 50,
  name: "Half and Half",
  description: "Two bosses, one arena",
  waves: [
    {
      enemies: [
        { type: "sentinel", rx: 0.25, ry: 0.2 },
      ],
      walls: [
        { rx: 0.49, ry: 0, rw: 0.02, rh: 0.4, type: "bounce" },
        { rx: 0.49, ry: 0.6, rw: 0.02, rh: 0.4, type: "bounce" },
        { rx: 0.49, ry: 0.4, rw: 0.02, rh: 0.2, type: "glass", hp: 5 },
      ],
    },
    {
      enemies: [
        { type: "phantom", rx: 0.75, ry: 0.2 },
      ],
    },
  ],
};
