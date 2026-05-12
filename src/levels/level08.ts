import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level08: LevelDef = {
  id: 8,
  name: "The Gauntlet",
  description: "Three waves, no rest",
  waves: [
    {
      enemies: Array.from({ length: 15 }, (_, i) => {
        const edge = i % 4;
        const t = 0.1 + (i / 15) * 0.8;
        if (edge === 0) return { type: "swarm" as EnemyType, rx: t, ry: -0.04 };
        if (edge === 1) return { type: "swarm" as EnemyType, rx: 1.04, ry: t };
        if (edge === 2) return { type: "swarm" as EnemyType, rx: t, ry: 1.04 };
        return { type: "swarm" as EnemyType, rx: -0.04, ry: t };
      }),
    },
    {
      enemies: [
        { type: "sniper", rx: 0.05, ry: 0.15 },
        { type: "sniper", rx: 0.05, ry: 0.5 },
        { type: "sniper", rx: 0.05, ry: 0.85 },
        { type: "sniper", rx: 0.95, ry: 0.15 },
        { type: "sniper", rx: 0.95, ry: 0.5 },
        { type: "sniper", rx: 0.95, ry: 0.85 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.1 },
        { type: "tank", rx: 0.7, ry: 0.1 },
        { type: "spiral", rx: 0.15, ry: 0.5 },
        { type: "spiral", rx: 0.85, ry: 0.5 },
      ],
    },
  ],
};
