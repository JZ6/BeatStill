/**
 * The tutorial's steps and their completion rules, as pure data and math (no Phaser), so the
 * rules are unit-testable. Every condition is LATCHED: it looks at what happened since the step
 * was entered (counters from GameEvents, extremes of per-frame samples), never at a single frame,
 * so a press, a kill or a dip in the time scale between two checks is never missed.
 */
import { wrapAngle } from "../core/TimeDilation";
import type { EnemyType } from "../objects/enemies/registry";

export type TutorialStepId = "move" | "aim" | "fire" | "slow" | "speed" | "instruments" | "chain";

/** What a step asks for. Distances are in game pixels, turns in radians. */
export type TutorialGoal =
  | { kind: "move"; distance: number }
  | { kind: "aim"; turn: number }
  | { kind: "shots"; count: number }
  | { kind: "slow"; below: number }
  | { kind: "fast"; above: number }
  | { kind: "kill"; types: readonly EnemyType[] }
  | { kind: "chain"; count: number };

export interface TutorialStep {
  id: TutorialStepId;
  message: string;
  hint?: string;
  goal: TutorialGoal;
  /** Enemies the step brings in on the next bar line (and again if they're all gone with the goal unmet). */
  spawn?: readonly EnemyType[];
  /** Overrides the spawned enemies' hp (e.g. 1, so a chain needs one shot per enemy). */
  spawnHp?: number;
}

/** Everything the goals read, accumulated since the step was entered. */
export interface TutorialLatch {
  startX: number;
  startY: number;
  startRotation: number;
  /** Farthest the ship got from where it was at step entry. */
  maxDistance: number;
  /** Largest wrapped aim change from the rotation at step entry (radians, ≥ 0). */
  maxTurn: number;
  /** Shots fired (playerFired events). */
  shots: number;
  minTimeScale: number;
  maxTimeScale: number;
  /** Kills per enemy type (enemyKilled events). */
  kills: Partial<Record<EnemyType, number>>;
  /** Highest chain count a kill reached. */
  maxChain: number;
}

/** Real milliseconds every step stays on screen, even if its goal is already met. */
export const MIN_STEP_MS = 3000;
/** Time-scale thresholds of the slow-down / speed-up steps. */
export const SLOW_BELOW = 0.1;
export const FAST_ABOVE = 0.5;

/**
 * The steps in order. `moveDistance` is the move step's distance in game pixels (callers scale it
 * with the UI). Desktop and mobile get their own wording for the controls.
 */
export function buildTutorialSteps(mobile: boolean, moveDistance = 100): TutorialStep[] {
  return [
    {
      id: "move",
      message: mobile ? "Left stick — move your ship" : "WASD — move your ship",
      goal: { kind: "move", distance: moveDistance },
    },
    {
      id: "aim",
      message: mobile ? "Right stick — aim" : "Move the mouse to aim",
      goal: { kind: "aim", turn: 0.8 },
    },
    {
      id: "fire",
      message: mobile ? "Hold the right stick to fire" : "Hold the mouse button to fire",
      hint: "your shots play on the beat",
      goal: { kind: "shots", count: 4 },
    },
    {
      id: "slow",
      message: mobile ? "Let go of both sticks — time and the tempo slow down" : "Stop moving — time and the tempo slow down",
      hint: "listen: the heartbeat slows",
      goal: { kind: "slow", below: SLOW_BELOW },
    },
    {
      id: "speed",
      message: mobile ? "Move or aim to speed time back up" : "Move or shoot to speed time back up",
      hint: "the music follows you",
      goal: { kind: "fast", above: FAST_ABOVE },
    },
    {
      id: "instruments",
      message: "Every enemy is an instrument — destroy both",
      hint: "tank = bass, sniper = snare · they enter on the next bar, so keep time moving",
      goal: { kind: "kill", types: ["tank", "sniper"] },
      spawn: ["tank", "sniper"],
    },
    {
      id: "chain",
      message: "Kill enemies close together to chain",
      hint: "chained kills stack into harmony",
      goal: { kind: "chain", count: 2 },
      spawn: ["basic", "basic", "basic"],
      // One shot each, so two kills fit in the chain window.
      spawnHp: 1,
    },
  ];
}

