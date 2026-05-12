import type { LevelDef } from "../systems/Levels";

export const level13: LevelDef = {
  id: 13,
  name: "Glass House",
  description: "Break out or be boxed in",
  shipRx: 0.5, shipRy: 0.5,
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.1, ry: 0.2 },
      { type: "sniper", rx: 0.9, ry: 0.2 },
      { type: "sniper", rx: 0.1, ry: 0.8 },
      { type: "sniper", rx: 0.9, ry: 0.8 },
      { type: "tank", rx: 0.5, ry: 0.05 },
      { type: "tank", rx: 0.5, ry: 0.95 },
    ],
    walls: [
      { rx: 0.3, ry: 0.3, rw: 0.4, rh: 0.03, type: "glass", hp: 3 },
      { rx: 0.3, ry: 0.67, rw: 0.4, rh: 0.03, type: "glass", hp: 3 },
      { rx: 0.3, ry: 0.3, rw: 0.03, rh: 0.4, type: "glass", hp: 3 },
      { rx: 0.67, ry: 0.3, rw: 0.03, rh: 0.4, type: "glass", hp: 3 },
    ],
  }],
};
