import type { LevelDef } from "../systems/Levels";

export const level15: LevelDef = {
  id: 15,
  name: "Ricochet",
  description: "No direct line of sight",
  shipRx: 0.5, shipRy: 0.8,
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.15, ry: 0.15 },
      { type: "sniper", rx: 0.85, ry: 0.15 },
      { type: "sniper", rx: 0.15, ry: 0.5 },
      { type: "sniper", rx: 0.85, ry: 0.5 },
    ],
    walls: [
      { rx: 0.25, ry: 0.05, rw: 0.02, rh: 0.35, type: "bounce" },
      { rx: 0.75, ry: 0.05, rw: 0.02, rh: 0.35, type: "bounce" },
      { rx: 0.25, ry: 0.6, rw: 0.02, rh: 0.35, type: "bounce" },
      { rx: 0.75, ry: 0.6, rw: 0.02, rh: 0.35, type: "bounce" },
      { rx: 0.35, ry: 0.4, rw: 0.3, rh: 0.02, type: "bounce" },
      { rx: 0.45, ry: 0.6, rw: 0.1, rh: 0.02, type: "bounce" },
    ],
  }],
};
