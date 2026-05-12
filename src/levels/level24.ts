import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level24: LevelDef = {
  id: 24,
  name: "Last Stand",
  description: "Your cover is crumbling",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: Array.from({ length: 10 }, (_, i) => {
        const edge = i % 4;
        const t = 0.15 + (i / 10) * 0.7;
        if (edge === 0) return { type: "swarm" as EnemyType, rx: t, ry: -0.04 };
        if (edge === 1) return { type: "swarm" as EnemyType, rx: 1.04, ry: t };
        if (edge === 2) return { type: "swarm" as EnemyType, rx: t, ry: 1.04 };
        return { type: "swarm" as EnemyType, rx: -0.04, ry: t };
      }),
      walls: [
        { rx: 0.3, ry: 0.28, rw: 0.4, rh: 0.03, type: "glass", hp: 3 },
        { rx: 0.3, ry: 0.69, rw: 0.4, rh: 0.03, type: "glass", hp: 3 },
        { rx: 0.28, ry: 0.28, rw: 0.03, rh: 0.44, type: "glass", hp: 3 },
        { rx: 0.69, ry: 0.28, rw: 0.03, rh: 0.44, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.1, ry: 0.1 },
        { type: "sniper", rx: 0.9, ry: 0.1 },
        { type: "sniper", rx: 0.1, ry: 0.9 },
        { type: "sniper", rx: 0.9, ry: 0.9 },
        { type: "tracker", rx: 0.5, ry: 0.05 },
        { type: "tracker", rx: 0.5, ry: 0.95 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.2, ry: 0.2 },
        { type: "tank", rx: 0.8, ry: 0.2 },
        { type: "tank", rx: 0.2, ry: 0.8 },
        { type: "tank", rx: 0.8, ry: 0.8 },
        { type: "spiral", rx: 0.5, ry: 0.15 },
        { type: "spiral", rx: 0.5, ry: 0.85 },
      ],
    },
  ],
};
