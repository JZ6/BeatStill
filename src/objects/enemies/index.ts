export { Enemy } from "./Enemy";
export type { EnemyType } from "./Enemy";
export { SwarmEnemy } from "./SwarmEnemy";
export { SnakeEnemy } from "./SnakeEnemy";
export { TrackerEnemy } from "./TrackerEnemy";
export { BasicEnemy } from "./BasicEnemy";
export { SniperEnemy } from "./SniperEnemy";
export { CirclerEnemy } from "./CirclerEnemy";
export { SpiralEnemy } from "./SpiralEnemy";
export { TankEnemy } from "./TankEnemy";
export { SentinelBoss } from "./SentinelBoss";
export { PhantomBoss } from "./PhantomBoss";
export { PhantomDecoy } from "./PhantomDecoy";

import type { EnemyType } from "./Enemy";
import { SwarmEnemy } from "./SwarmEnemy";
import { SnakeEnemy } from "./SnakeEnemy";
import { TrackerEnemy } from "./TrackerEnemy";
import { BasicEnemy } from "./BasicEnemy";
import { SniperEnemy } from "./SniperEnemy";
import { CirclerEnemy } from "./CirclerEnemy";
import { SpiralEnemy } from "./SpiralEnemy";
import { TankEnemy } from "./TankEnemy";
import { SentinelBoss } from "./SentinelBoss";
import { PhantomBoss } from "./PhantomBoss";
import { PhantomDecoy } from "./PhantomDecoy";
import type { Enemy } from "./Enemy";

export function createEnemy(scene: Phaser.Scene, x: number, y: number, type: EnemyType): Enemy {
  switch (type) {
    case "swarm": return new SwarmEnemy(scene, x, y);
    case "snake": return new SnakeEnemy(scene, x, y);
    case "tracker": return new TrackerEnemy(scene, x, y);
    case "basic": return new BasicEnemy(scene, x, y);
    case "sniper": return new SniperEnemy(scene, x, y);
    case "circler": return new CirclerEnemy(scene, x, y);
    case "spiral": return new SpiralEnemy(scene, x, y);
    case "tank": return new TankEnemy(scene, x, y);
    case "sentinel": return new SentinelBoss(scene, x, y);
    case "phantom": return new PhantomBoss(scene, x, y);
    case "phantom_decoy": return new PhantomDecoy(scene, x, y);
  }
}
