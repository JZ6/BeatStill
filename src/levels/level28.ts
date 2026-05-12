import type { LevelDef } from "../systems/Levels";

export const level28: LevelDef = {
  id: 28,
  name: "Checkerboard",
  description: "Hide and seek",
  waves: [{
    enemies: [
      { type: "basic", rx: 0.15, ry: 0.15 },
      { type: "basic", rx: 0.85, ry: 0.15 },
      { type: "basic", rx: 0.15, ry: 0.85 },
      { type: "basic", rx: 0.85, ry: 0.85 },
      { type: "basic", rx: 0.5, ry: 0.5 },
      { type: "basic", rx: 0.5, ry: 0.15 },
      { type: "sniper", rx: 0.15, ry: 0.5 },
      { type: "sniper", rx: 0.85, ry: 0.5 },
      { type: "sniper", rx: 0.5, ry: 0.85 },
      { type: "sniper", rx: 0.35, ry: 0.35 },
    ],
    walls: [
      { rx: 0.22, ry: 0.22, rw: 0.08, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.46, ry: 0.22, rw: 0.08, rh: 0.08, type: "bounce" },
      { rx: 0.7, ry: 0.22, rw: 0.08, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.22, ry: 0.46, rw: 0.08, rh: 0.08, type: "bounce" },
      { rx: 0.46, ry: 0.46, rw: 0.08, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.7, ry: 0.46, rw: 0.08, rh: 0.08, type: "bounce" },
      { rx: 0.22, ry: 0.7, rw: 0.08, rh: 0.08, type: "glass", hp: 2 },
      { rx: 0.46, ry: 0.7, rw: 0.08, rh: 0.08, type: "bounce" },
      { rx: 0.7, ry: 0.7, rw: 0.08, rh: 0.08, type: "glass", hp: 2 },
    ],
  }],
};
