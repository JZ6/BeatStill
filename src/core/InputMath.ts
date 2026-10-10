/**
 * Pure input helpers (no Phaser), shared by the ship and touch controls.
 */

export interface MoveVector {
  x: number;
  y: number;
  /** Movement intent magnitude, 0..1. */
  magnitude: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Analog stick deflection (dx, dy from the stick's base) → movement vector. Deflection inside
 * the dead zone (a fraction of `maxRadius`) reads as 0; beyond it the magnitude is rescaled so
 * it still reaches exactly 1 at `maxRadius`.
 */
export function analogStick(dx: number, dy: number, maxRadius: number, deadZone: number): MoveVector {
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dead = maxRadius * clamp(deadZone, 0, 0.95);
  if (!(maxRadius > 0) || !(dist > dead)) return { x: 0, y: 0, magnitude: 0 };
  const magnitude = Math.min((dist - dead) / (maxRadius - dead), 1);
  return { x: (dx / dist) * magnitude, y: (dy / dist) * magnitude, magnitude };
}

/**
 * Aim angle (radians, atan2 convention) of a stick deflection, or null while the deflection is
 * within `deadZoneRadius` (too small to give a reliable direction).
 */
export function stickAngle(dx: number, dy: number, deadZoneRadius: number): number | null {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (!(dist > Math.max(0, deadZoneRadius))) return null;
  return Math.atan2(dy, dx);
}

/** Digital (keyboard) movement: normalized so diagonals aren't faster; magnitude is 0 or 1. */
export function keyboardVector(left: boolean, right: boolean, up: boolean, down: boolean): MoveVector {
  let x = (right ? 1 : 0) - (left ? 1 : 0);
  let y = (down ? 1 : 0) - (up ? 1 : 0);
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0, magnitude: 0 };
  x /= len;
  y /= len;
  return { x, y, magnitude: 1 };
}
