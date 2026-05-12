import type { EnemyType } from "../objects/enemies";
import type { WallType } from "../objects/Wall";

import { level01 } from "../levels/level01";
import { level02 } from "../levels/level02";
import { level03 } from "../levels/level03";
import { level04 } from "../levels/level04";
import { level05 } from "../levels/level05";
import { level06 } from "../levels/level06";
import { level07 } from "../levels/level07";
import { level08 } from "../levels/level08";
import { level09 } from "../levels/level09";
import { level10 } from "../levels/level10";
import { level11 } from "../levels/level11";
import { level12 } from "../levels/level12";
import { level13 } from "../levels/level13";
import { level14 } from "../levels/level14";
import { level15 } from "../levels/level15";
import { level16 } from "../levels/level16";
import { level17 } from "../levels/level17";
import { level18 } from "../levels/level18";
import { level19 } from "../levels/level19";
import { level20 } from "../levels/level20";
import { level21 } from "../levels/level21";
import { level22 } from "../levels/level22";
import { level23 } from "../levels/level23";
import { level24 } from "../levels/level24";
import { level25 } from "../levels/level25";
import { level26 } from "../levels/level26";
import { level27 } from "../levels/level27";
import { level28 } from "../levels/level28";
import { level29 } from "../levels/level29";
import { level30 } from "../levels/level30";
import { level31 } from "../levels/level31";
import { level32 } from "../levels/level32";
import { level33 } from "../levels/level33";
import { level34 } from "../levels/level34";
import { level35 } from "../levels/level35";
import { level36 } from "../levels/level36";
import { level37 } from "../levels/level37";
import { level38 } from "../levels/level38";
import { level39 } from "../levels/level39";
import { level40 } from "../levels/level40";
import { level41 } from "../levels/level41";
import { level42 } from "../levels/level42";
import { level43 } from "../levels/level43";
import { level44 } from "../levels/level44";
import { level45 } from "../levels/level45";
import { level46 } from "../levels/level46";
import { level47 } from "../levels/level47";
import { level48 } from "../levels/level48";
import { level49 } from "../levels/level49";
import { level50 } from "../levels/level50";
import { level51 } from "../levels/level51";
import { level52 } from "../levels/level52";
import { level53 } from "../levels/level53";
import { level54 } from "../levels/level54";
import { level55 } from "../levels/level55";
import { level56 } from "../levels/level56";
import { level57 } from "../levels/level57";
import { level58 } from "../levels/level58";
import { level59 } from "../levels/level59";
import { level60 } from "../levels/level60";

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
  level01, level02, level03, level04, level05,
  level06, level07, level08, level09, level10,
  level11, level12, level13, level14, level15,
  level16, level17, level18, level19, level20,
  level21, level22, level23, level24, level25,
  level26, level27, level28, level29, level30,
  level31, level32, level33, level34, level35,
  level36, level37, level38, level39, level40,
  level41, level42, level43, level44, level45,
  level46, level47, level48, level49, level50,
  level51, level52, level53, level54, level55,
  level56, level57, level58, level59, level60,
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
