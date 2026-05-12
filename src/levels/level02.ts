import type { LevelDef } from "../systems/Levels";

export const level02: LevelDef = {
  id: 2,
  name: "Spiral Galaxy",
  description: "Surrounded by spinning death",
  waves: [{
    enemies: [
      { type: "spiral", rx: 0.2, ry: 0.2 },
      { type: "spiral", rx: 0.8, ry: 0.2 },
      { type: "spiral", rx: 0.2, ry: 0.8 },
      { type: "spiral", rx: 0.8, ry: 0.8 },
    ],
    walls: [
      { rx: 0.42, ry: 0.42, rw: 0.16, rh: 0.03, type: "glass", hp: 2 },
      { rx: 0.42, ry: 0.55, rw: 0.16, rh: 0.03, type: "glass", hp: 2 },
      { rx: 0.42, ry: 0.42, rw: 0.03, rh: 0.16, type: "glass", hp: 2 },
      { rx: 0.55, ry: 0.42, rw: 0.03, rh: 0.16, type: "glass", hp: 2 },
    ],
  }],
};
