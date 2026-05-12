import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level14: LevelDef = {
  id: 14,
  name: "The Maze",
  description: "They hunt through the corridors",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: Array.from({ length: 12 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.15 + (i % 4) * 0.25,
        ry: 0.05 + Math.floor(i / 4) * 0.1,
      })),
      walls: [
        { rx: 0.2, ry: 0.2, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.55, ry: 0.2, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.35, ry: 0.35, rw: 0.3, rh: 0.02, type: "solid" },
        { rx: 0.1, ry: 0.5, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.65, ry: 0.5, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.3, ry: 0.65, rw: 0.4, rh: 0.02, type: "solid" },
        { rx: 0.4, ry: 0.2, rw: 0.02, rh: 0.15, type: "solid" },
        { rx: 0.6, ry: 0.35, rw: 0.02, rh: 0.15, type: "solid" },
        { rx: 0.3, ry: 0.5, rw: 0.02, rh: 0.15, type: "solid" },
        { rx: 0.7, ry: 0.5, rw: 0.02, rh: 0.15, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.2, ry: 0.1 },
        { type: "tracker", rx: 0.5, ry: 0.1 },
        { type: "tracker", rx: 0.8, ry: 0.1 },
        { type: "tracker", rx: 0.35, ry: 0.3 },
        { type: "tracker", rx: 0.65, ry: 0.3 },
      ],
    },
  ],
};
