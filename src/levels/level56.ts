import type { LevelDef } from "../systems/Levels";

export const level56: LevelDef = {
  id: 56,
  name: "Double Trouble",
  description: "Two arenas, double the pain",
  shipRx: 0.5, shipRy: 0.5,
  waves: [{
    enemies: [
      { type: "tank", rx: 0.15, ry: 0.35 },
      { type: "tank", rx: 0.15, ry: 0.65 },
      { type: "tracker", rx: 0.25, ry: 0.5 },
      { type: "tracker", rx: 0.1, ry: 0.5 },
      { type: "spiral", rx: 0.8, ry: 0.35 },
      { type: "spiral", rx: 0.8, ry: 0.65 },
      { type: "sniper", rx: 0.85, ry: 0.5 },
      { type: "sniper", rx: 0.75, ry: 0.3 },
    ],
    walls: [
      { rx: 0, ry: 0.2, rw: 0.38, rh: 0.02, type: "glass", hp: 3 },
      { rx: 0, ry: 0.78, rw: 0.38, rh: 0.02, type: "glass", hp: 3 },
      { rx: 0.62, ry: 0.2, rw: 0.38, rh: 0.02, type: "glass", hp: 3 },
      { rx: 0.62, ry: 0.78, rw: 0.38, rh: 0.02, type: "glass", hp: 3 },
      { rx: 0.38, ry: 0.2, rw: 0.02, rh: 0.6, type: "glass", hp: 4 },
      { rx: 0.6, ry: 0.2, rw: 0.02, rh: 0.6, type: "glass", hp: 4 },
    ],
  }],
};
