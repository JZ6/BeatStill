import type { LevelDef } from "../systems/Levels";

export const level42: LevelDef = {
  id: 42,
  name: "The Phantom's Maze",
  description: "It teleports through walls",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        { type: "sniper", rx: 0.2, ry: 0.15 },
        { type: "sniper", rx: 0.8, ry: 0.15 },
        { type: "sniper", rx: 0.5, ry: 0.3 },
        { type: "sniper", rx: 0.35, ry: 0.5 },
        { type: "snake", rx: 0.5, ry: 0.6 },
        { type: "snake", rx: 0.7, ry: 0.4 },
      ],
      walls: [
        { rx: 0.3, ry: 0.2, rw: 0.15, rh: 0.02, type: "solid" },
        { rx: 0.55, ry: 0.2, rw: 0.15, rh: 0.02, type: "solid" },
        { rx: 0.2, ry: 0.4, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.55, ry: 0.4, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.35, ry: 0.6, rw: 0.3, rh: 0.02, type: "solid" },
        { rx: 0.4, ry: 0.2, rw: 0.02, rh: 0.2, type: "solid" },
        { rx: 0.6, ry: 0.4, rw: 0.02, rh: 0.2, type: "solid" },
        { rx: 0.3, ry: 0.6, rw: 0.02, rh: 0.15, type: "glass", hp: 2 },
        { rx: 0.7, ry: 0.6, rw: 0.02, rh: 0.15, type: "glass", hp: 2 },
      ],
    },
    {
      enemies: [
        { type: "phantom", rx: 0.5, ry: 0.15 },
      ],
    },
  ],
};
