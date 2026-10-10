import { describe, expect, it } from "vitest";
import { GAME_EVENT_TYPES, createGameEvents, gameEventsOf } from "./GameEvents";

describe("GAME_EVENT_TYPES", () => {
  it("lists each event once", () => {
    expect(new Set(GAME_EVENT_TYPES).size).toBe(GAME_EVENT_TYPES.length);
    expect(GAME_EVENT_TYPES).toContain("playerFired");
    expect(GAME_EVENT_TYPES).toContain("levelCompleted");
    expect(GAME_EVENT_TYPES.length).toBe(19);
  });
});

describe("gameEventsOf", () => {
  it("returns the bus a host exposes", () => {
    const bus = createGameEvents();
    const host = { gameEvents: bus };
    expect(gameEventsOf(host)).toBe(bus);
    let got = 0;
    bus.on("bossPhaseChanged", (p) => (got = p.phase));
    gameEventsOf(host)?.emit("bossPhaseChanged", { bossType: "sentinel", phase: 2 });
    expect(got).toBe(2);
  });

  it("returns null without a bus", () => {
    expect(gameEventsOf({})).toBeNull();
    expect(gameEventsOf({ gameEvents: 42 })).toBeNull();
    expect(gameEventsOf({ gameEvents: undefined })).toBeNull();
  });
});
