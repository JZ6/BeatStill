import type { LevelDef } from "../systems/Levels";

export const level23: LevelDef = {
  id: 23,
  name: "The Labyrinth",
  description: "Every wall type, every enemy type",
  shipRx: 0.5, shipRy: 0.85,
  waves: [
    {
      enemies: [
        { type: "swarm", rx: 0.2, ry: 0.1 },
        { type: "swarm", rx: 0.4, ry: 0.05 },
        { type: "swarm", rx: 0.6, ry: 0.1 },
        { type: "swarm", rx: 0.8, ry: 0.05 },
        { type: "tracker", rx: 0.3, ry: 0.15 },
        { type: "tracker", rx: 0.7, ry: 0.15 },
      ],
      walls: [
        { rx: 0.15, ry: 0.25, rw: 0.3, rh: 0.02, type: "solid" },
        { rx: 0.55, ry: 0.25, rw: 0.3, rh: 0.02, type: "solid" },
        { rx: 0.3, ry: 0.4, rw: 0.4, rh: 0.02, type: "bounce" },
        { rx: 0.15, ry: 0.55, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.6, ry: 0.55, rw: 0.25, rh: 0.02, type: "solid" },
        { rx: 0.35, ry: 0.7, rw: 0.3, rh: 0.02, type: "glass", hp: 3 },
        { rx: 0.35, ry: 0.25, rw: 0.02, rh: 0.15, type: "solid" },
        { rx: 0.65, ry: 0.25, rw: 0.02, rh: 0.15, type: "solid" },
        { rx: 0.5, ry: 0.55, rw: 0.02, rh: 0.15, type: "bounce" },
      ],
    },
    {
      enemies: [
        { type: "sniper", rx: 0.2, ry: 0.3 },
        { type: "sniper", rx: 0.8, ry: 0.3 },
        { type: "spiral", rx: 0.5, ry: 0.15 },
        { type: "spiral", rx: 0.3, ry: 0.5 },
        { type: "spiral", rx: 0.7, ry: 0.5 },
      ],
    },
    {
      enemies: [
        { type: "tank", rx: 0.3, ry: 0.1 },
        { type: "tank", rx: 0.7, ry: 0.1 },
        { type: "circler", rx: 0.5, ry: 0.3 },
        { type: "snake", rx: 0.2, ry: 0.5 },
        { type: "snake", rx: 0.8, ry: 0.5 },
      ],
    },
  ],
};
