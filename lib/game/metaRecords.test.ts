import { describe, expect, it } from "vitest";
import {
  emptyMetaRecords,
  mergeMetaAfterBossClear,
  mergeMetaAfterDeath,
  mergeMetaRunStarted,
} from "./metaRecords";

describe("metaRecords", () => {
  it("mergeMetaAfterDeath updates deepest", () => {
    const a = emptyMetaRecords();
    const b = mergeMetaAfterDeath(a, 5);
    expect(b.deepestFloorReached).toBe(5);
    const c = mergeMetaAfterDeath(b, 3);
    expect(c.deepestFloorReached).toBe(5);
  });

  it("mergeMetaAfterBossClear increments clears and deepest", () => {
    const a = emptyMetaRecords();
    const b = mergeMetaAfterBossClear(a, 10);
    expect(b.bossClears).toBe(1);
    expect(b.deepestFloorReached).toBe(10);
  });

  it("mergeMetaRunStarted increments", () => {
    const a = emptyMetaRecords();
    expect(mergeMetaRunStarted(a).runsStarted).toBe(1);
  });
});
