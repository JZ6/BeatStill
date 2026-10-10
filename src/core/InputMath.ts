/**
 * Pure input helpers (no Phaser), shared by the ship and touch controls.
 */

export interface MoveVector {
  x: number;
  y: number;
  /** Movement intent magnitude, 0..1. */
  magnitude: number;
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
