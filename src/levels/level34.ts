import type { LevelDef } from "../systems/Levels";

export const level34: LevelDef = {
  id: 34,
  name: "Diamond",
  description: "Bouncing inside the gem",
  waves: [{
    enemies: [
      { type: "circler", rx: 0.4, ry: 0.4 },
      { type: "circler", rx: 0.6, ry: 0.6 },
      { type: "spiral", rx: 0.5, ry: 0.35 },
      { type: "spiral", rx: 0.5, ry: 0.65 },
    ],
    walls: [
      { rx: 0.35, ry: 0.15, rw: 0.3, rh: 0.02, type: "bounce" },
      { rx: 0.35, ry: 0.83, rw: 0.3, rh: 0.02, type: "bounce" },
      { rx: 0.15, ry: 0.35, rw: 0.02, rh: 0.3, type: "bounce" },
      { rx: 0.83, ry: 0.35, rw: 0.02, rh: 0.3, type: "bounce" },
      { rx: 0.15, ry: 0.15, rw: 0.2, rh: 0.02, type: "bounce" },
      { rx: 0.65, ry: 0.15, rw: 0.2, rh: 0.02, type: "bounce" },
      { rx: 0.15, ry: 0.83, rw: 0.2, rh: 0.02, type: "bounce" },
      { rx: 0.65, ry: 0.83, rw: 0.2, rh: 0.02, type: "bounce" },
    ],
  }],
};
