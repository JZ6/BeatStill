/**
 * Every enemy volley's bullet geometry (angles and speeds) as a pure function of what it depends
 * on: the aim at the ship, the wave, a boss phase, a spiral's arm angle. The enemy classes fire
 * these; the balance metrics (src/balance/metrics.ts) count them. Pure TypeScript (no Phaser).
 */
import { aimed, radial, spiral, type BulletConfig } from "../BulletPattern";
import type { EnemyType } from "./registry";

/** Pulse: a radial ring that grows with the wave, 4 → 10 bullets. */
export function basicVolley(wave: number): BulletConfig[] {
  const w = Number.isFinite(wave) ? Math.max(0, wave) : 0;
  return radial(Math.min(4 + Math.floor(w / 2), 10), 160);
}

export function trackerVolley(aim: number): BulletConfig[] {
  return aimed(aim, 3, 0.4, 220);
}

export function sniperVolley(aim: number): BulletConfig[] {
  return aimed(aim, 2, 0.15, 350);
}

/** Four arms at `angle` (the spiral's arm angle on the step it fires). */
export function spiralVolley(angle: number): BulletConfig[] {
  return spiral(4, 130, angle);
}

export function tankVolley(aim: number): BulletConfig[] {
  return [...radial(8, 120), ...aimed(aim, 4, 0.5, 180)];
}

export function swarmVolley(aim: number): BulletConfig[] {
  return aimed(aim, 2, 0.25, 170);
}

export function snakeVolley(aim: number): BulletConfig[] {
  return aimed(aim, 3, 0.3, 200);
}

export function circlerVolley(): BulletConfig[] {
  return radial(16, 110);
}

/** Sentinel phase 1–3; `spiralAngle` turns phase 3's five arms. */
export function sentinelVolley(phase: number, aim: number, spiralAngle: number): BulletConfig[] {
  switch (phase) {
    case 2:
      return [...radial(12, 100), ...aimed(aim, 3, 0.3, 160)];
    case 3:
      return [...spiral(5, 110, spiralAngle), ...aimed(aim, 2, 0.2, 200)];
    default:
      return radial(8, 90);
  }
}

/** Phantom phase 1–3; `chargeBonus` (0–6) extra aimed bullets from charging in frozen time. */
export function phantomVolley(phase: number, aim: number, chargeBonus: number, spiralAngle: number): BulletConfig[] {
  const aimedCount = 3 + (Number.isFinite(chargeBonus) ? Math.max(0, Math.floor(chargeBonus)) : 0);
  switch (phase) {
    case 2:
      return [...aimed(aim, aimedCount, 0.4, 180), ...radial(6, 70)];
    case 3:
      return [...aimed(aim, aimedCount, 0.4, 180), ...radial(6, 70), ...spiral(3, 90, spiralAngle)];
    default:
      return aimed(aim, aimedCount, 0.4, 180);
  }
}

/** The ring the Phantom leaves where it teleports from (phases 2 and 3). */
export function phantomTeleportVolley(): BulletConfig[] {
  return radial(8, 60);
}

export interface VolleyContext {
  /** Angle to the ship (radians). */
  aim?: number;
  /** Spiral arm angle (radians). */
  angle?: number;
  wave?: number;
  /** Boss phase, 1-based. */
  phase?: number;
  chargeBonus?: number;
}

/** The volley `type` fires in `ctx` (defaults: aim 0, angle 0, wave 1, phase 1, no charge). */
export function volleyFor(type: EnemyType, ctx: VolleyContext = {}): BulletConfig[] {
  const aim = ctx.aim ?? 0;
  const angle = ctx.angle ?? 0;
  const phase = ctx.phase ?? 1;
  switch (type) {
    case "basic":
      return basicVolley(ctx.wave ?? 1);
    case "tracker":
      return trackerVolley(aim);
    case "sniper":
      return sniperVolley(aim);
    case "spiral":
      return spiralVolley(angle);
    case "tank":
      return tankVolley(aim);
    case "swarm":
      return swarmVolley(aim);
    case "snake":
      return snakeVolley(aim);
    case "circler":
      return circlerVolley();
    case "sentinel":
      return sentinelVolley(phase, aim, angle);
    case "phantom":
      return phantomVolley(phase, aim, ctx.chargeBonus ?? 0, angle);
    case "phantom_decoy":
      return [];
  }
}
