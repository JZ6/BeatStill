import type { LevelDef } from "../systems/Levels";

export const level21: LevelDef = {
  id: 21,
  name: "Mirror Match",
  description: "Split down the middle",
  waves: [{
    enemies: [
      { type: "tracker", rx: 0.15, ry: 0.3 },
      { type: "tracker", rx: 0.15, ry: 0.7 },
      { type: "sniper", rx: 0.25, ry: 0.5 },
      { type: "tracker", rx: 0.85, ry: 0.3 },
      { type: "tracker", rx: 0.85, ry: 0.7 },
      { type: "sniper", rx: 0.75, ry: 0.5 },
      { type: "spiral", rx: 0.15, ry: 0.15 },
      { type: "spiral", rx: 0.85, ry: 0.85 },
    ],
    walls: [
      { rx: 0.49, ry: 0, rw: 0.02, rh: 0.35, type: "bounce" },
      { rx: 0.49, ry: 0.65, rw: 0.02, rh: 0.35, type: "bounce" },
      { rx: 0.49, ry: 0.42, rw: 0.02, rh: 0.08, type: "glass", hp: 2 },
    ],
  }],
};
