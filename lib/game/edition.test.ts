import { describe, expect, it } from "vitest";
import { getGameEdition } from "./edition";

describe("getGameEdition", () => {
  it("defaults to full when NEXT_PUBLIC_GAME_EDITION is unset", () => {
    expect(getGameEdition()).toBe("full");
  });
});
