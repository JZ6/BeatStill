/**
 * Minimal, fully typed event bus with no engine dependencies, so it can be
 * unit-tested in Node and shared between gameplay and audio code.
 *
 * Semantics:
 * - Handlers run in subscription order.
 * - A handler removed during an emit is skipped if it has not run yet.
 * - A handler added during an emit does not run for that emit.
 * - If a handler throws, the remaining handlers still run; the first error is
 *   rethrown after all handlers have been called (so crash reporting sees it).
 */
export type Handler<T> = (payload: T) => void;

export class EventBus<M extends object> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(type: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(type, handler);
  }

  once<K extends keyof M>(type: K, handler: Handler<M[K]>): () => void {
    const wrapper: Handler<M[K]> = (payload) => {
      this.off(type, wrapper);
      handler(payload);
    };
    return this.on(type, wrapper);
  }

  off<K extends keyof M>(type: K, handler: Handler<M[K]>): void {
    const set = this.handlers.get(type);
    if (!set) return;
    set.delete(handler as Handler<never>);
    if (set.size === 0) this.handlers.delete(type);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.handlers.get(type);
    if (!set || set.size === 0) return;
    let firstError: unknown;
    let hasError = false;
    for (const handler of [...set]) {
      if (!set.has(handler)) continue;
      try {
        (handler as Handler<M[K]>)(payload);
      } catch (err) {
        if (!hasError) {
          hasError = true;
          firstError = err;
        }
      }
    }
    if (hasError) throw firstError;
  }

  listenerCount<K extends keyof M>(type: K): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }
}
