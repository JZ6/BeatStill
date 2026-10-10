import type { EnemyType } from "../objects/enemies";
import { EventBus } from "./EventBus";

export type BulletOwner = "player" | "enemy";
export type AsteroidSize = "large" | "medium" | "small";

/**
 * Every gameplay occurrence that can make a sound or drive the music.
 * Gameplay code emits these; it never calls the audio layer directly.
 * Positions are in game pixels at the moment of the event.
 */
export interface GameEventMap {
  playerFired: { weaponId: string; x: number; y: number; angle: number; bulletCount: number };
  enemyFired: { enemyType: EnemyType; x: number; y: number; bulletCount: number; elite: boolean };
  enemyHit: { enemyType: EnemyType; x: number; y: number; damage: number; hpLeft: number; maxHp: number };
  enemyKilled: {
    enemyType: EnemyType;
    x: number;
    y: number;
    isBoss: boolean;
    elite: boolean;
    chainCount: number;
    chainTier: number;
  };
  chainBreak: { tier: number; x: number; y: number };
  bulletClash: { x: number; y: number };
  asteroidBreak: { size: AsteroidSize; x: number; y: number };
  wallBounce: { x: number; y: number; axis: "x" | "y"; owner: BulletOwner };
  wallAbsorb: { x: number; y: number; owner: BulletOwner };
  glassCrack: { x: number; y: number; hp: number; maxHp: number };
  glassShatter: { x: number; y: number };
  playerHit: { x: number; y: number; hpLeft: number; maxHp: number };
  playerDied: { x: number; y: number };
  pickupCollected: { x: number; y: number; upgradeId: string; isWeapon: boolean };
  bossWarning: { bossType: EnemyType };
  bossPhaseChanged: { bossType: EnemyType; phase: number };
  bossDefeated: { bossType: EnemyType; x: number; y: number };
  waveStarted: { wave: number; mode: "endless" | "level" };
  levelCompleted: { levelId: number };
}

export type GameEvents = EventBus<GameEventMap>;

export function createGameEvents(): GameEvents {
  return new EventBus<GameEventMap>();
}
