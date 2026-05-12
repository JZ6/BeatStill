import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level10: LevelDef = {
  id: 10,
  name: "The Maze",
  description: "Hunt them through the corridors",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: Array.from({ length: 10 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.15 + (i % 5) * 0.175,
        ry: -0.04,
      })),
      walls: [
        { rx: 0.25, ry: 0.15, rw: 0.02, rh: 0.3, type: "solid" },
        { rx: 0.5, ry: 0.25, rw: 0.02, rh: 0.35, type: "solid" },
        { rx: 0.75, ry: 0.15, rw: 0.02, rh: 0.3, type: "solid" },
        { rx: 0.15, ry: 0.5, rw: 0.2, rh: 0.02, type: "solid" },
        { rx: 0.6, ry: 0.45, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.25, ry: 0.65, rw: 0.3, rh: 0.02, type: "solid" },
        { rx: 0.65, ry: 0.7, rw: 0.2, rh: 0.02, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.2, ry: 0.1 },
        { type: "tracker", rx: 0.6, ry: 0.1 },
        { type: "tracker", rx: 0.4, ry: 0.3 },
        { type: "tracker", rx: 0.8, ry: 0.2 },
        { type: "snake", rx: 0.3, ry: 0.15 },
        { type: "snake", rx: 0.7, ry: 0.35 },
      ],
    },
  ],
};
