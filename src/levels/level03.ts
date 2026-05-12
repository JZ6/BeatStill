import type { LevelDef } from "../systems/Levels";

export const level03: LevelDef = {
  id: 3,
  name: "Sniper Alley",
  description: "Six snipers line the walls",
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.05, ry: 0.2 },
      { type: "sniper", rx: 0.05, ry: 0.5 },
      { type: "sniper", rx: 0.05, ry: 0.8 },
      { type: "sniper", rx: 0.95, ry: 0.2 },
      { type: "sniper", rx: 0.95, ry: 0.5 },
      { type: "sniper", rx: 0.95, ry: 0.8 },
    ],
    walls: [
      { rx: 0.38, ry: 0.25, rw: 0.06, rh: 0.15, type: "glass", hp: 3 },
      { rx: 0.56, ry: 0.25, rw: 0.06, rh: 0.15, type: "glass", hp: 3 },
      { rx: 0.38, ry: 0.6, rw: 0.06, rh: 0.15, type: "glass", hp: 3 },
      { rx: 0.56, ry: 0.6, rw: 0.06, rh: 0.15, type: "glass", hp: 3 },
      { rx: 0.12, ry: 0, rw: 0.03, rh: 1, type: "bounce" },
      { rx: 0.85, ry: 0, rw: 0.03, rh: 1, type: "bounce" },
    ],
  }],
};
