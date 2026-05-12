import type { LevelDef } from "../systems/Levels";

export const level17: LevelDef = {
  id: 17,
  name: "Killbox",
  description: "Caught in the corridor",
  shipRx: 0.5, shipRy: 0.5,
  waves: [{
    enemies: [
      { type: "tank", rx: 0.5, ry: 0.05 },
      { type: "tank", rx: 0.5, ry: 0.95 },
      { type: "sniper", rx: 0.15, ry: 0.3 },
      { type: "sniper", rx: 0.15, ry: 0.7 },
      { type: "sniper", rx: 0.85, ry: 0.3 },
      { type: "sniper", rx: 0.85, ry: 0.7 },
    ],
    walls: [
      { rx: 0, ry: 0, rw: 0.3, rh: 1, type: "solid" },
      { rx: 0.7, ry: 0, rw: 0.3, rh: 1, type: "solid" },
      { rx: 0.3, ry: 0.25, rw: 0.03, rh: 0.2, type: "glass", hp: 3 },
      { rx: 0.3, ry: 0.55, rw: 0.03, rh: 0.2, type: "glass", hp: 3 },
      { rx: 0.67, ry: 0.25, rw: 0.03, rh: 0.2, type: "glass", hp: 3 },
      { rx: 0.67, ry: 0.55, rw: 0.03, rh: 0.2, type: "glass", hp: 3 },
    ],
  }],
};
