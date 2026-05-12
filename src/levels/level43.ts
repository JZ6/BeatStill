import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level43: LevelDef = {
  id: 43,
  name: "Final Approach",
  description: "Build up to all-out war",
  shipRx: 0.5, shipRy: 0.9,
  waves: [
    {
      enemies: Array.from({ length: 10 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.35 + (i % 3) * 0.15,
        ry: 0.05 + Math.floor(i / 3) * 0.1,
      })),
      walls: [
        { rx: 0, ry: 0, rw: 0.3, rh: 1, type: "solid" },
        { rx: 0.7, ry: 0, rw: 0.3, rh: 1, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.2, ry: 0.2 },
        { type: "sniper", rx: 0.8, ry: 0.2 },
        { type: "spiral", rx: 0.5, ry: 0.3 },
        { type: "tracker", rx: 0.3, ry: 0.6 },
        { type: "tracker", rx: 0.7, ry: 0.6 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.2, ry: 0.1 },
        { type: "tank", rx: 0.5, ry: 0.08 },
        { type: "tank", rx: 0.8, ry: 0.1 },
        { type: "spiral", rx: 0.15, ry: 0.5 },
        { type: "spiral", rx: 0.85, ry: 0.5 },
        { type: "circler", rx: 0.5, ry: 0.4 },
      ],
    },
  ],
};