/** A fresh latch at step entry: the ship's position, rotation and the time scale right now. */
export function createLatch(x: number, y: number, rotation: number, timeScale: number): TutorialLatch {
  return {
    startX: x,
    startY: y,
    startRotation: rotation,
    maxDistance: 0,
    maxTurn: 0,
    shots: 0,
    minTimeScale: timeScale,
    maxTimeScale: timeScale,
    kills: {},
    maxChain: 0,
  };
}

/** Per frame: folds the ship's position, rotation and the time scale into the latch. */
export function sampleLatch(latch: TutorialLatch, x: number, y: number, rotation: number, timeScale: number): void {
  if (Number.isFinite(x) && Number.isFinite(y)) {
    latch.maxDistance = Math.max(latch.maxDistance, Math.hypot(x - latch.startX, y - latch.startY));
  }
  if (Number.isFinite(rotation)) {
    latch.maxTurn = Math.max(latch.maxTurn, Math.abs(wrapAngle(rotation - latch.startRotation)));
  }
  if (Number.isFinite(timeScale)) {
    latch.minTimeScale = Math.min(latch.minTimeScale, timeScale);
    latch.maxTimeScale = Math.max(latch.maxTimeScale, timeScale);
  }
}

export function recordShot(latch: TutorialLatch): void {
  latch.shots++;
}

export function recordKill(latch: TutorialLatch, type: EnemyType, chainCount: number): void {
  latch.kills[type] = (latch.kills[type] ?? 0) + 1;
  if (Number.isFinite(chainCount)) latch.maxChain = Math.max(latch.maxChain, chainCount);
}

/** Enemy types a kill goal still needs (empty for every other goal). */
export function missingKills(goal: TutorialGoal, latch: TutorialLatch): EnemyType[] {
  if (goal.kind !== "kill") return [];
  return goal.types.filter((t) => !((latch.kills[t] ?? 0) > 0));
}

/**
 * What a step (re)spawns: a kill step only the types it still needs, any other step its whole
 * group (e.g. a fresh cluster for the chain). Empty for steps without enemies.
 */
export function typesToSpawn(step: TutorialStep, latch: TutorialLatch): EnemyType[] {
  if (!step.spawn) return [];
  if (step.goal.kind === "kill") {
    const missing = missingKills(step.goal, latch);
    return step.spawn.filter((t) => missing.includes(t));
  }
  return [...step.spawn];
}

export function goalMet(goal: TutorialGoal, latch: TutorialLatch): boolean {
  switch (goal.kind) {
    case "move":
      return latch.maxDistance >= goal.distance;
    case "aim":
      return latch.maxTurn >= goal.turn;
    case "shots":
      return latch.shots >= goal.count;
    case "slow":
      return latch.minTimeScale < goal.below;
    case "fast":
      return latch.maxTimeScale > goal.above;
    case "kill":
      return missingKills(goal, latch).length === 0;
    case "chain":
      return latch.maxChain >= goal.count;
  }
}

/**
 * Real-time gate of one step: it may advance once its goal is met AND it has been on screen for
 * at least `minMs` real milliseconds.
 */
export class StepGate {
  private elapsed = 0;

  constructor(readonly minMs = MIN_STEP_MS) {}

  get elapsedMs(): number {
    return this.elapsed;
  }

  /** Adds `realMs` (clamped to ≥ 0) and returns whether the step may advance. */
  update(realMs: number, met: boolean): boolean {
    if (Number.isFinite(realMs) && realMs > 0) this.elapsed += realMs;
    return met && this.elapsed >= this.minMs;
  }
}
