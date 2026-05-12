import type { LevelDef } from "../systems/Levels";

export const level47: LevelDef = {
  id: 47,
  name: "Thunderdome",
  description: "Two enter, one leaves",
  waves: [{
    enemies: [
      { type: "tank", rx: 0.35, ry: 0.35 },
      { type: "tank", rx: 0.65, ry: 0.65 },
      { type: "spiral", rx: 0.5, ry: 0.35 },
      { type: "basic", rx: 0.35, ry: 0.55 },
      { type: "basic", rx: 0.65, ry: 0.45 },
      { type: "basic", rx: 0.45, ry: 0.65 },
      { type: "basic", rx: 0.55, ry: 0.35 },
    ],
    walls: [
      { rx: 0.2, ry: 0.15, rw: 0.6, rh: 0.02, type: "bounce" },
      { rx: 0.2, ry: 0.83, rw: 0.6, rh: 0.02, type: "bounce" },
      { rx: 0.15, ry: 0.2, rw: 0.02, rh: 0.6, type: "bounce" },
      { rx: 0.83, ry: 0.2, rw: 0.02, rh: 0.6, type: "bounce" },
      { rx: 0.15, ry: 0.15, rw: 0.07, rh: 0.02, type: "bounce" },
      { rx: 0.78, ry: 0.15, rw: 0.07, rh: 0.02, type: "bounce" },
      { rx: 0.15, ry: 0.83, rw: 0.07, rh: 0.02, type: "bounce" },
      { rx: 0.78, ry: 0.83, rw: 0.07, rh: 0.02, type: "bounce" },
    ],
  }],
};
