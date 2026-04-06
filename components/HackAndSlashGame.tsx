"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  CRAFT_COST,
  formatWeaponEquipLine,
  inventoryWeaponTitle,
  ITEM_HERB,
  ITEM_MANA_HERB,
  ITEM_MANA_POTION_MINOR,
  ITEM_POTION_MINOR,
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
  expUntilLevelUp,
  initialGameState,
  inventoryActionLabel,
  openExploreMagicMenu,
  openItemsMenu,
  useItemExplore,
} from "@/lib/game/core";
import { useGameBgm } from "@/components/GameBgmContext";
import { RUN_TARGET_MINUTES } from "@/lib/game/balance";
import type { GameState, SpellId } from "@/lib/game/types";

/** クリア報酬（本作 BGM） */
const CLEAR_BGM_DRIVE =
  "https://drive.google.com/drive/folders/1Tp3UyQZCMxpGfHYfC-gFw93FsOJm3I_V?usp=sharing";

type ActionEntry = {
  key: string;
  label: string;
  disabled?: boolean;
  title?: string;
  onActivate: () => void;
};

function buildActions(
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
      const healIds = (["heal_soft", "heal_solid"] as const).filter((sid) =>
        p.knownSpells.includes(sid),
      );
      const spellEntries: ActionEntry[] = healIds.map((sid) => {
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

    const knowsExploreHeal = p.knownSpells.some(
      (s) => s === "heal_soft" || s === "heal_solid",
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
        disabled: !knowsExploreHeal,
        title: knowsExploreHeal
          ? "探索中に回復魔法を唱えます"
          : "回復の綴りを拾うと使えるようになります",
        onActivate: () =>
          setGame((g) => {
            if (
              !g.player.knownSpells.some(
                (s) => s === "heal_soft" || s === "heal_solid",
              )
            ) {
              return { ...g, log: [...g.log, "まだ回復の魔法を知らない。"] };
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
    return [
      {
        key: "fight",
        label: "戦う",
        onActivate: () => setGame((g) => combatFight(g)),
      },
      {
        key: "magic",
        label: "魔法",
        onActivate: () =>
          setGame((g) => {
            if (g.player.knownSpells.length === 0) {
              return { ...g, log: [...g.log, "まだ魔法を知らない。"] };
            }
            return { ...g, combatMenu: "magic" };
          }),
      },
      {
        key: "item",
        label: "道具",
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
        onActivate: () => setGame((g) => combatRun(g)),
      },
    ];
  }

  if (game.combatMenu === "magic") {
    const spells: ActionEntry[] = p.knownSpells.map((sid) => {
      const cost = SPELLS[sid].mpCost;
      const disabled = p.mp < cost;
      return {
        key: `spell-${sid}`,
        label: `${SPELLS[sid].label}（MP ${cost}）`,
        disabled,
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
        onActivate: () => setGame((g) => ({ ...g, combatMenu: "main" })),
      },
    ];
  }

  return [];
}

function formatStack(name: string, count: number): string {
  return count > 1 ? `${name}×${count}` : name;
}

export function HackAndSlashGame() {
  const [game, setGame] = useState<GameState>(() => initialGameState());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const { bgmPlaying, bgmMissing, toggleBgm, resetGameBgm, syncPhase } =
    useGameBgm();
  const selectedIndexRef = useRef(0);
  const helpOpenRef = useRef(false);
  helpOpenRef.current = helpOpen;
  const logEndRef = useRef<HTMLDivElement>(null);
  const logWrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  selectedIndexRef.current = selectedIndex;

  useEffect(() => {
    syncPhase(game.phase === "cleared" ? "explore" : game.phase);
  }, [game.phase, syncPhase]);

  const actions = useMemo(() => buildActions(game, setGame), [game, setGame]);

  const menuResetKey = [
    game.phase,
    game.combatMenu,
    game.stairsVisible,
    game.exploreMenu,
    game.floor,
    game.player.inventory.map((i) => `${i.id}:${i.count}`).join(","),
    game.player.knownSpells.join(","),
  ].join("|");

  useEffect(() => {
    setSelectedIndex(0);
  }, [menuResetKey]);

  useEffect(() => {
    setSelectedIndex((i) => {
      if (actions.length === 0) return 0;
      return Math.min(i, actions.length - 1);
    });
  }, [actions.length]);

  const scrollLogToBottom = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollLogToBottom();
  }, [game.log, scrollLogToBottom]);

  useEffect(() => {
    if (!helpOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [helpOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (helpOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const list = buildActions(gameRef.current, setGame);
      const n = list.length;
      if (n === 0) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % n);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + n) % n);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const fresh = buildActions(gameRef.current, setGame);
        if (fresh.length === 0) return;
        const idx = Math.min(selectedIndexRef.current, fresh.length - 1);
        const act = fresh[idx];
        if (act && !act.disabled) act.onActivate();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const p = game.player;
  const inCombat = game.phase === "combat" && game.enemy;

  const compactExploreOrCombatMain =
    (game.phase === "explore" && game.exploreMenu === "main") ||
    (game.phase === "combat" && game.combatMenu === "main");

  const btnCore =
    "touch-manipulation select-none rounded border px-2 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-3";

  /** メイン・サブ共通：高さを揃えて誤タップを減らす */
  const btnClassGrid = (selected: boolean) =>
    [
      btnCore,
      "min-h-[48px] w-full",
      "border-[var(--border)] bg-[var(--panel)] text-[var(--text)]",
      "hover:border-[var(--accent)] hover:bg-[#24303d]",
      selected
        ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]"
        : "",
    ].join(" ");

  /** アイテム列が多いとき用（メニュー内スクロール） */
  const itemListScrollClass =
    "touch-scroll-y max-h-[min(42vh,15rem)] overflow-y-auto overscroll-y-contain pr-0.5";

  /** サブメニューもメインと同じ最小高さ */
  const btnClass = (selected: boolean) => btnClassGrid(selected);

  const renderExploreButtons = () => {
    if (game.exploreMenu === "items") {
      const itemKeys = new Set([
        "craft-hp",
        "craft-mp",
        "craft-hp-med",
        "craft-mp-med",
      ]);
      const mainEntries = actions.filter(
        (a) =>
          itemKeys.has(a.key) ||
          a.key.startsWith("explore-use-") ||
          a.key === "discard-weapons",
      );
      const back = actions.find((a) => a.key === "back-items");
      const indexOf = (key: string) => actions.findIndex((a) => a.key === key);
      const renderBtn = (a: ActionEntry, i: number) => (
        <button
          key={a.key}
          type="button"
          className={btnClass(i === selectedIndex)}
          disabled={a.disabled}
          title={a.title}
          aria-current={i === selectedIndex ? "true" : undefined}
          onClick={() => {
            setSelectedIndex(i);
            if (!a.disabled) a.onActivate();
          }}
        >
          {a.label}
        </button>
      );
      return (
        <div className="space-y-2" role="group" aria-label="調合と所持品">
          <p className="text-xs text-[var(--muted)]">
            調合と所持品の使用（装備・消費）
          </p>
          <div className={`grid grid-cols-2 gap-2 ${itemListScrollClass}`}>
            {mainEntries.map((a) => renderBtn(a, indexOf(a.key)))}
          </div>
          {back && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="col-span-2">
                {renderBtn(back, indexOf(back.key))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (game.exploreMenu === "magic") {
      const spells = actions.filter((a) => a.key.startsWith("explore-magic-"));
      const back = actions.find((a) => a.key === "back-explore-magic");
      const indexOf = (key: string) => actions.findIndex((a) => a.key === key);
      const renderBtn = (a: ActionEntry, i: number) => (
        <button
          key={a.key}
          type="button"
          className={btnClass(i === selectedIndex)}
          disabled={a.disabled}
          title={a.title}
          aria-current={i === selectedIndex ? "true" : undefined}
          onClick={() => {
            setSelectedIndex(i);
            if (!a.disabled) a.onActivate();
          }}
        >
          {a.label}
        </button>
      );
      return (
        <div className="space-y-2" role="group" aria-label="回復魔法">
          <p className="text-xs text-[var(--muted)]">探索中の回復魔法</p>
          <div className="grid grid-cols-2 gap-2">
            {spells.map((a) => renderBtn(a, indexOf(a.key)))}
          </div>
          {back && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="col-span-2">
                {renderBtn(back, indexOf(back.key))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (game.exploreMenu === "main") {
      const exploreA = actions.find((a) => a.key === "explore");
      const itemsA = actions.find((a) => a.key === "items-open");
      const magicA = actions.find((a) => a.key === "explore-magic-open");
      const descendA = actions.find((a) => a.key === "descend");
      if (!exploreA || !itemsA || !magicA || !descendA) return null;

      const row: ActionEntry[] = [exploreA, itemsA, magicA, descendA];

      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-2" role="group" aria-label="行動">
          {row.map((a) => {
            const i = actions.indexOf(a);
            return (
              <button
                key={a.key}
                type="button"
                className={btnClassGrid(selectedIndex === i)}
                disabled={a.disabled}
                title={a.title}
                aria-current={selectedIndex === i ? "true" : undefined}
                onClick={() => {
                  setSelectedIndex(i);
                  if (!a.disabled) a.onActivate();
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      );
    }

    return null;
  };

  const renderButtons = () => {
    if (game.phase === "explore") {
      return renderExploreButtons();
    }

    if (!inCombat) return null;

    if (game.combatMenu === "main") {
      return (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="戦闘コマンド">
          {actions.map((a, i) => (
            <button
              key={a.key}
              type="button"
              className={btnClassGrid(i === selectedIndex)}
              disabled={a.disabled}
              aria-current={i === selectedIndex ? "true" : undefined}
              onClick={() => {
                setSelectedIndex(i);
                if (!a.disabled) a.onActivate();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      );
    }

    if (game.combatMenu === "magic") {
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 grid grid-cols-2 gap-2" role="group" aria-label="魔法">
            {actions.slice(0, -1).map((a, i) => (
              <button
                key={a.key}
                type="button"
                className={btnClassGrid(i === selectedIndex)}
                disabled={a.disabled}
                title={SPELLS[a.key.slice(6) as SpellId]?.description}
                aria-current={i === selectedIndex ? "true" : undefined}
                onClick={() => {
                  setSelectedIndex(i);
                  if (!a.disabled) a.onActivate();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
          {actions.length > 0 && (
            <button
              type="button"
              className={`col-span-2 ${btnClassGrid(selectedIndex === actions.length - 1)}`}
              aria-current={
                selectedIndex === actions.length - 1 ? "true" : undefined
              }
              onClick={() => {
                const backIdx = actions.length - 1;
                setSelectedIndex(backIdx);
                actions[backIdx]?.onActivate();
              }}
            >
              {actions[actions.length - 1]!.label}
            </button>
          )}
        </div>
      );
    }

    if (game.combatMenu === "item") {
      return (
        <div className="grid grid-cols-2 gap-2">
          <div
            className={`col-span-2 grid grid-cols-2 gap-2 ${itemListScrollClass}`}
            role="group"
            aria-label="道具"
          >
            {actions.slice(0, -1).map((a, i) => (
              <button
                key={a.key}
                type="button"
                className={btnClassGrid(i === selectedIndex)}
                disabled={a.disabled}
                title={a.title}
                aria-current={i === selectedIndex ? "true" : undefined}
                onClick={() => {
                  setSelectedIndex(i);
                  if (!a.disabled) a.onActivate();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
          {actions.length > 0 && (
            <button
              type="button"
              className={`col-span-2 ${btnClassGrid(selectedIndex === actions.length - 1)}`}
              aria-current={
                selectedIndex === actions.length - 1 ? "true" : undefined
              }
              onClick={() => {
                const backIdx = actions.length - 1;
                setSelectedIndex(backIdx);
                actions[backIdx]?.onActivate();
              }}
            >
              {actions[actions.length - 1]!.label}
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  if (game.phase === "cleared") {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-6 px-4 py-10 text-center">
        <div>
          <p className="text-lg font-semibold text-[var(--text)]">
            おめでとうございます
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            あなたはダンジョンを制覇した。
          </p>
          <p className="mt-5 text-sm text-[var(--text)]">
            この周回の交戦回数：
            <span className="font-medium text-[var(--accent)]">
              {game.totalBattlesFought}
            </span>
          </p>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-left text-sm text-[var(--text)]">
          <p className="mb-2 text-xs text-[var(--muted)]">
            クリア報酬（ゲーム内で使われた BGM データ）
          </p>
          <a
            href={CLEAR_BGM_DRIVE}
            className="break-all text-[var(--accent)] underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google ドライブで開き、ダウンロードして再生できます
          </a>
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          作者へのフィードバックもお待ちしています →{" "}
          <a
            href="https://x.com/tabisurushosai"
            className="text-[var(--text)] underline decoration-[var(--border)] underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            @tabisurushosai（X）
          </a>
        </p>
        <button
          type="button"
          onClick={() =>
            setGame((g) => (g.phase === "cleared" ? { ...g, phase: "explore" } : g))
          }
          className="touch-manipulation mx-auto rounded border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[#24303d]"
        >
          底を歩き続ける
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-lg flex-col px-3 py-3">
      {helpOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-3 sm:items-center"
          role="presentation"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="touch-scroll-y max-h-[min(88dvh,32rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 text-left text-sm text-[var(--text)] shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="help-title"
              className="mb-3 text-base font-semibold text-[var(--text)]"
            >
              メモ（用語・操作）
            </h2>
            <div className="space-y-4 text-[var(--text)] leading-relaxed">
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  体験の目安
                </h3>
                <p className="text-sm">
                  テキスト中心の短編ダンジョンです。1周の目安はおよそ
                  {RUN_TARGET_MINUTES}
                  分前後を想定して調整しています（進め方で前後します）。
                </p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  推奨環境
                </h3>
                <p className="text-sm">
                  本番に近い体験は PC
                  のブラウザ向けです。スマホではホーム画面に追加してスタンドアロン表示すると、操作と
                  BGM が安定しやすいです。LINE
                  内のブラウザは友達への共有用で、将来は主な対象外にする予定です。
                </p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  世界観の軸
                </h3>
                <p className="text-sm">
                  階を下りて生計を立てる人々は「降り手」と呼ばれ、盟約・記録院・燈台・通行といった社会の痕跡が探索ログに現れます。アップデートで同じ語が再び出ると、意味が重なっていきます。
                </p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  操作
                </h3>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  <li>キーボード：矢印で選択、Enter か Space で決定</li>
                  <li>スマホ：ボタンをタップ（選択と実行が同時になります）</li>
                  <li>
                    探索の行動は常に 2×2 の 4
                    つ（探索／調合アイテム／魔法／階段）。武器の一括捨ては「調合アイテム」内です。
                  </li>
                </ul>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  魔法
                </h3>
                <p className="text-sm">
                  炎・氷・雷は攻撃、回復は HP
                  回復です。炎は火力寄り、氷はダメージと「動けなくする」効果のバランス、雷はダメージ控えめで拘束が出やすい、というイメージです。氷と雷の拘束は中身は同じ（相手が動けないターン）です。
                </p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  弱点
                </h3>
                <p className="text-sm">
                  一部の敵は炎・氷・雷のどれかに弱く、該当魔法で追加ダメージが入ります。ログに「弱点を突いた」と出ます。
                  層底の主にも、たまに弱点があることがあります。
                </p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  層底の主（ボス）
                </h3>
                <p className="text-sm">
                  HP が減るとログに節目の一文が入ります。体力がさらに減ると攻撃が重くなるので、回復や MP
                  の配分を読みながら戦うと学習しやすいです。
                </p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  武器の括弧
                </h3>
                <p className="text-sm">
                  装備・所持に表示される短い説明（括弧内）は、吸命・心眼・貫通・連閃などの効き方の目安です。長押しやホバーで全文を確認できます。
                </p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  倒れたとき
                </h3>
                <p className="text-sm">
                  HP が 0 になると入り口に戻ります。ログは続きます。戦闘で倒れた直後には【手がかり】が一行付くことがあり、次の立ち回りのヒントになります。
                </p>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  BGM
                </h3>
                <p className="text-sm">
                  「BGM」で再生のオンオフ、「BGMリセット」でプレイヤーを作り直します。タブ復帰や数秒ごとのチェックで、ON
                  のとき無音になっていれば自動で再開を試みます。直らないときだけリセットを試してください。
                </p>
              </section>
            </div>
            <button
              type="button"
              className="touch-manipulation mt-5 w-full min-h-[48px] rounded border border-[var(--border)] bg-[#24303d] px-3 py-2 text-sm font-medium text-[var(--text)] hover:border-[var(--accent)]"
              onClick={() => setHelpOpen(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}
      <header className="mb-2 shrink-0 border-b border-[var(--border)] pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight text-[var(--text)]">
              層底譚
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="touch-manipulation min-h-[36px] min-w-[36px] select-none rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[#24303d]"
              aria-label="用語と操作のメモを開く"
            >
              ？
            </button>
            <button
              type="button"
              onClick={() => void toggleBgm()}
              disabled={bgmMissing}
              className="touch-manipulation min-h-[36px] select-none rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[#24303d] disabled:cursor-not-allowed disabled:opacity-40"
              title={
                bgmMissing
                  ? "public/bgm に explore.mp3・combat.mp3、または theme.mp3 を置いてください"
                  : "探索は explore.mp3、戦闘は combat.mp3（片方だけのときはもう片方にフォールバック。theme で代用可）。タイトルは title.mp3"
              }
            >
              {bgmMissing ? "BGM未設定" : bgmPlaying ? "BGM停止" : "BGM"}
            </button>
            <button
              type="button"
              onClick={() => resetGameBgm()}
              disabled={bgmMissing}
              className="touch-manipulation min-h-[36px] select-none rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[#24303d] disabled:cursor-not-allowed disabled:opacity-40"
              title="探索と戦闘の音源プレイヤーを作り直します。片方だけ鳴らないときに試してください。"
            >
              BGMリセット
            </button>
          </div>
        </div>
      </header>

      <section
        ref={logWrapRef}
        className="touch-scroll-y min-h-0 max-sm:min-h-[min(46dvh,22rem)] flex-1 overflow-y-auto rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
        aria-label="探索・戦闘ログ"
      >
        <ul className="space-y-1.5 text-sm leading-relaxed text-[var(--text)]">
          {game.log.map((line, i) => (
            <li key={i} className="text-[var(--text)]">
              {line}
            </li>
          ))}
        </ul>
        <div ref={logEndRef} />
      </section>

      <nav
        className="mt-3 shrink-0 space-y-2"
        aria-label="操作"
      >
        <p className="h-4 shrink-0 text-xs leading-4 text-[var(--muted)]">
          行動
        </p>
        <div
          className={
            compactExploreOrCombatMain
              ? "h-[104px] shrink-0 overflow-hidden"
              : "touch-scroll-y max-h-[min(50dvh,20rem)] min-h-[104px] shrink-0 overflow-y-auto overscroll-y-contain"
          }
        >
          {renderButtons()}
        </div>
      </nav>

      <section
        className="mt-3 shrink-0 rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
        aria-label="ステータス"
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--text)]">
          <span className="text-[var(--muted)]">階</span>
          <span>
            {game.floor} 階
            {game.floor === 10 && game.bossDefeated ? "（底を踏んだ）" : ""}
          </span>
          <span className="text-[var(--muted)]">HP</span>
          <span>
            {p.hp} / {p.maxHp}
          </span>
          <span className="text-[var(--muted)]">MP</span>
          <span>
            {p.mp} / {p.maxMp}
          </span>
          <span className="text-[var(--muted)]">Lv</span>
          <span>{p.level}</span>
          <span className="text-[var(--muted)]">経験値</span>
          <span>
            {p.exp}{" "}
            <span className="text-[var(--muted)]">
              （あと {expUntilLevelUp(p)} で Lv{p.level + 1}）
            </span>
          </span>
        </div>
        <div className="mt-2 border-t border-[var(--border)] pt-2 text-[var(--text)]">
          <p className="text-xs text-[var(--muted)]">装備</p>
          <p>
            {p.weapon ? formatWeaponEquipLine(p.weapon) : "素手"}
          </p>
        </div>
        <div className="mt-2 text-[var(--text)]">
          <p className="text-xs text-[var(--muted)]">習得魔法</p>
          <p className="text-sm">
            {p.knownSpells.length === 0
              ? "なし"
              : p.knownSpells.map((s) => SPELLS[s].label).join("、")}
          </p>
        </div>
        <div className="mt-2 text-[var(--text)]">
          <p className="text-xs text-[var(--muted)]">所持</p>
          {p.inventory.length === 0 ? (
            <p className="text-sm">なし</p>
          ) : (
            <ul
              className={`mt-1 list-none space-y-0.5 text-sm leading-snug ${itemListScrollClass}`}
            >
              {p.inventory.map((it) => (
                <li key={it.id}>{formatStack(it.name, it.count)}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="mt-3 shrink-0 space-y-2 pb-[env(safe-area-inset-bottom)] text-center">
        <a
          href="https://x.com/tabisurushosai"
          className="text-xs text-[var(--muted)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--text)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          @tabisurushosai
        </a>
        <p
          className="text-[11px] leading-relaxed text-[var(--muted)] opacity-90"
          aria-label="交戦回数（この周回の通算）"
        >
          交戦回数 {game.totalBattlesFought}
        </p>
      </footer>
    </div>
  );
}
