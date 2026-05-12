import type { LevelDef } from "../systems/Levels";

export const level53: LevelDef = {
  id: 53,
  name: "Glass Labyrinth",
  description: "Everything breaks",
  shipRx: 0.5, shipRy: 0.85,
  waves: [{
    enemies: [
      { type: "tracker", rx: 0.2, ry: 0.15 },
      { type: "tracker", rx: 0.8, ry: 0.15 },
      { type: "tracker", rx: 0.5, ry: 0.3 },
      { type: "snake", rx: 0.3, ry: 0.5 },
      { type: "snake", rx: 0.7, ry: 0.5 },
      { type: "snake", rx: 0.5, ry: 0.65 },
    ],
    walls: [
      { rx: 0.2, ry: 0.1, rw: 0.25, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.55, ry: 0.1, rw: 0.25, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.15, ry: 0.25, rw: 0.3, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.55, ry: 0.25, rw: 0.3, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.25, ry: 0.4, rw: 0.2, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.55, ry: 0.4, rw: 0.2, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.3, ry: 0.55, rw: 0.4, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.2, ry: 0.7, rw: 0.25, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.55, ry: 0.7, rw: 0.25, rh: 0.02, type: "glass", hp: 2 },
      { rx: 0.35, ry: 0.1, rw: 0.02, rh: 0.15, type: "glass", hp: 2 },
      { rx: 0.65, ry: 0.1, rw: 0.02, rh: 0.15, type: "glass", hp: 2 },
      { rx: 0.45, ry: 0.25, rw: 0.02, rh: 0.15, type: "glass", hp: 2 },
      { rx: 0.5, ry: 0.55, rw: 0.02, rh: 0.15, type: "glass", hp: 2 },
    ],
  }],
};
