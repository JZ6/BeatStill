import type { LevelDef } from "../systems/Levels";

export const level44: LevelDef = {
  id: 44,
  name: "Spiral Staircase",
  description: "Wind through the spiral",
  waves: [{
    enemies: [
      { type: "spiral", rx: 0.3, ry: 0.3 },
      { type: "spiral", rx: 0.7, ry: 0.7 },
      { type: "spiral", rx: 0.5, ry: 0.5 },
      { type: "circler", rx: 0.2, ry: 0.6 },
      { type: "circler", rx: 0.8, ry: 0.4 },
    ],
    walls: [
      { rx: 0.15, ry: 0.15, rw: 0.5, rh: 0.02, type: "bounce" },
      { rx: 0.65, ry: 0.15, rw: 0.02, rh: 0.3, type: "bounce" },
      { rx: 0.35, ry: 0.35, rw: 0.32, rh: 0.02, type: "bounce" },
      { rx: 0.35, ry: 0.35, rw: 0.02, rh: 0.3, type: "bounce" },
      { rx: 0.35, ry: 0.55, rw: 0.32, rh: 0.02, type: "bounce" },
      { rx: 0.15, ry: 0.15, rw: 0.02, rh: 0.7, type: "bounce" },
      { rx: 0.15, ry: 0.83, rw: 0.7, rh: 0.02, type: "bounce" },
      { rx: 0.83, ry: 0.35, rw: 0.02, rh: 0.5, type: "bounce" },
    ],
  }],
};
