import type { LevelDef } from "../systems/Levels";

export const level16: LevelDef = {
  id: 16,
  name: "The Labyrinth",
  description: "Every wall type, escalating threat",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        { type: "swarm", rx: 0.2, ry: 0.1 },
        { type: "swarm", rx: 0.4, ry: 0.05 },
        { type: "swarm", rx: 0.6, ry: 0.1 },
        { type: "swarm", rx: 0.8, ry: 0.05 },
        { type: "swarm", rx: 0.3, ry: 0.2 },
        { type: "swarm", rx: 0.7, ry: 0.2 },
        { type: "tracker", rx: 0.5, ry: 0.15 },
        { type: "tracker", rx: 0.15, ry: 0.3 },
      ],
      walls: [
        { rx: 0.2, ry: 0.3, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.55, ry: 0.3, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.4, ry: 0.5, rw: 0.02, rh: 0.2, type: "solid" },
        { rx: 0.6, ry: 0.45, rw: 0.02, rh: 0.25, type: "solid" },
        { rx: 0.2, ry: 0.65, rw: 0.2, rh: 0.02, type: "solid" },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.15, ry: 0.15 },
        { type: "sniper", rx: 0.85, ry: 0.15 },
        { type: "sniper", rx: 0.5, ry: 0.35 },
        { type: "spiral", rx: 0.3, ry: 0.45 },
      ],
      walls: [
        { rx: 0.45, ry: 0.3, rw: 0.1, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.3, ry: 0.5, rw: 0.1, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.65, ry: 0.55, rw: 0.1, rh: 0.02, type: "glass", hp: 3 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.5, ry: 0.1 },
        { type: "tank", rx: 0.2, ry: 0.4 },
        { type: "circler", rx: 0.8, ry: 0.35 },
        { type: "snake", rx: 0.3, ry: 0.55 },
        { type: "snake", rx: 0.7, ry: 0.5 },
      ],
      walls: [
        { rx: 0.15, ry: 0.45, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.8, ry: 0.6, rw: 0.06, rh: 0.06, type: "bounce" },
        { rx: 0.5, ry: 0.7, rw: 0.06, rh: 0.06, type: "bounce" },
      ],
    },
  ],
};
