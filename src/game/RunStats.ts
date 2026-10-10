/** Below this time scale the world counts as frozen (time_lord achievement, Phantom charge). */
export const FREEZE_THRESHOLD = 0.15;

/** Per-run counters. Pure TypeScript, unit-testable. */
export class RunStats {
  kills = 0;
  damageTaken = 0;
  bossFightDamageTaken = 0;
  /** REAL seconds spent with the time scale below FREEZE_THRESHOLD. */
  freezeTime = 0;

  recordKill() {
    this.kills++;
  }

  recordDamage() {
    this.damageTaken++;
    this.bossFightDamageTaken++;
  }

  startBossFight() {
    this.bossFightDamageTaken = 0;
  }

  /** Call once per live frame with the frame's time scale and REAL seconds. */
  trackFreeze(timeScale: number, realDt: number) {
    if (timeScale < FREEZE_THRESHOLD && realDt > 0) this.freezeTime += realDt;
  }
}
