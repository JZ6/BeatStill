import type { LevelDef } from "../systems/Levels";

export const level12: LevelDef = {
  id: 12,
  name: "The Arena",
  description: "Bullets ricochet everywhere",
  waves: [{
    enemies: [
      { type: "tracker", rx: 0.3, ry: 0.3 },
      { type: "tracker", rx: 0.7, ry: 0.3 },
      { type: "tracker", rx: 0.3, ry: 0.7 },
      { type: "tracker", rx: 0.7, ry: 0.7 },
      { type: "tracker", rx: 0.5, ry: 0.2 },
      { type: "tracker", rx: 0.5, ry: 0.8 },
    ],
    walls: [
      { rx: 0.3, ry: 0.1, rw: 0.4, rh: 0.02, type: "bounce" },
      { rx: 0.3, ry: 0.88, rw: 0.4, rh: 0.02, type: "bounce" },
      { rx: 0.1, ry: 0.3, rw: 0.02, rh: 0.4, type: "bounce" },
      { rx: 0.88, ry: 0.3, rw: 0.02, rh: 0.4, type: "bounce" },
      { rx: 0.1, ry: 0.12, rw: 0.2, rh: 0.02, type: "bounce" },
      { rx: 0.7, ry: 0.12, rw: 0.2, rh: 0.02, type: "bounce" },
      { rx: 0.1, ry: 0.86, rw: 0.2, rh: 0.02, type: "bounce" },
      { rx: 0.7, ry: 0.86, rw: 0.2, rh: 0.02, type: "bounce" },
    ],
  }],
};
