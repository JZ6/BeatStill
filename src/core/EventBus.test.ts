import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./EventBus";

interface TestEvents {
  ping: { n: number };
  pong: { s: string };
}

describe("EventBus", () => {
  it("delivers payloads to subscribers of the matching type only", () => {
    const bus = new EventBus<TestEvents>();
    const ping = vi.fn();
    const pong = vi.fn();
    bus.on("ping", ping);
    bus.on("pong", pong);

    bus.emit("ping", { n: 1 });

    expect(ping).toHaveBeenCalledExactlyOnceWith({ n: 1 });
    expect(pong).not.toHaveBeenCalled();
  });

  it("runs handlers in subscription order", () => {
    const bus = new EventBus<TestEvents>();
    const order: string[] = [];
    bus.on("ping", () => order.push("a"));
    bus.on("ping", () => order.push("b"));
    bus.on("ping", () => order.push("c"));

    bus.emit("ping", { n: 0 });

    expect(order).toEqual(["a", "b", "c"]);
  });

  it("unsubscribes via the returned function and via off()", () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = bus.on("ping", a);
    bus.on("ping", b);

    unsubA();
    bus.off("ping", b);
    bus.emit("ping", { n: 0 });

    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(bus.listenerCount("ping")).toBe(0);
  });

  it("once() fires a single time", () => {
    const bus = new EventBus<TestEvents>();
    const h = vi.fn();
    bus.once("ping", h);

    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });

    expect(h).toHaveBeenCalledExactlyOnceWith({ n: 1 });
  });

  it("skips a handler removed earlier in the same emit", () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    bus.on("ping", () => bus.off("ping", second));
    bus.on("ping", second);

    bus.emit("ping", { n: 0 });

    expect(second).not.toHaveBeenCalled();
  });

  it("does not run a handler added during the same emit", () => {
    const bus = new EventBus<TestEvents>();
    const late = vi.fn();
    bus.on("ping", () => {
      bus.on("ping", late);
    });

    bus.emit("ping", { n: 0 });
    expect(late).not.toHaveBeenCalled();

    bus.emit("ping", { n: 1 });
    expect(late).toHaveBeenCalledWith({ n: 1 });
  });

  it("runs remaining handlers when one throws, then rethrows the first error", () => {
    const bus = new EventBus<TestEvents>();
    const after = vi.fn();
    bus.on("ping", () => {
      throw new Error("first");
    });
    bus.on("ping", () => {
      throw new Error("second");
    });
    bus.on("ping", after);

    expect(() => bus.emit("ping", { n: 0 })).toThrow("first");
    expect(after).toHaveBeenCalledOnce();
  });

  it("clear() removes every handler", () => {
    const bus = new EventBus<TestEvents>();
    const h = vi.fn();
    bus.on("ping", h);
    bus.on("pong", h);

    bus.clear();
    bus.emit("ping", { n: 0 });
    bus.emit("pong", { s: "x" });

    expect(h).not.toHaveBeenCalled();
  });

  it("emitting with no subscribers is a no-op", () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit("ping", { n: 0 })).not.toThrow();
  });
});
