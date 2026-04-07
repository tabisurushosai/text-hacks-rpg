import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canUpgradeGearFromInventory,
  dismantleInventoryEquip,
  equipBestGearFromInventory,
  initialGameState,
} from "./core";
import type { InventoryItem } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dismantleInventoryEquip", () => {
  it("武器1スタックを砕くと経験値が増え、ログに経験値が出る", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const g0 = initialGameState("warrior");
    const sword: InventoryItem = {
      id: "test-weapon",
      name: "試しの剣",
      kind: "weapon",
      count: 1,
      power: 1,
      weaponCategory: "sword",
      weaponSpecial: "none",
    };
    const g = {
      ...g0,
      player: {
        ...g0.player,
        inventory: [sword],
      },
    };
    const next = dismantleInventoryEquip(g, 0);
    expect(next.player.exp).toBe(7);
    expect(next.log.some((l) => l.includes("経験値を7得た"))).toBe(true);
  });
});

describe("equipBestGearFromInventory", () => {
  it("かばんの最強武器を身につける", () => {
    const g0 = initialGameState("warrior");
    const sword: InventoryItem = {
      id: "test-weapon",
      name: "強い剣",
      kind: "weapon",
      count: 1,
      power: 12,
      weaponCategory: "sword",
      weaponSpecial: "none",
    };
    const g = {
      ...g0,
      player: {
        ...g0.player,
        inventory: [...g0.player.inventory, sword],
      },
    };
    expect(canUpgradeGearFromInventory(g.player)).toBe(true);
    const next = equipBestGearFromInventory(g);
    expect(next.player.weapon?.atk).toBe(12);
    expect(next.log.some((l) => l.includes("強い剣"))).toBe(true);
  });

  it("アップグレードがなければメッセージのみ", () => {
    const g0 = initialGameState("warrior");
    const g = {
      ...g0,
      player: {
        ...g0.player,
        weapon: {
          fullName: "最強",
          atk: 99,
          category: "sword",
          special: "none",
        },
        inventory: g0.player.inventory,
      },
    };
    expect(canUpgradeGearFromInventory(g.player)).toBe(false);
    const next = equipBestGearFromInventory(g);
    expect(next.log.at(-1)).toBe(
      "かばんの中では、いま身につけているもの以上に強い武器も防具もない。",
    );
  });
});
