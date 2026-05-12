import type { LevelDef } from "../systems/Levels";

export const level05: LevelDef = {
  id: 5,
  name: "Crossfire",
  description: "Tanks on all sides, bullets bounce",
  waves: [{
    enemies: [
      { type: "tank", rx: 0.5, ry: 0.05 },
      { type: "tank", rx: 0.95, ry: 0.5 },
      { type: "tank", rx: 0.5, ry: 0.95 },
      { type: "tank", rx: 0.05, ry: 0.5 },
    ],
    walls: [
      { rx: 0.3, ry: 0.3, rw: 0.18, rh: 0.02, type: "bounce" },
      { rx: 0.52, ry: 0.68, rw: 0.18, rh: 0.02, type: "bounce" },
      { rx: 0.3, ry: 0.52, rw: 0.02, rh: 0.18, type: "bounce" },
      { rx: 0.68, ry: 0.3, rw: 0.02, rh: 0.18, type: "bounce" },
    ],
  }],
};
