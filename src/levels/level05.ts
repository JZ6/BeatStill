import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level05: LevelDef = {
  id: 5,
  name: "The Swarm",
  description: "They pour through the gaps",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: Array.from({ length: 20 }, (_, i) => {
        const edge = i % 4;
        const offset = 0.15 + (i / 20) * 0.7;
        if (edge === 0) return { type: "swarm" as EnemyType, rx: offset, ry: -0.04 };
        if (edge === 1) return { type: "swarm" as EnemyType, rx: 1.04, ry: offset };
        if (edge === 2) return { type: "swarm" as EnemyType, rx: offset, ry: 1.04 };
        return { type: "swarm" as EnemyType, rx: -0.04, ry: offset };
      }),
      walls: [
        { rx: 0.38, ry: 0.35, rw: 0.24, rh: 0.02, type: "solid" },
        { rx: 0.38, ry: 0.63, rw: 0.24, rh: 0.02, type: "solid" },
        { rx: 0.36, ry: 0.37, rw: 0.02, rh: 0.1, type: "solid" },
        { rx: 0.62, ry: 0.37, rw: 0.02, rh: 0.1, type: "solid" },
        { rx: 0.36, ry: 0.53, rw: 0.02, rh: 0.1, type: "solid" },
        { rx: 0.62, ry: 0.53, rw: 0.02, rh: 0.1, type: "solid" },
      ],
    },
  ],
};
