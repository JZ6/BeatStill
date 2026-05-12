import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level54: LevelDef = {
  id: 54,
  name: "The Coliseum",
  description: "Wave after wave in the arena",
  waves: [
    {
      enemies: Array.from({ length: 10 }, (_, i) => ({
        type: "swarm" as EnemyType,
        rx: 0.2 + (i % 5) * 0.15,
        ry: -0.04,
      })),
      walls: [
        { rx: 0.1, ry: 0.1, rw: 0.8, rh: 0.02, type: "bounce" },
        { rx: 0.1, ry: 0.88, rw: 0.8, rh: 0.02, type: "bounce" },
        { rx: 0.1, ry: 0.1, rw: 0.02, rh: 0.8, type: "bounce" },
        { rx: 0.88, ry: 0.1, rw: 0.02, rh: 0.8, type: "bounce" },
      ],
    },
    {
      enemies: [
        { type: "tracker", rx: 0.3, ry: 0.2 },
        { type: "tracker", rx: 0.7, ry: 0.2 },
        { type: "tracker", rx: 0.3, ry: 0.7 },
        { type: "tracker", rx: 0.7, ry: 0.7 },
        { type: "sniper", rx: 0.5, ry: 0.3 },
        { type: "sniper", rx: 0.5, ry: 0.6 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.2 },
        { type: "tank", rx: 0.7, ry: 0.2 },
        { type: "spiral", rx: 0.5, ry: 0.4 },
        { type: "spiral", rx: 0.3, ry: 0.6 },
        { type: "spiral", rx: 0.7, ry: 0.6 },
      ],
    },
  ],
};
