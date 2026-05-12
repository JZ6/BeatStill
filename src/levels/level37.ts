import type { LevelDef } from "../systems/Levels";

export const level37: LevelDef = {
  id: 37,
  name: "Cage Match",
  description: "Tiny arena, big guns",
  shipRx: 0.5, shipRy: 0.55,
  waves: [{
    enemies: [
      { type: "tank", rx: 0.4, ry: 0.4 },
      { type: "tank", rx: 0.6, ry: 0.4 },
    ],
    walls: [
      { rx: 0.3, ry: 0.3, rw: 0.4, rh: 0.02, type: "bounce" },
      { rx: 0.3, ry: 0.68, rw: 0.4, rh: 0.02, type: "bounce" },
      { rx: 0.3, ry: 0.3, rw: 0.02, rh: 0.4, type: "bounce" },
      { rx: 0.68, ry: 0.3, rw: 0.02, rh: 0.4, type: "bounce" },
    ],
  }],
};
