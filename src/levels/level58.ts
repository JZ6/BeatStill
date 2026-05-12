import type { LevelDef } from "../systems/Levels";

export const level58: LevelDef = {
  id: 58,
  name: "Storm",
  description: "Every enemy type at once",
  waves: [{
    enemies: [
      { type: "basic", rx: 0.5, ry: 0.1 },
      { type: "tracker", rx: 0.2, ry: 0.2 },
      { type: "tracker", rx: 0.8, ry: 0.2 },
      { type: "sniper", rx: 0.1, ry: 0.5 },
      { type: "sniper", rx: 0.9, ry: 0.5 },
      { type: "spiral", rx: 0.3, ry: 0.4 },
      { type: "spiral", rx: 0.7, ry: 0.4 },
      { type: "tank", rx: 0.5, ry: 0.15 },
      { type: "swarm", rx: 0.2, ry: -0.04 },
      { type: "swarm", rx: 0.4, ry: -0.04 },
      { type: "swarm", rx: 0.6, ry: -0.04 },
      { type: "swarm", rx: 0.8, ry: -0.04 },
      { type: "snake", rx: 0.15, ry: 0.7 },
      { type: "snake", rx: 0.85, ry: 0.7 },
      { type: "circler", rx: 0.5, ry: 0.6 },
    ],
    walls: [
      { rx: 0.3, ry: 0.35, rw: 0.12, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.58, ry: 0.35, rw: 0.12, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.44, ry: 0.55, rw: 0.12, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.2, ry: 0.6, rw: 0.08, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.72, ry: 0.6, rw: 0.08, rh: 0.08, type: "glass", hp: 2 },
    ],
  }],
};
