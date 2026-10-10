import type { TickEvent } from "../core/Conductor";

/** Peak level on a bar downbeat. */
export const PULSE_BAR = 1;
/** Peak level on the other beats. */
export const PULSE_BEAT = 0.5;
/** Exponential decay rate per REAL second (level halves every ~87 ms). */
export const PULSE_DECAY_RATE = 8;
/** Levels below this snap to 0 so the layer can be hidden. */
export const PULSE_FLOOR = 0.01;

/** Pulse strength a tick triggers: strongest on bar downbeats, lighter on other beats, none between. */
export function pulseStrength(t: TickEvent): number {
  if (t.isBar) return PULSE_BAR;
  if (t.isBeat) return PULSE_BEAT;
  return 0;
}

/**
 * A 0..1 flash level that jumps up on trigger and decays exponentially in real time,
 * independent of the world's time scale. Pure TypeScript, unit-testable.
 */
export class PulseEnvelope {
  level = 0;

  constructor(
    readonly decayRate = PULSE_DECAY_RATE,
    readonly floor = PULSE_FLOOR,
  ) {}

  /** Raises the level to `strength` (never lowers it; a beat can't cut a bar flash short). */
  trigger(strength: number): void {
    const s = Math.min(1, Math.max(0, strength));
    if (s > this.level) this.level = s;
  }

  /** Decays by `realDt` seconds and returns the new level. Frame-rate independent. */
  update(realDt: number): number {
    if (this.level > 0 && realDt > 0) {
      this.level *= Math.exp(-this.decayRate * realDt);
      if (this.level < this.floor) this.level = 0;
    }
    return this.level;
  }
}
