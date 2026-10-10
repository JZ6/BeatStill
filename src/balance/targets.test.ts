/**
 * Phase 8 balance targets, measured against the pre-overhaul ms timers (see `npm run balance`).
 * A failure here means a tuning change moved something outside its agreed band: re-run the report
 * and either retune or update the target with a reason.
 */
import { describe, expect, it } from "vitest";
import { ALL_WEAPONS, getWeapon } from "../systems/Weapons";
import {
  LEGACY_WEAPONS,
  REFERENCE_BPM,
  allEnemyMetrics,
  dilationResponse,
  heldLoadout,
  relativeChange,
  weaponMetrics,
  type Loadout,
} from "./metrics";

describe("weapon targets", () => {
  it(`keeps every weapon's DPS as first held within ±20% of the old cooldown at ${REFERENCE_BPM} bpm`, () => {
    for (const w of ALL_WEAPONS) {
      const m = weaponMetrics(w, REFERENCE_BPM, heldLoadout(w.id));
      expect(Math.abs(relativeChange(m.dps, m.legacyDps)), `${w.id}: ${m.dps.toFixed(2)} vs ${m.legacyDps.toFixed(2)}`).toBeLessThanOrEqual(0.2);
    }
  });

  it("fires player bullets 10–15% slower than before (README: make the player shot slower)", () => {
    for (const w of ALL_WEAPONS) {
      const change = relativeChange(w.baseBulletSpeed, LEGACY_WEAPONS[w.id].speed);
      expect(change, w.id).toBeLessThanOrEqual(-0.1);
      expect(change, w.id).toBeGreaterThanOrEqual(-0.15);
    }
  });

  it("keeps the range of short-lived bullets (lifetime × speed) within 3%", () => {
    for (const w of ALL_WEAPONS.filter((x) => x.lifetime > 0)) {
      const m = weaponMetrics(w, REFERENCE_BPM);
      expect(m.legacyRange, w.id).not.toBeNull();
      expect(Math.abs(relativeChange(m.range ?? 0, m.legacyRange ?? 1)), w.id).toBeLessThanOrEqual(0.03);
    }
  });

  it("makes evolving into the minigun (at max Rapid Fire) an upgrade at every Power and Multi Shot level", () => {
    const standard = getWeapon("standard");
    const minigun = getWeapon("minigun");
    const rapidFire = heldLoadout("minigun").rapidFire;
    expect(rapidFire).toBe(3);
    for (let power = 0; power <= 4; power++) {
      for (let multiShot = 0; multiShot <= 4; multiShot++) {
        const l: Loadout = { name: "probe", rapidFire, power, multiShot, penetration: 0 };
        const ratio = weaponMetrics(minigun, REFERENCE_BPM, l).dps / weaponMetrics(standard, REFERENCE_BPM, l).dps;
        expect(ratio, `power ${power}, multi shot ${multiShot}`).toBeGreaterThanOrEqual(1.2);
      }
    }
  });
});

describe("enemy targets", () => {
  it(`keeps every enemy's (and boss phase's) bullets per second within ±15% of the old timer at ${REFERENCE_BPM} bpm`, () => {
    for (const m of allEnemyMetrics(REFERENCE_BPM)) {
      const label = `${m.type} p${m.phase}: ${m.bulletsPerSec.toFixed(2)} vs ${m.legacyBulletsPerSec.toFixed(2)}`;
      expect(Math.abs(relativeChange(m.bulletsPerSec, m.legacyBulletsPerSec)), label).toBeLessThanOrEqual(0.15);
    }
  });

  it("keeps Bullet Storm at the old double density, at a later wave too", () => {
    for (const m of allEnemyMetrics(REFERENCE_BPM, 12)) {
      expect(Math.abs(relativeChange(m.stormBulletsPerSec, m.legacyStormBulletsPerSec)), `${m.type} p${m.phase}`).toBeLessThanOrEqual(0.15);
    }
  });
});

describe("time dilation targets", () => {
  it("lets keyboard play (move + hold fire) reach full speed, and idling stop time within half a second", () => {
    for (const fps of [30, 60, 144]) {
      const d = dilationResponse(1 / fps);
      expect(d.moveFireTarget, `${fps} fps`).toBe(1);
      expect(d.secondsTo99, `${fps} fps`).toBeLessThanOrEqual(0.5);
      expect(d.idleSecondsBelow01, `${fps} fps`).toBeLessThanOrEqual(0.5);
      // Moving alone must not saturate (the old WASD bug), but still clearly speeds time up.
      expect(d.moveOnlyTarget, `${fps} fps`).toBeGreaterThan(0.5);
      expect(d.moveOnlyTarget, `${fps} fps`).toBeLessThan(0.9);
    }
  });
});
