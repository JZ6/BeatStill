import type { LevelDef } from "../systems/Levels";

export const level07: LevelDef = {
  id: 7,
  name: "Boss Rush",
  description: "Everything at once",
  waves: [{
    enemies: [
      { type: "tank", rx: 0.2, ry: 0.1 },
      { type: "tank", rx: 0.5, ry: 0.05 },
      { type: "tank", rx: 0.8, ry: 0.1 },
      { type: "spiral", rx: 0.1, ry: 0.5 },
      { type: "spiral", rx: 0.9, ry: 0.5 },
      { type: "tracker", rx: 0.15, ry: 0.85 },
      { type: "tracker", rx: 0.4, ry: 0.9 },
      { type: "tracker", rx: 0.6, ry: 0.9 },
      { type: "tracker", rx: 0.85, ry: 0.85 },
    ],
    walls: [
      { rx: 0.25, ry: 0.35, rw: 0.1, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.65, ry: 0.35, rw: 0.1, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.45, ry: 0.55, rw: 0.1, rh: 0.08, type: "glass", hp: 2 },
    ],
  }],
};
