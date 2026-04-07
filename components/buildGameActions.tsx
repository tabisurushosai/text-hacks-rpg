"use client";

import {
  CRAFT_COST,
  combatMagicMenuPrefix,
  EXPLORE_CASTABLE_SPELLS,
  inventoryEquipTitle,
  isJobSkillSpell,
  ITEM_HERB,
  ITEM_MANA_HERB,
  ITEM_MANA_POTION_MINOR,
  ITEM_POTION_MINOR,
  sortCombatAbilitiesForMenu,
  SPELLS,
} from "@/lib/game/data";
import {
  closeExploreMagicMenu,
  closeItemsMenu,
  closeSmithMenu,
  combatFight,
  combatItem,
  combatMagic,
  combatRun,
  canUpgradeGearFromInventory,
  countMaterial,
  craftMediumHpPotion,
  craftMediumMpPotion,
  craftMinorHpPotion,
  craftMinorMpPotion,
  descendStairs,
  dismantleInventoryEquip,
  discardInventoryWeapons,
  equipBestGearFromInventory,
  explore,
  exploreMagic,
  inventoryActionLabel,
  openExploreMagicMenu,
  openItemsMenu,
  openSmithMenu,
  orderedInventoryForMenu,
  useItemExplore,
} from "@/lib/game/core";
import type { GameState, SpellId } from "@/lib/game/types";
import type { Dispatch, SetStateAction } from "react";

export type ActionEntry = {
  key: string;
  label: string;
  disabled?: boolean;
  title?: string;
  onActivate: () => void;
};

