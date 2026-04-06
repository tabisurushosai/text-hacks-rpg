"use client";

import {
  CRAFT_COST,
  combatMagicMenuPrefix,
  EXPLORE_CASTABLE_SPELLS,
  inventoryWeaponTitle,
  isJobSkillSpell,
  ITEM_HERB,
  ITEM_MANA_HERB,
  ITEM_MANA_POTION_MINOR,
  ITEM_POTION_MINOR,
  sortJobSkillsForMenu,
  sortMagicSpellsForCombatMenu,
  SPELLS,
} from "@/lib/game/data";
import {
  closeExploreMagicMenu,
  closeItemsMenu,
  combatFight,
  combatItem,
  combatMagic,
  combatRun,
  countMaterial,
  craftMediumHpPotion,
  craftMediumMpPotion,
  craftMinorHpPotion,
  craftMinorMpPotion,
  descendStairs,
  discardInventoryWeapons,
  explore,
  exploreMagic,
  inventoryActionLabel,
  openExploreMagicMenu,
  openItemsMenu,
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
    if (game.exploreMenu === "items") {
      const weaponHeldItems = p.inventory
        .filter((x) => x.kind === "weapon")
        .reduce((s, w) => s + w.count, 0);
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
      const useEntries: ActionEntry[] = p.inventory.map((it) => ({
        key: `explore-use-${it.id}`,
        label: inventoryActionLabel(it),
        title: inventoryWeaponTitle(it),
        onActivate: () =>
          setGame((g) => {
            const idx = g.player.inventory.findIndex((x) => x.id === it.id);
            return useItemExplore(g, idx >= 0 ? idx : 0);
          }),
      }));
      return [
        ...craftsHerb,
        ...craftsTier,
        ...useEntries,
        {
          key: "discard-weapons",
          label: "装備以外の武器を捨てる",
          disabled: weaponHeldItems === 0,
          title: "所持している武器だけをまとめて捨てます（装備中は残ります）",
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
    const hasJobSkills = p.knownSpells.some((s) => isJobSkillSpell(s));
    const hasMagicSpells = p.knownSpells.some((s) => !isJobSkillSpell(s));
    return [
      {
        key: "fight",
        label: "戦う",
        onActivate: () => setGame((g) => combatFight(g)),
      },
      {
        key: "skills-open",
        label: "スキル",
        disabled: !hasJobSkills,
        title: hasJobSkills
          ? "職業スキル（強撃・応急措置など）"
          : "職スキルがない",
        onActivate: () =>
          setGame((g) => {
            if (!g.player.knownSpells.some((s) => isJobSkillSpell(s))) {
              return { ...g, log: [...g.log, "使える職スキルがない。"] };
            }
            return { ...g, combatMenu: "skills" };
          }),
      },
      {
        key: "magic-open",
        label: "魔法",
        disabled: !hasMagicSpells,
        title: hasMagicSpells
          ? "炎・氷・雷・癒し（綴りで覚えた魔法）"
          : "まだ魔法を知らない",
        onActivate: () =>
          setGame((g) => {
            if (!g.player.knownSpells.some((s) => !isJobSkillSpell(s))) {
              return { ...g, log: [...g.log, "まだ魔法を知らない。"] };
            }
            return { ...g, combatMenu: "magic" };
          }),
      },
      {
        key: "misc-open",
        label: "その他",
        title: "道具の使用・逃走",
        onActivate: () => setGame((g) => ({ ...g, combatMenu: "misc" })),
      },
    ];
  }

  if (game.combatMenu === "misc") {
    return [
      {
        key: "misc-item",
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
        key: "misc-run",
        label: "逃げる",
        title: "戦闘から離脱を試みる",
        onActivate: () => setGame((g) => combatRun(g)),
      },
      {
        key: "back-misc",
        label: "戻る",
        onActivate: () => setGame((g) => ({ ...g, combatMenu: "main" })),
      },
    ];
  }

  if (game.combatMenu === "skills") {
    const ordered = sortJobSkillsForMenu(p.knownSpells);
    const spells: ActionEntry[] = ordered.map((sid) => {
      const cost = SPELLS[sid].mpCost;
      const disabled = p.mp < cost;
      return {
        key: `spell-${sid}`,
        label: `【職】${SPELLS[sid].label}（MP ${cost}）`,
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
        key: "back-skills",
        label: "戻る",
        onActivate: () => setGame((g) => ({ ...g, combatMenu: "main" })),
      },
    ];
  }

  if (game.combatMenu === "magic") {
    const ordered = sortMagicSpellsForCombatMenu(p.knownSpells);
    const spells: ActionEntry[] = ordered.map((sid) => {
      const cost = SPELLS[sid].mpCost;
      const disabled = p.mp < cost;
      const prefix = combatMagicMenuPrefix(sid);
      return {
        key: `spell-${sid}`,
        label: `${prefix}${SPELLS[sid].label}（MP ${cost}）`,
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
        key: "back-magic",
        label: "戻る",
        onActivate: () => setGame((g) => ({ ...g, combatMenu: "main" })),
      },
    ];
  }

  if (game.combatMenu === "item") {
    const items: ActionEntry[] = p.inventory.map((it) => ({
      key: `item-${it.id}`,
      label: inventoryActionLabel(it),
      title: inventoryWeaponTitle(it),
      onActivate: () =>
        setGame((g) => {
          const idx = g.player.inventory.findIndex((x) => x.id === it.id);
          return combatItem(g, idx >= 0 ? idx : 0);
        }),
    }));
    return [
      ...items,
      {
        key: "back-item",
        label: "戻る",
        onActivate: () => setGame((g) => ({ ...g, combatMenu: "misc" })),
      },
    ];
  }

  return [];
}
