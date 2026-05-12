import type { LevelDef } from "../systems/Levels";

export const level39: LevelDef = {
  id: 39,
  name: "Cross",
  description: "Enemies in the corners you can't reach",
  waves: [{
    enemies: [
      { type: "sniper", rx: 0.1, ry: 0.1 },
      { type: "spiral", rx: 0.1, ry: 0.9 },
      { type: "sniper", rx: 0.9, ry: 0.1 },
      { type: "spiral", rx: 0.9, ry: 0.9 },
      { type: "basic", rx: 0.5, ry: 0.3 },
      { type: "basic", rx: 0.5, ry: 0.7 },
      { type: "basic", rx: 0.3, ry: 0.5 },
      { type: "basic", rx: 0.7, ry: 0.5 },
    ],
    walls: [
      { rx: 0, ry: 0, rw: 0.3, rh: 0.3, type: "solid" },
      { rx: 0.7, ry: 0, rw: 0.3, rh: 0.3, type: "solid" },
      { rx: 0, ry: 0.7, rw: 0.3, rh: 0.3, type: "solid" },
      { rx: 0.7, ry: 0.7, rw: 0.3, rh: 0.3, type: "solid" },
      { rx: 0.28, ry: 0.28, rw: 0.04, rh: 0.04, type: "glass", hp: 2 },
      { rx: 0.68, ry: 0.28, rw: 0.04, rh: 0.04, type: "glass", hp: 2 },
      { rx: 0.28, ry: 0.68, rw: 0.04, rh: 0.04, type: "glass", hp: 2 },
      { rx: 0.68, ry: 0.68, rw: 0.04, rh: 0.04, type: "glass", hp: 2 },
    ],
  }],
};
