/**
 * Screen and touch feedback that honours the accessibility options: camera shake (gentler with
 * Reduce Flashing) and haptics (short vibrations, only with Haptics on and where supported).
 */
import type Phaser from "phaser";
import { options, shakeScale } from "./GameOptions";

/** Vibration lengths (ms): a non-fatal player hit, a bar downbeat, and death. */
export const HAPTIC_HIT: VibratePattern = 40;
export const HAPTIC_BAR: VibratePattern = 12;
export const HAPTIC_DEATH: VibratePattern = [60, 40, 120];

/** Camera shake scaled down with Options → Reduce Flashing. */
export function shakeCamera(camera: Phaser.Cameras.Scene2D.Camera, durationMs: number, intensity: number): void {
  const k = shakeScale(options.reduceFlashing);
  if (!(intensity * k > 0)) return;
  camera.shake(durationMs, intensity * k);
}

/** Whether this browser can vibrate at all (desktop browsers usually can't, or ignore it). */
export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Vibrates if Options → Haptics is on and the browser supports it. Before the first user gesture
 * nothing is attempted (Chrome would block the call and log an intervention). Never throws.
 */
export function vibrate(pattern: VibratePattern): boolean {
  if (!options.haptics || !hapticsSupported()) return false;
  const activation = (navigator as { userActivation?: UserActivation }).userActivation;
  if (activation && !activation.hasBeenActive) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
