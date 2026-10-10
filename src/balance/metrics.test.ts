import { describe, expect, it } from "vitest";
import { DEFAULT_DILATION } from "../core/TimeDilation";
import { fireIntervalTicks } from "../music/noteValues";
import { ALL_PALETTES } from "../music/palettes";
import { ENEMY_DEFS, enemyDef } from "../objects/enemies/registry";
import { volleyFor } from "../objects/enemies/volleys";
import { ALL_WEAPONS, getWeapon } from "../systems/Weapons";
import {
  LEGACY_ENEMIES,
  LEGACY_WEAPONS,
  LOADOUTS,
  REFERENCE_BPM,
  allEnemyMetrics,
  allWeaponMetrics,
  dilationResponse,
  enemyMetrics,
  firingEnemies,
  legacyCooldownMs,
  legacyVolleyBullets,
  loadoutStats,
  paletteTempos,
  relativeChange,
  stepSeconds,
  tickSeconds,
  timePerKill,
  weaponMetrics,
} from "./metrics";
import { formatBalanceReport, formatTable, pct } from "./report";

const loadout = (name: string) => LOADOUTS.find((l) => l.name === name)!;

describe("time and tempo helpers", () => {
  it("converts tempo to game seconds per step and tick", () => {
    expect(stepSeconds(100)).toBeCloseTo(0.15);
    expect(tickSeconds(120)).toBeCloseTo(1 / 48);
    expect(stepSeconds(REFERENCE_BPM)).toBeCloseTo(1 / 7);
  });

  it("measures relative change", () => {
    expect(relativeChange(115, 100)).toBeCloseTo(0.15);
    expect(relativeChange(1, 0)).toBeNaN();
  });

  it("lists every palette tempo, slowest first", () => {
    const tempos = paletteTempos();
    expect(tempos.map((t) => t.id).sort()).toEqual(ALL_PALETTES.map((p) => p.id).sort());
    tempos.slice(1).forEach((t, i) => expect(t.bpm).toBeGreaterThanOrEqual(tempos[i].bpm));
  });
});

describe("pre-overhaul baseline", () => {
  it("keeps the old weapon cooldowns and enemy fire periods", () => {
    expect(Object.fromEntries(Object.entries(LEGACY_WEAPONS).map(([id, w]) => [id, w.cooldownMs]))).toEqual({
      standard: 220, shotgun: 450, laser: 130, cannon: 600, homing: 280, nova: 550, railgun: 180, nuke: 1200, swarm: 320, minigun: 70,
    });
    expect(Object.fromEntries(Object.entries(LEGACY_ENEMIES).map(([t, e]) => [t, e!.periodMs]))).toEqual({
      basic: [2400], tracker: [2000], sniper: [1600], spiral: [300], tank: [2800], swarm: [3200], snake: [2400], circler: [2200],
      sentinel: [2000, 1500, 800], phantom: [2500, 2000, 1500],
    });
    expect(Object.keys(LEGACY_WEAPONS).sort()).toEqual(ALL_WEAPONS.map((w) => w.id).sort());
  });

  it("models old Rapid Fire as −15 ms per old level (two per new level), floored at 30 ms", () => {
    expect(legacyCooldownMs("standard", 0)).toBe(220);
    expect(legacyCooldownMs("standard", 3)).toBe(130);
    expect(legacyCooldownMs("laser", 3)).toBe(40);
    expect(legacyCooldownMs("minigun", 3)).toBe(30);
  });

  it("old volleys had the same geometry as the volley module", () => {
    for (const { type, phase } of firingEnemies()) {
      for (const wave of [1, 6, 30]) {
        expect(legacyVolleyBullets(type, phase, wave), `${type} p${phase} w${wave}`).toBe(volleyFor(type, { phase, wave }).length);
      }
    }
  });
});

describe("weapon metrics", () => {
  it("follow the note value, bullet count and damage of every weapon", () => {
    for (const w of ALL_WEAPONS) {
      const m = weaponMetrics(w, 120);
      // At 120 bpm a beat is 0.5 s: 48 ticks per second.
      expect(m.shotsPerSec, w.id).toBeCloseTo(48 / w.noteTicks);
      expect(m.intervalTicks).toBe(w.noteTicks);
      expect(m.bulletsPerShot).toBe(w.baseBulletCount);
      expect(m.damagePerBullet).toBe(Math.max(1, Math.round(w.damageMultiplier)));
      expect(m.dps).toBeCloseTo(m.shotsPerSec * m.bulletsPerShot * m.damagePerBullet);
      expect(m.singleTargetDps).toBeCloseTo(m.shotsPerSec * m.damagePerBullet);
      expect(m.speed).toBe(w.baseBulletSpeed);
    }
  });

  it("compare against the old cooldowns", () => {
    const std = weaponMetrics(getWeapon("standard"), REFERENCE_BPM);
    expect(std.legacyShotsPerSec).toBeCloseTo(1000 / 220);
    expect(std.legacyDps).toBeCloseTo(1000 / 220);
    const shotgun = weaponMetrics(getWeapon("shotgun"), REFERENCE_BPM);
    expect(shotgun.legacyDps).toBeCloseTo((1000 / 450) * 3);
    expect(shotgun.legacySingleTargetDps).toBeCloseTo(1000 / 450);
  });

  it("apply loadouts the way pickups apply upgrades", () => {
    expect(loadoutStats(loadout("max"))).toMatchObject({ fireRate: 3, damage: 5, bulletCount: 5, pierce: 5 });
    const w = getWeapon("cannon");
    const max = weaponMetrics(w, 100, loadout("max"));
    expect(max.intervalTicks).toBe(fireIntervalTicks(w.noteTicks, 3));
    expect(max.bulletsPerShot).toBe(w.baseBulletCount + 4);
    expect(max.damagePerBullet).toBe(Math.round(w.damageMultiplier * 5));
    expect(max.pierce).toBe(w.basePierce + 5);
    expect(max.legacyDamagePerBullet).toBe(15);
    expect(allWeaponMetrics(100, loadout("mid"))).toHaveLength(ALL_WEAPONS.length);
  });
});

