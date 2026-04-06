import { describe, expect, it } from "vitest";
import { initialGameState } from "./core";
import { parseGameState, serializeGameState } from "./persistence";

describe("persistence", () => {
  it("roundtrips game state", () => {
    const g = initialGameState("mage");
    g.floor = 4;
    g.log.push("test line");
    const json = serializeGameState(g);
    const back = parseGameState(json);
    expect(back).not.toBeNull();
    expect(back!.job).toBe("mage");
    expect(back!.floor).toBe(4);
    expect(back!.pendingClientEvent).toBeNull();
    expect(back!.log).toContain("test line");
  });

  it("rejects invalid json", () => {
    expect(parseGameState("")).toBeNull();
    expect(parseGameState("{}")).toBeNull();
  });
});
