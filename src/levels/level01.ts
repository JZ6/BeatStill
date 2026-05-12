import type { LevelDef } from "../systems/Levels";

export const level01: LevelDef = {
  id: 1,
  name: "The Hallway",
  description: "Two tanks guard the far end",
  shipRx: 0.5, shipRy: 0.85,
  waves: [{
    enemies: [
      { type: "tank", rx: 0.35, ry: 0.1 },
      { type: "tank", rx: 0.65, ry: 0.1 },
    ],
    walls: [
      { rx: 0, ry: 0, rw: 0.3, rh: 1, type: "solid" },
      { rx: 0.7, ry: 0, rw: 0.3, rh: 1, type: "solid" },
    ],
    initialBullets: [
      ...Array.from({ length: 6 }, (_, i) => ({
        rx: 0.35, ry: 0.15, angle: Math.PI / 2 + (i - 2.5) * 0.12, speed: 100,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        rx: 0.65, ry: 0.15, angle: Math.PI / 2 + (i - 2.5) * 0.12, speed: 100,
      })),
    ],
  }],
};
