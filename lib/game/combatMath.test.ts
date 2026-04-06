import { describe, expect, it } from "vitest";
import {
  computeEnemyDamage,
  computePhysicalDamage,
  expToNextLevelRequirement,
  processLevelUpAccumulation,
} from "./combatMath";
import type { Player } from "./types";

const basePlayer = (): Player => ({
  hp: 20,
  maxHp: 28,
  mp: 10,
  maxMp: 14,
  level: 1,
  exp: 0,
  baseAtk: 3,
  weapon: { fullName: "試し剣", atk: 2, category: "sword", special: "none" },
  knownSpells: [],
  inventory: [],
});

describe("combatMath", () => {
  it("expToNextLevelRequirement matches curve", () => {
    expect(expToNextLevelRequirement(1)).toBe(14);
    expect(expToNextLevelRequirement(2)).toBe(20);
  });

  it("computePhysicalDamage respects def and job", () => {
    const p = basePlayer();
    const warrior = computePhysicalDamage(p, 1, "warrior", 0);
    const mage = computePhysicalDamage(p, 1, "mage", 0);
    expect(warrior).toBeGreaterThanOrEqual(1);
    expect(warrior).toBeGreaterThan(mage);
  });

  it("piercing ignores 2 def", () => {
    const p = basePlayer();
    p.weapon = {
      fullName: "槍",
      atk: 2,
      category: "spear",
      special: "piercing",
    };
    const hi = computePhysicalDamage(p, 3, "warrior", 1);
    const lo = computePhysicalDamage(
      { ...p, weapon: { ...p.weapon!, special: "none" } },
      3,
      "warrior",
      1,
    );
    expect(hi).toBeGreaterThan(lo);
  });

  it("computeEnemyDamage adds 0 or 1", () => {
    expect(computeEnemyDamage(5, 0)).toBe(5);
    expect(computeEnemyDamage(5, 1)).toBe(6);
  });

  it("processLevelUpAccumulation chains levels", () => {
    const p = basePlayer();
    p.exp = expToNextLevelRequirement(1) + expToNextLevelRequirement(2);
    const { player, messages } = processLevelUpAccumulation(p);
    expect(player.level).toBe(3);
    expect(messages.length).toBe(2);
  });
});
