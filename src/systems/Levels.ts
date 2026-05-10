import type { EnemyType } from "../objects/Enemy";
import type { WallType } from "../objects/Wall";

type AsteroidSize = "large" | "medium" | "small";

export interface LevelEnemy {
  type: EnemyType;
  rx: number;
  ry: number;
}

export interface LevelAsteroid {
  rx: number;
  ry: number;
  size: AsteroidSize;
}

export interface LevelWall {
  rx: number; ry: number;
  rw: number; rh: number;
  type: WallType;
  hp?: number;
  oneWay?: "up" | "down" | "left" | "right";
}

export interface LevelBullet {
  rx: number; ry: number;
  angle: number;
  speed: number;
}

export interface LevelWave {
  enemies: LevelEnemy[];
  asteroids?: LevelAsteroid[];
  walls?: LevelWall[];
  initialBullets?: LevelBullet[];
}

export interface LevelDef {
  id: number;
  name: string;
  description: string;
  shipRx?: number;
  shipRy?: number;
  waves: LevelWave[];
}

export const ALL_LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "The Hallway",
    description: "Two tanks guard the far end",
    shipRx: 0.5, shipRy: 0.85,
    waves: [{
      enemies: [
        { type: "tank", rx: 0.35, ry: 0.1 },
        { type: "tank", rx: 0.65, ry: 0.1 },
      ],
      walls: [
        { rx: 0, ry: 0, rw: 0.3, rh: 1, type: "solid" },
        { rx: 0.7, ry: 0, rw: 0.3, rh: 1, type: "solid" },
      ],
      initialBullets: [
        ...Array.from({ length: 6 }, (_, i) => ({
          rx: 0.35, ry: 0.15, angle: Math.PI / 2 + (i - 2.5) * 0.12, speed: 100,
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          rx: 0.65, ry: 0.15, angle: Math.PI / 2 + (i - 2.5) * 0.12, speed: 100,
        })),
      ],
    }],
  },
  {
    id: 2,
    name: "Spiral Galaxy",
    description: "Surrounded by spinning death",
    waves: [{
      enemies: [
        { type: "spiral", rx: 0.2, ry: 0.2 },
        { type: "spiral", rx: 0.8, ry: 0.2 },
        { type: "spiral", rx: 0.2, ry: 0.8 },
        { type: "spiral", rx: 0.8, ry: 0.8 },
      ],
    }],
  },
  {
    id: 3,
    name: "Sniper Alley",
    description: "Six snipers line the walls",
    waves: [{
      enemies: [
        { type: "sniper", rx: 0.05, ry: 0.2 },
        { type: "sniper", rx: 0.05, ry: 0.5 },
        { type: "sniper", rx: 0.05, ry: 0.8 },
        { type: "sniper", rx: 0.95, ry: 0.2 },
        { type: "sniper", rx: 0.95, ry: 0.5 },
        { type: "sniper", rx: 0.95, ry: 0.8 },
      ],
      walls: [
        { rx: 0.38, ry: 0.25, rw: 0.06, rh: 0.15, type: "glass", hp: 3 },
        { rx: 0.56, ry: 0.25, rw: 0.06, rh: 0.15, type: "glass", hp: 3 },
        { rx: 0.38, ry: 0.6, rw: 0.06, rh: 0.15, type: "glass", hp: 3 },
        { rx: 0.56, ry: 0.6, rw: 0.06, rh: 0.15, type: "glass", hp: 3 },
        { rx: 0.12, ry: 0, rw: 0.03, rh: 1, type: "bounce" },
        { rx: 0.85, ry: 0, rw: 0.03, rh: 1, type: "bounce" },
      ],
    }],
  },
  {
    id: 4,
    name: "The Swarm",
    description: "They come from everywhere",
    waves: [{
      enemies: Array.from({ length: 30 }, (_, i) => {
        const edge = i % 4;
        const t = (i / 30) + Math.random() * 0.05;
        if (edge === 0) return { type: "swarm" as EnemyType, rx: t, ry: -0.04 };
        if (edge === 1) return { type: "swarm" as EnemyType, rx: 1.04, ry: t };
        if (edge === 2) return { type: "swarm" as EnemyType, rx: t, ry: 1.04 };
        return { type: "swarm" as EnemyType, rx: -0.04, ry: t };
      }),
    }],
  },
  {
    id: 5,
    name: "Crossfire",
    description: "Tanks on all sides",
    waves: [{
      enemies: [
        { type: "tank", rx: 0.5, ry: 0.05 },
        { type: "tank", rx: 0.95, ry: 0.5 },
        { type: "tank", rx: 0.5, ry: 0.95 },
        { type: "tank", rx: 0.05, ry: 0.5 },
      ],
    }],
  },
  {
    id: 6,
    name: "Asteroid Field",
    description: "Navigate the debris",
    shipRx: 0.15, shipRy: 0.5,
    waves: [{
      enemies: [
        { type: "sniper", rx: 0.85, ry: 0.3 },
        { type: "sniper", rx: 0.85, ry: 0.7 },
      ],
      asteroids: [
        { rx: 0.3, ry: 0.2, size: "large" },
        { rx: 0.45, ry: 0.45, size: "large" },
        { rx: 0.55, ry: 0.7, size: "large" },
        { rx: 0.65, ry: 0.25, size: "large" },
        { rx: 0.4, ry: 0.8, size: "medium" },
        { rx: 0.7, ry: 0.55, size: "medium" },
        { rx: 0.35, ry: 0.55, size: "medium" },
        { rx: 0.6, ry: 0.9, size: "medium" },
      ],
    }],
  },
  {
    id: 7,
    name: "Boss Rush",
    description: "Everything at once",
    waves: [{
      enemies: [
        { type: "tank", rx: 0.2, ry: 0.1 },
        { type: "tank", rx: 0.5, ry: 0.05 },
        { type: "tank", rx: 0.8, ry: 0.1 },
        { type: "spiral", rx: 0.1, ry: 0.5 },
        { type: "spiral", rx: 0.9, ry: 0.5 },
        { type: "tracker", rx: 0.15, ry: 0.85 },
        { type: "tracker", rx: 0.4, ry: 0.9 },
        { type: "tracker", rx: 0.6, ry: 0.9 },
        { type: "tracker", rx: 0.85, ry: 0.85 },
      ],
    }],
  },
  {
    id: 8,
    name: "The Gauntlet",
    description: "Three waves, no rest",
    waves: [
      {
        enemies: Array.from({ length: 15 }, (_, i) => {
          const edge = i % 4;
          const t = 0.1 + (i / 15) * 0.8;
          if (edge === 0) return { type: "swarm" as EnemyType, rx: t, ry: -0.04 };
          if (edge === 1) return { type: "swarm" as EnemyType, rx: 1.04, ry: t };
          if (edge === 2) return { type: "swarm" as EnemyType, rx: t, ry: 1.04 };
          return { type: "swarm" as EnemyType, rx: -0.04, ry: t };
        }),
      },
      {
        enemies: [
          { type: "sniper", rx: 0.05, ry: 0.15 },
          { type: "sniper", rx: 0.05, ry: 0.5 },
          { type: "sniper", rx: 0.05, ry: 0.85 },
          { type: "sniper", rx: 0.95, ry: 0.15 },
          { type: "sniper", rx: 0.95, ry: 0.5 },
          { type: "sniper", rx: 0.95, ry: 0.85 },
        ],
      },
      {
        enemies: [
          { type: "tank", rx: 0.3, ry: 0.1 },
          { type: "tank", rx: 0.7, ry: 0.1 },
          { type: "spiral", rx: 0.15, ry: 0.5 },
          { type: "spiral", rx: 0.85, ry: 0.5 },
        ],
      },
    ],
  },
  {
    id: 9,
    name: "Bullet Spiral",
    description: "Navigate the spiral path",
    shipRx: 0.9, shipRy: 0.5,
    waves: [{
      enemies: [
        { type: "sniper", rx: 0.5, ry: 0.45 },
        { type: "sniper", rx: 0.5, ry: 0.55 },
      ],
      initialBullets: (() => {
        const bullets: { rx: number; ry: number; angle: number; speed: number }[] = [];
        const cx = 0.5, cy = 0.5;
        const step = 0.04;
        for (let gx = 0.05; gx <= 0.95; gx += step) {
          for (let gy = 0.05; gy <= 0.95; gy += step) {
            const dx = gx - cx;
            const dy = gy - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const spiralR = 0.06 + (((angle + Math.PI) / (Math.PI * 2)) * 0.35 + dist * 0.3) % 0.4;
            if (Math.abs(dist - spiralR) > 0.035) {
              bullets.push({ rx: gx, ry: gy, angle: 0, speed: 0 });
            }
          }
        }
        return bullets;
      })(),
    }],
  },
];

interface LevelProgress {
  completedIds: number[];
}

const STORAGE_KEY = "beatstill_levels";

let progress: LevelProgress;

function loadProgress(): LevelProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { completedIds: [] };
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

progress = loadProgress();

export function isLevelCompleted(id: number): boolean {
  return progress.completedIds.includes(id);
}

export function isLevelUnlocked(id: number): boolean {
  if (id === 1) return true;
  return progress.completedIds.includes(id - 1);
}

export function markLevelComplete(id: number) {
  if (!progress.completedIds.includes(id)) {
    progress.completedIds.push(id);
    saveProgress();
  }
}
