import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level60: LevelDef = {
  id: 60,
  name: "Omega",
  description: "The final test",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        ...Array.from({ length: 6 }, (_, i) => ({
          type: "swarm" as EnemyType,
          rx: 0.15 + (i % 3) * 0.3,
          ry: -0.04,
        })),
        { type: "tracker" as EnemyType, rx: 0.2, ry: 0.2 },
        { type: "tracker" as EnemyType, rx: 0.8, ry: 0.2 },
        { type: "tracker" as EnemyType, rx: 0.5, ry: 0.15 },
        { type: "tracker" as EnemyType, rx: 0.35, ry: 0.3 },
        { type: "sniper" as EnemyType, rx: 0.1, ry: 0.4 },
        { type: "sniper" as EnemyType, rx: 0.9, ry: 0.4 },
      ],
      walls: [
        { rx: 0.15, ry: 0.15, rw: 0.02, rh: 0.7, type: "bounce" },
        { rx: 0.83, ry: 0.15, rw: 0.02, rh: 0.7, type: "bounce" },
        { rx: 0.4, ry: 0.4, rw: 0.2, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.35, ry: 0.6, rw: 0.3, rh: 0.02, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "sentinel", rx: 0.5, ry: 0.15 },
      ],
    },
    {
      enemies: [
        { type: "snake", rx: 0.2, ry: 0.3 },
        { type: "snake", rx: 0.8, ry: 0.3 },
        { type: "snake", rx: 0.5, ry: 0.5 },
        { type: "snake", rx: 0.35, ry: 0.7 },
        { type: "spiral", rx: 0.3, ry: 0.15 },
        { type: "spiral", rx: 0.7, ry: 0.15 },
      ],
    },
    {
      enemies: [
        { type: "phantom", rx: 0.5, ry: 0.2 },
      ],
    },
  ],
};
