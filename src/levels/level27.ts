import type { LevelDef } from "../systems/Levels";

export const level27: LevelDef = {
  id: 27,
  name: "Storm",
  description: "Every enemy, all at once",
  shipRx: 0.5, shipRy: 0.5,
  waves: [
    {
      enemies: [
        { type: "basic", rx: 0.5, ry: 0.1 },
        { type: "tracker", rx: 0.2, ry: 0.2 },
        { type: "tracker", rx: 0.8, ry: 0.2 },
        { type: "sniper", rx: 0.1, ry: 0.4 },
        { type: "sniper", rx: 0.9, ry: 0.4 },
        { type: "spiral", rx: 0.3, ry: 0.15 },
        { type: "spiral", rx: 0.7, ry: 0.15 },
        { type: "tank", rx: 0.5, ry: 0.3 },
        { type: "swarm", rx: 0.15, ry: -0.04 },
        { type: "swarm", rx: 0.5, ry: -0.04 },
        { type: "swarm", rx: 0.85, ry: -0.04 },
        { type: "snake", rx: 0.35, ry: 0.6 },
        { type: "snake", rx: 0.65, ry: 0.6 },
        { type: "circler", rx: 0.5, ry: 0.45 },
      ],
      walls: [
        { rx: 0.35, ry: 0.4, rw: 0.08, rh: 0.06, type: "glass", hp: 2 },
        { rx: 0.57, ry: 0.4, rw: 0.08, rh: 0.06, type: "glass", hp: 2 },
        { rx: 0.25, ry: 0.6, rw: 0.06, rh: 0.06, type: "glass", hp: 2 },
        { rx: 0.69, ry: 0.6, rw: 0.06, rh: 0.06, type: "glass", hp: 2 },
        { rx: 0.46, ry: 0.7, rw: 0.08, rh: 0.06, type: "glass", hp: 2 },
      ],
    },
  ],
};
