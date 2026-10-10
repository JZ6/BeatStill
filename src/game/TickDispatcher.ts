import { TICKS_PER_STEP, type TickEvent } from "../core/Conductor";

export type TickHandler = (tick: TickEvent) => void;
/** `step` is the absolute 16th-note index: tick / TICKS_PER_STEP. */
export type StepHandler = (step: number, tick: TickEvent) => void;

interface Subscription {
  handler: TickHandler;
}

/**
 * Fans the Conductor's per-frame ticks out to subscribers, in order.
 * Pure TypeScript (no Phaser), so it is unit-testable.
 */
export class TickDispatcher {
  private readonly subs = new Set<Subscription>();

  /** Subscribes to every tick. Returns an unsubscribe function (safe to call more than once). */
  subscribe(handler: TickHandler): () => void {
    const sub: Subscription = { handler };
    this.subs.add(sub);
    return () => {
      this.subs.delete(sub);
    };
  }

  /** Subscribes to 16th-note steps only (ticks with isStep). Returns an unsubscribe function. */
  subscribeSteps(handler: StepHandler): () => void {
    return this.subscribe((t) => {
      if (t.isStep) handler(t.tick / TICKS_PER_STEP, t);
    });
  }

  /**
   * Delivers each tick to every subscriber. A handler unsubscribed during dispatch is not
   * called again; one subscribed during dispatch starts receiving ticks on the next dispatch.
   */
  dispatch(ticks: readonly TickEvent[]): void {
    if (ticks.length === 0 || this.subs.size === 0) return;
    const snapshot = [...this.subs];
    for (const tick of ticks) {
      for (const sub of snapshot) {
        if (this.subs.has(sub)) sub.handler(tick);
      }
    }
  }

  clear(): void {
    this.subs.clear();
  }

  get size(): number {
    return this.subs.size;
  }
}
