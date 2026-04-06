import { SAVE_PAYLOAD_VERSION } from "./gameConfig";
import { describe, expect, it } from "vitest";
import { initialGameState } from "./core";
import {
  parseGameState,
  serializeGameState,
  tryLoadGameFromJson,
} from "./persistence";

describe("persistence", () => {
  it("roundtrips game state", () => {
    const g = initialGameState("mage");
    g.floor = 4;
    g.log.push("test line");
    const json = serializeGameState(g);
    expect(JSON.parse(json).v).toBe(SAVE_PAYLOAD_VERSION);
    const back = parseGameState(json);
    expect(back).not.toBeNull();
    expect(back!.job).toBe("mage");
    expect(back!.floor).toBe(4);
    expect(back!.pendingClientEvent).toBeNull();
    expect(back!.log).toContain("test line");
  });

  it("accepts legacy v1 envelope", () => {
    const g = initialGameState("farmer");
    const legacy = JSON.stringify({
      v: 1,
      job: "farmer",
      state: { ...g, pendingClientEvent: { type: "death", diedAtFloor: 2, job: "farmer" } },
    });
    const r = tryLoadGameFromJson(legacy);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.pendingClientEvent).toBeNull();
  });

  it("rejects invalid json", () => {
    expect(parseGameState("")).toBeNull();
    expect(parseGameState("{}")).toBeNull();
  });
});