describe("enemy metrics", () => {
  it("lists every firing enemy and boss phase, never the decoy", () => {
    const list = firingEnemies();
    const regular = ENEMY_DEFS.filter((d) => !d.isBoss && !d.hidden).length;
    expect(list).toHaveLength(regular + 6);
    expect(list.some((e) => e.type === "phantom_decoy")).toBe(false);
    expect(list.filter((e) => e.type === "sentinel").map((e) => e.phase)).toEqual([1, 2, 3]);
    expect(allEnemyMetrics(REFERENCE_BPM)).toHaveLength(list.length);
  });

  it("turns a pattern into volleys and bullets per second, doubled by Bullet Storm", () => {
    const m = enemyMetrics("spiral", 100);
    const hits = m.hitsPerPattern / m.patternSteps;
    expect(m.volleysPerSec).toBeCloseTo(hits / 0.15);
    expect(m.bulletsPerVolley).toBe(4);
    expect(m.bulletsPerSec).toBeCloseTo(m.volleysPerSec * 4);
    expect(m.legacyBulletsPerSec).toBeCloseTo(4 / 0.3);
    expect(m.legacyStormBulletsPerSec).toBeCloseTo(2 * m.legacyBulletsPerSec);
    for (const e of allEnemyMetrics(100)) expect(e.stormBulletsPerSec, e.type).toBeCloseTo(2 * e.bulletsPerSec);
  });

  it("grows the Pulse ring with the wave, now and then", () => {
    expect(enemyMetrics("basic", 100, 1, 10).bulletsPerVolley).toBe(9);
    expect(legacyVolleyBullets("basic", 1, 10)).toBe(9);
  });
});

describe("time per kill", () => {
  it("streams shots of one bullet each into the target", () => {
    const cannon = getWeapon("cannon");
    const k = timePerKill(cannon, "tank", REFERENCE_BPM);
    const m = weaponMetrics(cannon, REFERENCE_BPM);
    expect(k.shots).toBe(Math.ceil(enemyDef("tank").hp / m.damagePerBullet));
    expect(k.seconds).toBeCloseTo(k.shots / m.shotsPerSec);
    expect(k.legacyShots).toBe(2);
    expect(k.legacySeconds).toBeCloseTo(1.2);
    expect(timePerKill(cannon, "tank", REFERENCE_BPM, loadout("base"), true).shots).toBe(Math.ceil(18 / m.damagePerBullet));
  });
});

describe("dilation response", () => {
  it("reports targets and response times of the time-dilation tuning", () => {
    const d = dilationResponse();
    expect(d.moveFireTarget).toBe(DEFAULT_DILATION.max);
    expect(d.moveOnlyTarget).toBeCloseTo(DEFAULT_DILATION.min + (DEFAULT_DILATION.max - DEFAULT_DILATION.min) * DEFAULT_DILATION.moveWeight);
    expect(d.secondsTo95).toBeLessThan(d.secondsTo99);
    expect(d.idleSecondsBelow01FromMove).toBeLessThan(d.idleSecondsBelow01);
  });

  it("is Infinity for a level the tuning never reaches", () => {
    const d = dilationResponse(1 / 60, { ...DEFAULT_DILATION, moveWeight: 0.3, fireWeight: 0.3 });
    expect(d.secondsTo95).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("balance report", () => {
  it("aligns table columns", () => {
    expect(formatTable(["a", "bb"], [["xyz", "1"], ["q", "22"]]).split("\n")).toEqual(["a    bb", "---  --", "xyz   1", "q    22"]);
  });

  it("formats signed percentages", () => {
    expect([0.154, -0.034, 0, Number.NaN].map(pct)).toEqual(["+15%", "-3%", "0%", "n/a"]);
  });

  it("covers every weapon, firing enemy, palette tempo and the dilation response", () => {
    const text = formatBalanceReport();
    for (const w of ALL_WEAPONS) expect(text).toContain(w.id);
    for (const p of ALL_PALETTES) expect(text).toContain(`${p.id} ${p.bpm}`);
    for (const label of ["basic", "tank", "sentinel p3", "phantom p2"]) expect(text).toContain(label);
    expect(text).toContain("Time dilation");
    expect(text).toContain(`reference ${REFERENCE_BPM} bpm`);
    expect(formatBalanceReport(90)).toContain("reference 90 bpm");
  });
});
