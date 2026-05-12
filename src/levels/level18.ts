import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level18: LevelDef = {
  id: 18,
  name: "Pinball",
  description: "Total chaos",
  waves: [{
    enemies: Array.from({ length: 20 }, (_, i) => {
      const edge = i % 4;
      const t = 0.1 + (i / 20) * 0.8;
      if (edge === 0) return { type: "swarm" as EnemyType, rx: t, ry: -0.04 };
      if (edge === 1) return { type: "swarm" as EnemyType, rx: 1.04, ry: t };
      if (edge === 2) return { type: "swarm" as EnemyType, rx: t, ry: 1.04 };
      return { type: "swarm" as EnemyType, rx: -0.04, ry: t };
    }),
    walls: [
      { rx: 0.2, ry: 0.2, rw: 0.08, rh: 0.08, type: "bounce" },
      { rx: 0.45, ry: 0.15, rw: 0.1, rh: 0.06, type: "bounce" },
      { rx: 0.72, ry: 0.22, rw: 0.08, rh: 0.08, type: "bounce" },
      { rx: 0.15, ry: 0.48, rw: 0.06, rh: 0.1, type: "bounce" },
      { rx: 0.45, ry: 0.45, rw: 0.1, rh: 0.1, type: "bounce" },
      { rx: 0.78, ry: 0.45, rw: 0.06, rh: 0.1, type: "bounce" },
      { rx: 0.22, ry: 0.72, rw: 0.08, rh: 0.06, type: "bounce" },
      { rx: 0.48, ry: 0.78, rw: 0.06, rh: 0.08, type: "bounce" },
      { rx: 0.7, ry: 0.7, rw: 0.1, rh: 0.06, type: "bounce" },
    ],
  }],
};
