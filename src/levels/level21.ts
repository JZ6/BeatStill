import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level21: LevelDef = {
  id: 21,
  name: "The Siege",
  description: "Four waves, cover crumbles",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: Array.from({ length: 8 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.15 + (i % 4) * 0.22,
        ry: -0.04,
      })),
      walls: [
        { rx: 0.25, ry: 0.7, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.55, ry: 0.7, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.25, ry: 0.7, rw: 0.02, rh: 0.15, type: "glass", hp: 3 },
        { rx: 0.73, ry: 0.7, rw: 0.02, rh: 0.15, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.15, ry: 0.15 },
        { type: "sniper", rx: 0.85, ry: 0.15 },
        { type: "sniper", rx: 0.5, ry: 0.1 },
        { type: "tracker", rx: 0.3, ry: 0.3 },
        { type: "tracker", rx: 0.7, ry: 0.3 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.1 },
        { type: "tank", rx: 0.7, ry: 0.1 },
        { type: "spiral", rx: 0.2, ry: 0.4 },
        { type: "spiral", rx: 0.8, ry: 0.4 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.4, ry: 0.15 },
        { type: "tank", rx: 0.6, ry: 0.15 },
        { type: "spiral", rx: 0.5, ry: 0.3 },
        { type: "snake", rx: 0.2, ry: 0.5 },
        { type: "snake", rx: 0.8, ry: 0.5 },
      ],
    },
  ],
};
