import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level12: LevelDef = {
  id: 12,
  name: "Pinball",
  description: "Everything ricochets",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        ...Array.from({ length: 15 }, (_, i) => ({
          type: "swarm" as EnemyType,
          rx: 0.1 + (i % 5) * 0.2,
          ry: -0.04 - (i % 3) * 0.03,
        })),
        { type: "basic" as EnemyType, rx: 0.3, ry: 0.3 },
        { type: "basic" as EnemyType, rx: 0.7, ry: 0.3 },
        { type: "basic" as EnemyType, rx: 0.3, ry: 0.6 },
        { type: "basic" as EnemyType, rx: 0.7, ry: 0.6 },
      ],
      walls: [
        { rx: 0.22, ry: 0.2, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.47, ry: 0.15, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.72, ry: 0.2, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.15, ry: 0.45, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.47, ry: 0.42, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.8, ry: 0.45, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.3, ry: 0.68, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.55, ry: 0.65, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.8, ry: 0.7, rw: 0.06, rh: 0.06, type: "bounce" },
      ],
    },
  ],
};
