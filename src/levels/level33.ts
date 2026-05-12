import type { LevelDef } from "../systems/Levels";

export const level33: LevelDef = {
  id: 33,
  name: "Corridor Run",
  description: "Run and gun",
  shipRx: 0.5, shipRy: 0.9,
  waves: [{
    enemies: [
      { type: "tank", rx: 0.5, ry: 0.08 },
      { type: "sniper", rx: 0.35, ry: 0.15 },
      { type: "sniper", rx: 0.65, ry: 0.15 },
      { type: "basic", rx: 0.4, ry: 0.3 },
      { type: "basic", rx: 0.6, ry: 0.3 },
      { type: "basic", rx: 0.5, ry: 0.5 },
    ],
    walls: [
      { rx: 0, ry: 0, rw: 0.28, rh: 1, type: "solid" },
      { rx: 0.72, ry: 0, rw: 0.28, rh: 1, type: "solid" },
      { rx: 0.35, ry: 0.25, rw: 0.12, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.55, ry: 0.4, rw: 0.12, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.35, ry: 0.55, rw: 0.12, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.55, ry: 0.7, rw: 0.12, rh: 0.02, type: "glass", hp: 2 },
    ],
  }],
};
