import type { LevelDef } from "../systems/Levels";

export const level16: LevelDef = {
  id: 16,
  name: "The Fortress",
  description: "Break into the compound",
  shipRx: 0.5, shipRy: 0.85,
  waves: [{
    enemies: [
      { type: "tank", rx: 0.4, ry: 0.35 },
      { type: "tank", rx: 0.6, ry: 0.35 },
      { type: "spiral", rx: 0.5, ry: 0.45 },
      { type: "sniper", rx: 0.35, ry: 0.5 },
      { type: "sniper", rx: 0.65, ry: 0.5 },
    ],
    walls: [
      { rx: 0.25, ry: 0.2, rw: 0.5, rh: 0.03, type: "glass", hp: 4 },
      { rx: 0.25, ry: 0.6, rw: 0.5, rh: 0.03, type: "glass", hp: 4 },
      { rx: 0.25, ry: 0.2, rw: 0.03, rh: 0.43, type: "glass", hp: 4 },
      { rx: 0.72, ry: 0.2, rw: 0.03, rh: 0.43, type: "glass", hp: 4 },
    ],
  }],
};
