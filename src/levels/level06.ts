import type { LevelDef } from "../systems/Levels";

export const level06: LevelDef = {
  id: 6,
  name: "Asteroid Field",
  description: "Navigate the debris",
  shipRx: 0.15, shipRy: 0.5,
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.85, ry: 0.3 },
      { type: "sniper", rx: 0.85, ry: 0.7 },
    ],
    asteroids: [
      { rx: 0.3, ry: 0.2, size: "large" },
      { rx: 0.45, ry: 0.45, size: "large" },
      { rx: 0.55, ry: 0.7, size: "large" },
      { rx: 0.65, ry: 0.25, size: "large" },
      { rx: 0.4, ry: 0.8, size: "medium" },
      { rx: 0.7, ry: 0.55, size: "medium" },
      { rx: 0.35, ry: 0.55, size: "medium" },
      { rx: 0.6, ry: 0.9, size: "medium" },
    ],
    walls: [
      { rx: 0, ry: 0.35, rw: 0.22, rh: 0.02, type: "solid" },
      { rx: 0, ry: 0.63, rw: 0.22, rh: 0.02, type: "solid" },
      { rx: 0.78, ry: 0.15, rw: 0.02, rh: 0.25, type: "solid" },
      { rx: 0.78, ry: 0.6, rw: 0.02, rh: 0.25, type: "solid" },
    ],
  }],
};
