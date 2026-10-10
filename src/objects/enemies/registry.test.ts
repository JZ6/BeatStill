import { describe, expect, it } from "vitest";
import {
  ENEMY_DEFS,
  ENEMY_REGISTRY,
  ENEMY_TYPES,
  enemyDef,
  isEnemyType,
  phaseCount,
  rhythmHits,
  rhythmPattern,
  rhythmPreview,
  shapeLabel,
} from "./registry";

const hitSteps = (hits: readonly boolean[]) => hits.flatMap((h, i) => (h ? [i] : []));

describe("enemy registry", () => {
  it("has one frozen entry per type, keyed by its own type", () => {
    expect(ENEMY_DEFS.map((d) => d.type)).toEqual([...ENEMY_TYPES]);
    for (const t of ENEMY_TYPES) {
      expect(ENEMY_REGISTRY[t].type).toBe(t);
      expect(enemyDef(t)).toBe(ENEMY_REGISTRY[t]);
      expect(Object.isFrozen(ENEMY_REGISTRY[t])).toBe(true);
      expect(Object.isFrozen(ENEMY_REGISTRY[t].rhythm)).toBe(true);
    }
    expect(Object.isFrozen(ENEMY_REGISTRY)).toBe(true);
  });

  it("calls the basic enemy Pulse (\"Drone\" is the audio drone) and keeps its type id", () => {
    expect(ENEMY_REGISTRY.basic.name).toBe("Pulse");
    expect(ENEMY_REGISTRY.basic.type).toBe("basic");
    expect(ENEMY_DEFS.some((d) => /drone/i.test(d.name))).toBe(false);
  });

  it("keeps the pre-registry constructor stats exactly", () => {
    const stats = Object.fromEntries(ENEMY_DEFS.map((d) => [d.type, [d.hp, d.speed, d.color, d.radius]]));
    expect(stats).toEqual({
      basic: [2, 40, 0x44ff44, 16],
      tracker: [1, 60, 0xff8800, 12],
      sniper: [1, 20, 0xff2266, 10],
      spiral: [3, 25, 0xaa44ff, 18],
      tank: [6, 15, 0xff4444, 24],
      swarm: [1, 90, 0xffff44, 8],
      snake: [2, 50, 0x44ddff, 14],
      circler: [3, 20, 0x44ff88, 16],
      sentinel: [30, 8, 0xffaa22, 36],
      phantom: [40, 40, 0x4488ff, 28],
      phantom_decoy: [1, 0, 0x4488ff, 28],
    });
  });

  it("maps every type to its musical role", () => {
    expect(Object.fromEntries(ENEMY_DEFS.map((d) => [d.type, d.role]))).toEqual({
      basic: "pad",
      tracker: "stab",
      sniper: "snare",
      spiral: "arp",
      tank: "bass",
      swarm: "hat",
      snake: "melody",
      circler: "bell",
      sentinel: "boss",
      phantom: "boss",
      phantom_decoy: "bell",
    });
  });

  it("flags bosses and the boss-spawned decoy", () => {
    expect(ENEMY_DEFS.filter((d) => d.isBoss).map((d) => d.type)).toEqual(["sentinel", "phantom"]);
    expect(ENEMY_DEFS.filter((d) => d.hidden).map((d) => d.type)).toEqual(["phantom_decoy"]);
  });

  it("starts from the planned rhythms", () => {
    const rhythm = (t: (typeof ENEMY_TYPES)[number]) => {
      const hits = rhythmHits(t);
      return { length: hits.length, hits: hitSteps(hits), offsetStep: ENEMY_REGISTRY[t].rhythm.offsetStep };
    };
    expect(rhythm("basic")).toEqual({ length: 16, hits: [0], offsetStep: 4 });
    expect(rhythm("tracker")).toEqual({ length: 16, hits: [0], offsetStep: 2 });
    expect(rhythm("sniper")).toEqual({ length: 16, hits: [4], offsetStep: 8 });
    expect(rhythm("spiral")).toEqual({ length: 2, hits: [0], offsetStep: 1 });
    expect(rhythm("tank")).toEqual({ length: 16, hits: [0], offsetStep: 8 });
    expect(rhythm("swarm")).toEqual({ length: 20, hits: [0], offsetStep: 2 });
    expect(rhythm("snake")).toEqual({ length: 16, hits: [0], offsetStep: 2 });
    expect(rhythm("circler")).toEqual({ length: 16, hits: [0], offsetStep: 4 });
    expect(rhythm("phantom_decoy")).toEqual({ length: 0, hits: [], offsetStep: 0 });
  });

  it("gives bosses three phase patterns close to the old periods", () => {
    // Mean ms between volleys at 100 bpm (150 ms per 16th).
    const meanMs = (t: "sentinel" | "phantom", phase: number) => {
      const hits = rhythmHits(t, phase);
      return (hits.length / hitSteps(hits).length) * 150;
    };
    for (const t of ["sentinel", "phantom"] as const) {
      expect(phaseCount(t)).toBe(3);
      expect(ENEMY_REGISTRY[t].rhythm.phases?.[0]).toBe(ENEMY_REGISTRY[t].rhythm.pattern);
    }
    [2000, 1500, 800].forEach((ms, i) => expect(Math.abs(meanMs("sentinel", i + 1) - ms) / ms).toBeLessThan(0.15));
    [2500, 2000, 1500].forEach((ms, i) => expect(Math.abs(meanMs("phantom", i + 1) - ms) / ms).toBeLessThan(0.15));
    expect(hitSteps(rhythmHits("sentinel", 3))).toEqual([0, 6, 12]);
  });

  it("clamps phases and reuses parsed patterns", () => {
    expect(rhythmPattern("sentinel", 0)).toBe(rhythmPattern("sentinel", 1));
    expect(rhythmPattern("sentinel", 9)).toBe(rhythmPattern("sentinel", 3));
    expect(rhythmPattern("basic", 3)).toBe(ENEMY_REGISTRY.basic.rhythm.pattern);
    expect(phaseCount("basic")).toBe(1);
    expect(rhythmHits("basic")).toBe(rhythmHits("tank"));
    expect(Object.isFrozen(rhythmHits("swarm"))).toBe(true);
  });

  it("uses offset steps that divide the pattern length", () => {
    for (const d of ENEMY_DEFS) {
      for (let phase = 1; phase <= phaseCount(d.type); phase++) {
        const len = rhythmHits(d.type, phase).length;
        const step = d.rhythm.offsetStep;
        expect(Number.isInteger(step) && step >= 0, d.type).toBe(true);
        if (step > 0) expect(len % step, d.type).toBe(0);
      }
    }
  });

  it("previews one bar of each rhythm, looping short patterns", () => {
    const steps = (hits: boolean[]) => hitSteps(hits);
    expect(steps(rhythmPreview("sniper"))).toEqual([4]);
    expect(steps(rhythmPreview("spiral"))).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(steps(rhythmPreview("sentinel", 1))).toEqual([0, 12]);
    expect(steps(rhythmPreview("sentinel", 3))).toEqual([0, 6, 12]);
    expect(steps(rhythmPreview("swarm", 1, 20))).toEqual([0]);
    expect(rhythmPreview("phantom_decoy")).toEqual(new Array(16).fill(false));
    expect(rhythmPreview("basic", 1, 4)).toHaveLength(4);
  });

  it("labels shapes and recognises enemy types", () => {
    expect(ENEMY_DEFS.map((d) => shapeLabel(d.shape))).toEqual([
      "Circle", "Square", "Pentagon", "Heptagon", "Octagon", "Triangle", "Line", "Hexagon", "Dodecagon", "Diamond", "Diamond",
    ]);
    expect(shapeLabel({ kind: "polygon", sides: 9 })).toBe("9-gon");
    expect(isEnemyType("tank")).toBe(true);
    expect(isEnemyType("dragon")).toBe(false);
    expect(isEnemyType(3)).toBe(false);
  });
});
