import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level40: LevelDef = {
  id: 40,
  name: "The Sentinel's Revenge",
  description: "The fortress evolved",
  waves: [
    {
      enemies: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: "swarm" as EnemyType,
          rx: 0.15 + (i % 4) * 0.23,
          ry: -0.04,
        })),
        { type: "tracker" as EnemyType, rx: 0.2, ry: 0.9 },
        { type: "tracker" as EnemyType, rx: 0.5, ry: 0.9 },
        { type: "tracker" as EnemyType, rx: 0.8, ry: 0.9 },
        { type: "tracker" as EnemyType, rx: 0.35, ry: 0.85 },
      ],
      walls: [
        { rx: 0.1, ry: 0.15, rw: 0.02, rh: 0.7, type: "bounce" },
        { rx: 0.88, ry: 0.15, rw: 0.02, rh: 0.7, type: "bounce" },
        { rx: 0.35, ry: 0.4, rw: 0.12, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.55, ry: 0.55, rw: 0.12, rh: 0.02, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "sentinel", rx: 0.5, ry: 0.15 },
      ],
    },
  ],
};
