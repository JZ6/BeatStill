import type { LevelDef } from "../systems/Levels";

export const level46: LevelDef = {
  id: 46,
  name: "No Man's Land",
  description: "Cross the open ground",
  shipRx: 0.5, shipRy: 0.85,
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.08, ry: 0.25 },
      { type: "sniper", rx: 0.08, ry: 0.55 },
      { type: "sniper", rx: 0.08, ry: 0.75 },
      { type: "sniper", rx: 0.92, ry: 0.25 },
      { type: "sniper", rx: 0.92, ry: 0.55 },
      { type: "sniper", rx: 0.92, ry: 0.75 },
      { type: "tracker", rx: 0.4, ry: 0.4 },
      { type: "tracker", rx: 0.6, ry: 0.4 },
      { type: "tracker", rx: 0.5, ry: 0.55 },
    ],
    walls: [
      { rx: 0, ry: 0.15, rw: 0.18, rh: 0.7, type: "glass", hp: 4 },
      { rx: 0.82, ry: 0.15, rw: 0.18, rh: 0.7, type: "glass", hp: 4 },
      { rx: 0.4, ry: 0.65, rw: 0.2, rh: 0.02, type: "glass", hp: 2 },
    ],
  }],
};