export function buildGameActions(
  game: GameState,
  setGame: Dispatch<SetStateAction<GameState>>,
): ActionEntry[] {
  const p = game.player;
  const inCombat = game.phase === "combat" && game.enemy;

  if (game.phase === "cleared") {
    return [];
  }

  if (game.phase === "explore") {
    if (game.exploreMenu === "smith") {
      const equips = orderedInventoryForMenu(p.inventory).filter(
        (x) => x.kind === "weapon" || x.kind === "armor",
      );
      const dismantleEntries: ActionEntry[] = equips.map((it) => ({
        key: `smith-${it.id}`,
        label: `分解：${it.kind === "weapon" ? "武器" : "防具"} ${it.count > 1 ? `${it.name}×${it.count}` : it.name}`,
        title:
          "かばんの1スタック分を砕き、経験値に変えます。攻撃力・防御が高いほど多く得られます。",
        onActivate: () =>
          setGame((g) => {
            const idx = g.player.inventory.findIndex((x) => x.id === it.id);
            return dismantleInventoryEquip(g, idx >= 0 ? idx : 0);
          }),
      }));
      return [
        ...dismantleEntries,
        {
          key: "back-smith",
          label: "戻る",
          onActivate: () => setGame((g) => closeSmithMenu(g)),
        },
      ];
    }

    if (game.exploreMenu === "items") {
      const equipHeldItems = p.inventory
        .filter((x) => x.kind === "weapon" || x.kind === "armor")
        .reduce((s, w) => s + w.count, 0);
      const canSmith = equipHeldItems > 0;
      const herbs = countMaterial(game, ITEM_HERB);
      const manaHerbs = countMaterial(game, ITEM_MANA_HERB);
      const minorHp = countMaterial(game, ITEM_POTION_MINOR);
      const minorMp = countMaterial(game, ITEM_MANA_POTION_MINOR);
      const craftsHerb: ActionEntry[] = [
        {
          key: "craft-hp",
          label: `初級ポーション（${ITEM_HERB}${CRAFT_COST}）`,
          disabled: herbs < CRAFT_COST,
          onActivate: () => setGame((g) => craftMinorHpPotion(g)),
        },
        {
          key: "craft-mp",
          label: `初級魔力ポーション（${ITEM_MANA_HERB}${CRAFT_COST}）`,
          disabled: manaHerbs < CRAFT_COST,
          onActivate: () => setGame((g) => craftMinorMpPotion(g)),
        },
      ];
      const craftsTier: ActionEntry[] = [
        {
          key: "craft-hp-med",
          label: `中級ポーション（${ITEM_POTION_MINOR}×${CRAFT_COST}）`,
          disabled: minorHp < CRAFT_COST,
          onActivate: () => setGame((g) => craftMediumHpPotion(g)),
        },
        {
          key: "craft-mp-med",
          label: `中級魔力ポーション（${ITEM_MANA_POTION_MINOR}×${CRAFT_COST}）`,
          disabled: minorMp < CRAFT_COST,
          onActivate: () => setGame((g) => craftMediumMpPotion(g)),
        },
      ];
      const useEntries: ActionEntry[] = orderedInventoryForMenu(
        p.inventory,
      ).map((it) => ({
        key: `explore-use-${it.id}`,
        label: inventoryActionLabel(it),
        title: inventoryEquipTitle(it),
        onActivate: () =>
          setGame((g) => {
            const idx = g.player.inventory.findIndex((x) => x.id === it.id);
            return useItemExplore(g, idx >= 0 ? idx : 0);
          }),
      }));
      return [
        ...craftsHerb,
        ...craftsTier,
        {
          key: "equip-best-gear",
          label: "最強装備（数値最大の武器・防具）",
          disabled: !canUpgradeGearFromInventory(p),
          title:
            "かばんにある装備のうち、攻撃力・防御力がいちばん大きい武器と防具を身につけます（いまの装備より弱いものは替えません）",
          onActivate: () => setGame((g) => equipBestGearFromInventory(g)),
        },
        {
          key: "open-smith",
          label: "分解（武器・防具→経験値）",
          disabled: !canSmith,
          title:
            "かばんの武器・防具を砕いて経験値にします（装備中のものは対象外）",
          onActivate: () => setGame((g) => openSmithMenu(g)),
        },
        ...useEntries,
        {
          key: "discard-weapons",
          label: "装備以外の武器・防具を捨てる",
          disabled: equipHeldItems === 0,
          title:
            "所持している武器・防具だけをまとめて捨てます（装備中は残ります）",
          onActivate: () => setGame((g) => discardInventoryWeapons(g)),
        },
        {
          key: "back-items",
          label: "戻る",
          onActivate: () => setGame((g) => closeItemsMenu(g)),
        },
      ];
    }

    if (game.exploreMenu === "magic") {
      const castableIds = EXPLORE_CASTABLE_SPELLS.filter((sid) =>
        p.knownSpells.includes(sid),
      );
      const spellEntries: ActionEntry[] = castableIds.map((sid) => {
        const cost = SPELLS[sid].mpCost;
        const disabled = p.mp < cost;
        return {
          key: `explore-magic-${sid}`,
          label: `${SPELLS[sid].label}（MP ${cost}）`,
          disabled,
          title: SPELLS[sid].description,
          onActivate: () => {
            if (disabled) return;
            setGame((g) => exploreMagic(g, sid));
          },
        };
      });
      return [
        ...spellEntries,
        {
          key: "back-explore-magic",
          label: "戻る",
          onActivate: () => setGame((g) => closeExploreMagicMenu(g)),
        },
      ];
    }

    const knowsExploreCast = p.knownSpells.some((s) =>
      EXPLORE_CASTABLE_SPELLS.includes(s),
    );

    const canDescend = game.stairsVisible && game.floor < 10;
    const descendTitle = canDescend
      ? "次の階へ進みます"
      : game.floor >= 10
        ? "ここが最下層です"
        : "探索で階段を見つけると選べます";

    return [
      {
        key: "explore",
        label: "探索する",
        onActivate: () => setGame((g) => explore(g)),
      },
      {
        key: "items-open",
        label: "調合アイテム",
        onActivate: () => setGame((g) => openItemsMenu(g)),
      },
      {
        key: "explore-magic-open",
        label: "魔法",
        disabled: !knowsExploreCast,
        title: knowsExploreCast
          ? "探索中に回復や職スキル（探索可のもの）を唱えます"
          : "職スキルか、回復の綴りを拾うと使えるようになります",
        onActivate: () =>
          setGame((g) => {
            if (
              !g.player.knownSpells.some((s) =>
                EXPLORE_CASTABLE_SPELLS.includes(s),
              )
            ) {
              return { ...g, log: [...g.log, "まだここで唱えられる魔法を知らない。"] };
            }
            return openExploreMagicMenu(g);
          }),
      },
      {
        key: "descend",
        label: "階段を降りる",
        disabled: !canDescend,
        title: descendTitle,
        onActivate: () =>
          setGame((g) => {
            if (!(g.stairsVisible && g.floor < 10)) return g;
            return descendStairs(g);
          }),
      },
    ];
  }

  if (!inCombat) return [];

  if (game.combatMenu === "main") {
    const abilityIds = sortCombatAbilitiesForMenu(p.knownSpells);
    const hasAbilities = abilityIds.length > 0;
    return [
      {
        key: "fight",
        label: "戦う",
        onActivate: () => setGame((g) => combatFight(g)),
      },
      {
        key: "abilities-open",
        label: "スキル・魔法",
        disabled: !hasAbilities,
        title: hasAbilities
          ? "職スキルと、綴りで覚えた炎・氷・雷・癒し"
          : "使えるスキルや魔法がない",
        onActivate: () =>
          setGame((g) => {
            if (sortCombatAbilitiesForMenu(g.player.knownSpells).length === 0) {
              return {
                ...g,
                log: [...g.log, "使えるスキルや魔法がない。"],
              };
            }
            return { ...g, combatMenu: "abilities" };
          }),
      },
      {
        key: "item-open",
        label: "道具",
        disabled: p.inventory.length === 0,
        title:
          p.inventory.length === 0
            ? "使える道具がない"
            : "所持品を戦闘で使う",
        onActivate: () =>
          setGame((g) => {
            if (g.player.inventory.length === 0) {
              return { ...g, log: [...g.log, "使える道具がない。"] };
            }
            return { ...g, combatMenu: "item" };
          }),
      },
      {
        key: "run",
        label: "逃げる",
        title: "戦闘から離脱を試みる（ボスでは足がすくむ）",
        onActivate: () => setGame((g) => combatRun(g)),
      },
    ];
  }

  if (game.combatMenu === "abilities") {
    const ordered = sortCombatAbilitiesForMenu(p.knownSpells);
    const spells: ActionEntry[] = ordered.map((sid) => {
      const cost = SPELLS[sid].mpCost;
      const disabled = p.mp < cost;
      const label = isJobSkillSpell(sid)
        ? `【職】${SPELLS[sid].label}（MP ${cost}）`
        : `${combatMagicMenuPrefix(sid)}${SPELLS[sid].label}（MP ${cost}）`;
      return {
        key: `spell-${sid}`,
        label,
        disabled,
        title: SPELLS[sid].description,
        onActivate: () => {
          if (disabled) return;
          setGame((g) => combatMagic(g, sid as SpellId));
        },
      };
    });
    return [
      ...spells,
      {
        key: "back-abilities",
        label: "戻る",
        onActivate: () => setGame((g) => ({ ...g, combatMenu: "main" })),
      },
    ];
  }

  if (game.combatMenu === "item") {
    const items: ActionEntry[] = orderedInventoryForMenu(p.inventory).map(
      (it) => ({
        key: `item-${it.id}`,
        label: inventoryActionLabel(it),
        title: inventoryEquipTitle(it),
        onActivate: () =>
          setGame((g) => {
            const idx = g.player.inventory.findIndex((x) => x.id === it.id);
            return combatItem(g, idx >= 0 ? idx : 0);
          }),
      }),
    );
    return [
      ...items,
      {
        key: "back-item",
        label: "戻る",
        onActivate: () => setGame((g) => ({ ...g, combatMenu: "main" })),
      },
    ];
  }

  return [];
}
