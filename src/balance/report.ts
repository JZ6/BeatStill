/**
 * The balance report as plain text tables (`npm run balance` prints it). Pure: every number comes
 * from src/balance/metrics.ts.
 */
import { ENEMY_DEFS, type EnemyType } from "../objects/enemies/registry";
import { ALL_WEAPONS } from "../systems/Weapons";
import {
  LOADOUTS,
  REFERENCE_BPM,
  allEnemyMetrics,
  allWeaponMetrics,
  dilationResponse,
  enemyMetrics,
  firingEnemies,
  heldLoadout,
  paletteTempos,
  relativeChange,
  timePerKill,
  weaponMetrics,
} from "./metrics";

/** Pads cells into aligned columns: the first column left-aligned, the rest right-aligned. */
export function formatTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((h, c) => Math.max(h.length, ...rows.map((r) => (r[c] ?? "").length)));
  const line = (cells: readonly string[]) =>
    cells.map((cell, c) => (c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join("  ").trimEnd();
  return [line(headers), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(line)].join("\n");
}

const num = (n: number, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits) : "∞");

/** Signed percentage, e.g. "+15%" or "-3%". */
export function pct(change: number): string {
  if (!Number.isFinite(change)) return "n/a";
  const p = Math.round(change * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
}

const enemyLabel = (type: EnemyType, phase: number, phases: number) => (phases > 1 ? `${type} p${phase}` : type);

function weaponSection(bpm: number): string {
  const parts: string[] = [];
  for (const loadout of LOADOUTS) {
    const rows = allWeaponMetrics(bpm, loadout).map((m) => [
      m.id,
      m.note,
      num(m.shotsPerSec),
      String(m.bulletsPerShot),
      String(m.damagePerBullet),
      String(m.bulletHp),
      num(m.clearPerSec, 1),
      num(m.dps, 1),
      num(m.singleTargetDps, 1),
      num(m.legacyShotsPerSec),
      num(m.legacyDps, 1),
      pct(relativeChange(m.dps, m.legacyDps)),
      String(m.speed),
      String(m.legacySpeed),
      m.range === null ? "-" : num(m.range, 0),
      m.legacyRange === null ? "-" : num(m.legacyRange, 0),
    ]);
    const l = loadout;
    parts.push(
      `Weapons at ${bpm} bpm, loadout "${l.name}" (Rapid Fire ${l.rapidFire}, Power ${l.power}, Multi Shot ${l.multiShot}, Penetration ${l.penetration}):\n` +
        formatTable(["weapon", "note", "shots/s", "bul", "dmg", "HP", "clear/s", "DPS", "1-tgt", "old shots/s", "old DPS", "ΔDPS", "speed", "old speed", "range", "old range"], rows),
    );
  }
  return parts.join("\n\n");
}

function weaponTempoSection(): string {
  const tempos = paletteTempos();
  const rows = ALL_WEAPONS.map((w) => [
    w.id,
    ...tempos.map((t) => {
      const m = weaponMetrics(w, t.bpm, heldLoadout(w.id));
      return `${num(m.dps, 1)} (${pct(relativeChange(m.dps, m.legacyDps))})`;
    }),
  ]);
  return (
    "DPS as first held (base stats; the minigun at Rapid Fire 3, where its evolution starts), Δ vs old, per palette tempo:\n" +
    formatTable(["weapon", ...tempos.map((t) => `${t.id} ${t.bpm}`)], rows)
  );
}

function enemySection(bpm: number): string {
  const tempos = paletteTempos();
  const phases = (type: EnemyType) => firingEnemies().filter((e) => e.type === type).length;
  const atRef = allEnemyMetrics(bpm);
  const rows = atRef.map((m) => [
    enemyLabel(m.type, m.phase, phases(m.type)),
    `${m.hitsPerPattern}/${m.patternSteps}`,
    String(m.bulletsPerVolley),
    ...tempos.map((t) => num(enemyMetrics(m.type, t.bpm, m.phase).bulletsPerSec)),
    num(m.bulletsPerSec),
    num(m.legacyBulletsPerSec),
    pct(relativeChange(m.bulletsPerSec, m.legacyBulletsPerSec)),
    num(m.stormBulletsPerSec),
    num(m.legacyStormBulletsPerSec),
  ]);
  return (
    `Enemy bullets/s (wave 1) per palette tempo, and at ${bpm} bpm vs the old timers (storm = Bullet Storm):\n` +
    formatTable(
      ["enemy", "hits/steps", "bul", ...tempos.map((t) => `${t.id} ${t.bpm}`), `@${bpm}`, "old", "Δ", "storm", "old storm"],
      rows,
    )
  );
}

function killSection(bpm: number): string {
  const targets = ENEMY_DEFS.filter((d) => !d.hidden).map((d) => d.type);
  const rows = ALL_WEAPONS.map((w) => [
    w.id,
    ...targets.map((t) => {
      const k = timePerKill(w, t, bpm);
      return `${num(k.seconds)}/${num(k.legacySeconds)}`;
    }),
  ]);
  return `Seconds per kill streaming one bullet per shot, base loadout, at ${bpm} bpm (now/old):\n` + formatTable(["weapon", ...targets], rows);
}

function dilationSection(): string {
  const d = dilationResponse();
  return [
    "Time dilation (60 fps, keyboard move magnitude 1):",
    `  move + fire target ${num(d.moveFireTarget, 3)}, move only ${num(d.moveOnlyTarget, 3)}`,
    `  min → 0.95 in ${num(d.secondsTo95)} s, → 0.99 in ${num(d.secondsTo99)} s`,
    `  idle: 1 → below 0.1 in ${num(d.idleSecondsBelow01)} s; move-only plateau → below 0.1 in ${num(d.idleSecondsBelow01FromMove)} s`,
  ].join("\n");
}

/** The whole report; `bpm` is the reference tempo for the detailed tables. */
export function formatBalanceReport(bpm: number = REFERENCE_BPM): string {
  const tempos = paletteTempos()
    .map((t) => `${t.id} ${t.bpm}`)
    .join(", ");
  return [
    `Beat Still balance report (reference ${bpm} bpm; old = pre-overhaul ms timers on main)`,
    `Palette tempos: ${tempos}`,
    weaponSection(bpm),
    weaponTempoSection(),
    enemySection(bpm),
    killSection(bpm),
    dilationSection(),
  ].join("\n\n");
}
