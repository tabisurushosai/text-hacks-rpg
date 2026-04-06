import { describe, expect, it } from "vitest";
import { initialGameState } from "./core";
import { runClearEpithet } from "./runEpithet";
import type { SpellId } from "./types";

const ELEVEN_SPELLS: SpellId[] = [
  "fire_jolt",
  "fire_blast",
  "ice_shard",
  "ice_wrath",
  "volt_needle",
  "volt_chain",
  "heal_soft",
  "heal_solid",
  "war_cleave",
  "war_resolve",
  "mage_ether",
];

describe("runClearEpithet", () => {
  it("returns default epithet for modest run", () => {
    const g = initialGameState("warrior");
    g.totalBattlesFought = 10;
    expect(runClearEpithet(g)).toBe("層底を踏みしめし者");
  });

  it("prioritizes high battle count over level", () => {
    const g = initialGameState("mage");
    g.totalBattlesFought = 105;
    g.player.level = 15;
    expect(runClearEpithet(g)).toBe("層を測りし者");
  });

  it("uses spell count tier when battles below 50", () => {
    const g = initialGameState("warrior");
    g.totalBattlesFought = 20;
    g.player.knownSpells = [...ELEVEN_SPELLS];
    expect(runClearEpithet(g)).toBe("綴りを貪りし者");
  });
});
