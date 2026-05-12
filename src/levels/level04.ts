import type { EnemyType } from "../objects/enemies";
import type { LevelDef } from "../systems/Levels";

export const level04: LevelDef = {
  id: 4,
  name: "The Swarm",
  description: "Hold the fort",
  shipRx: 0.5, shipRy: 0.5,
  waves: [{
    enemies: Array.from({ length: 30 }, (_, i) => {
      const edge = i % 4;
      const t = (i / 30) + Math.random() * 0.05;
      if (edge === 0) return { type: "swarm" as EnemyType, rx: t, ry: -0.04 };
      if (edge === 1) return { type: "swarm" as EnemyType, rx: 1.04, ry: t };
      if (edge === 2) return { type: "swarm" as EnemyType, rx: t, ry: 1.04 };
      return { type: "swarm" as EnemyType, rx: -0.04, ry: t };
    }),
    walls: [
      { rx: 0.35, ry: 0.35, rw: 0.3, rh: 0.02, type: "solid" },
      { rx: 0.35, ry: 0.63, rw: 0.3, rh: 0.02, type: "solid" },
      { rx: 0.35, ry: 0.35, rw: 0.02, rh: 0.12, type: "solid" },
      { rx: 0.63, ry: 0.35, rw: 0.02, rh: 0.12, type: "solid" },
      { rx: 0.35, ry: 0.53, rw: 0.02, rh: 0.12, type: "solid" },
      { rx: 0.63, ry: 0.53, rw: 0.02, rh: 0.12, type: "solid" },
    ],
  }],
};
