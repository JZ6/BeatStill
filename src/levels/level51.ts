import type { LevelDef } from "../systems/Levels";

export const level51: LevelDef = {
  id: 51,
  name: "The Grinder",
  description: "Zigzag of death",
  shipRx: 0.15, shipRy: 0.85,
  waves: [
    {
      enemies: [
        { type: "basic", rx: 0.8, ry: 0.8 },
        { type: "basic", rx: 0.85, ry: 0.75 },
        { type: "sniper", rx: 0.5, ry: 0.55 },
      ],
      walls: [
        { rx: 0, ry: 0.65, rw: 0.7, rh: 0.02, type: "solid" },
        { rx: 0.3, ry: 0.35, rw: 0.7, rh: 0.02, type: "solid" },
        { rx: 0, ry: 0, rw: 0.02, rh: 0.65, type: "solid" },
        { rx: 0.98, ry: 0.35, rw: 0.02, rh: 0.65, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.5, ry: 0.2 },
        { type: "tracker", rx: 0.8, ry: 0.15 },
        { type: "sniper", rx: 0.2, ry: 0.5 },
        { type: "sniper", rx: 0.7, ry: 0.5 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.85, ry: 0.1 },
        { type: "spiral", rx: 0.5, ry: 0.2 },
        { type: "tracker", rx: 0.2, ry: 0.15 },
      ],
    },
  ],
};
