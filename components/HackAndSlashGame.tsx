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
  ITEM_HERB,
  ITEM_MANA_HERB,
  ITEM_MANA_POTION_MINOR,
  ITEM_POTION_MINOR,
  SPELLS,
} from "@/lib/game/data";
import {
  closeCraftMenu,
  closeUseItemMenu,
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
  explore,
  initialGameState,
  inventoryActionLabel,
  openCraftMenu,
  openUseItemMenu,
  useItemExplore,
} from "@/lib/game/core";
import { BGM_DEFAULT_VOLUME, BGM_PATHS } from "@/lib/bgm";
import type { GameState, SpellId } from "@/lib/game/types";

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

  if (game.phase === "explore") {
    if (game.exploreMenu === "craft") {
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
        title:
          it.kind === "weapon" ? `攻撃補正 +${it.power}` : undefined,
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
          key: "back-craft",
          label: "戻る",
          onActivate: () => setGame((g) => closeCraftMenu(g)),
        },
      ];
    }

    if (game.exploreMenu === "use") {
      const useEntries: ActionEntry[] = p.inventory.map((it) => ({
        key: `explore-use-${it.id}`,
        label: inventoryActionLabel(it),
        title:
          it.kind === "weapon" ? `攻撃補正 +${it.power}` : undefined,
        onActivate: () =>
          setGame((g) => {
            const idx = g.player.inventory.findIndex((x) => x.id === it.id);
            return useItemExplore(g, idx >= 0 ? idx : 0);
          }),
      }));
      return [
        ...useEntries,
        {
          key: "back-use",
          label: "戻る",
          onActivate: () => setGame((g) => closeUseItemMenu(g)),
        },
      ];
    }

    const main: ActionEntry[] = [
      {
        key: "explore",
        label: "探索する",
        onActivate: () => setGame((g) => explore(g)),
      },
      {
        key: "craft-open",
        label: "クラフト",
        onActivate: () => setGame((g) => openCraftMenu(g)),
      },
      {
        key: "open-use",
        label: "アイテムを使う",
        disabled: p.inventory.length === 0,
        onActivate: () => setGame((g) => openUseItemMenu(g)),
      },
    ];
    if (game.stairsVisible && game.floor < 10) {
      main.push({
        key: "descend",
        label: "階段を降りる",
        onActivate: () => setGame((g) => descendStairs(g)),
      });
    }
    return main;
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
      title:
        it.kind === "weapon" ? `攻撃補正 +${it.power}` : undefined,
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

function createLoopingBgm(): HTMLAudioElement {
  const a = new Audio();
  a.loop = true;
  a.volume = BGM_DEFAULT_VOLUME;
  return a;
}

/** 探索／戦闘で別トラック。片方だけ死んでいればもう片方にフォールバック */
function pickBgmForPhase(
  phase: GameState["phase"],
  exploreDead: boolean,
  combatDead: boolean,
  explore: HTMLAudioElement,
  combat: HTMLAudioElement,
): HTMLAudioElement | null {
  if (phase === "combat") {
    if (!combatDead) return combat;
    if (!exploreDead) return explore;
    return null;
  }
  if (!exploreDead) return explore;
  if (!combatDead) return combat;
  return null;
}

export function HackAndSlashGame() {
  const [game, setGame] = useState<GameState>(() => initialGameState());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [exploreBgmDead, setExploreBgmDead] = useState(false);
  const [combatBgmDead, setCombatBgmDead] = useState(false);
  const selectedIndexRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logWrapRef = useRef<HTMLDivElement>(null);
  const exploreBgmRef = useRef<HTMLAudioElement | null>(null);
  const combatBgmRef = useRef<HTMLAudioElement | null>(null);
  const bgmPlayingRef = useRef(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  selectedIndexRef.current = selectedIndex;
  bgmPlayingRef.current = bgmPlaying;

  const bgmMissing = exploreBgmDead && combatBgmDead;

  useEffect(() => {
    const explore = createLoopingBgm();
    const combat = createLoopingBgm();
    exploreBgmRef.current = explore;
    combatBgmRef.current = combat;

    function wire(
      audio: HTMLAudioElement,
      primary: string,
      onFinalFail: () => void,
    ) {
      let step = 0;
      audio.src = primary;
      const onError = () => {
        if (step === 0) {
          step = 1;
          audio.src = BGM_PATHS.theme;
          audio.load();
        } else {
          onFinalFail();
        }
      };
      audio.addEventListener("error", onError);
      return () => audio.removeEventListener("error", onError);
    }

    const unsubs = [
      wire(explore, BGM_PATHS.explore, () => setExploreBgmDead(true)),
      wire(combat, BGM_PATHS.combat, () => setCombatBgmDead(true)),
    ];

    return () => {
      for (const u of unsubs) u();
      explore.pause();
      combat.pause();
      exploreBgmRef.current = null;
      combatBgmRef.current = null;
    };
  }, []);

  const toggleBgm = useCallback(async () => {
    const explore = exploreBgmRef.current;
    const combat = combatBgmRef.current;
    if (!explore || !combat || bgmMissing) return;
    if (bgmPlaying) {
      explore.pause();
      combat.pause();
      setBgmPlaying(false);
      return;
    }
    const active = pickBgmForPhase(
      game.phase,
      exploreBgmDead,
      combatBgmDead,
      explore,
      combat,
    );
    if (!active) return;
    explore.pause();
    combat.pause();
    active.currentTime = 0;
    try {
      await active.play();
      setBgmPlaying(true);
    } catch {
      setBgmPlaying(false);
    }
  }, [
    bgmMissing,
    bgmPlaying,
    combatBgmDead,
    exploreBgmDead,
    game.phase,
  ]);

  /** 戦闘↔探索でトラック切替（再生中のみ。ON にした直後の再生は toggle 内で行う） */
  useEffect(() => {
    if (!bgmPlayingRef.current) return;
    const explore = exploreBgmRef.current;
    const combat = combatBgmRef.current;
    if (!explore || !combat) return;
    const active = pickBgmForPhase(
      game.phase,
      exploreBgmDead,
      combatBgmDead,
      explore,
      combat,
    );
    explore.pause();
    combat.pause();
    if (!active) {
      setBgmPlaying(false);
      return;
    }
    active.currentTime = 0;
    void active.play().catch(() => setBgmPlaying(false));
  }, [game.phase, exploreBgmDead, combatBgmDead]);

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
    const onKeyDown = (e: KeyboardEvent) => {
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

  const btnCore =
    "touch-manipulation rounded border px-2 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-3";

  /** スマホで親指位置をそろえるメイン用（セルいっぱい・高さ確保） */
  const btnClassGrid = (selected: boolean) =>
    [
      btnCore,
      "min-h-[48px] w-full sm:min-h-0",
      "border-[var(--border)] bg-[var(--panel)] text-[var(--text)]",
      "hover:border-[var(--accent)] hover:bg-[#24303d]",
      selected
        ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]"
        : "",
    ].join(" ");

  /** クラフト・魔法・道具など可変行 */
  const btnClass = (selected: boolean) =>
    [
      btnCore,
      "min-h-[44px] sm:min-h-0",
      "border-[var(--border)] bg-[var(--panel)] text-[var(--text)]",
      "hover:border-[var(--accent)] hover:bg-[#24303d]",
      selected
        ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]"
        : "",
    ].join(" ");

  const renderExploreButtons = () => {
    if (game.exploreMenu === "craft") {
      const craftFromHerbKeys = new Set(["craft-hp", "craft-mp"]);
      const craftTierKeys = new Set(["craft-hp-med", "craft-mp-med"]);
      const craftsHerb = actions.filter((a) => craftFromHerbKeys.has(a.key));
      const craftsTier = actions.filter((a) => craftTierKeys.has(a.key));
      const uses = actions.filter(
        (a) => a.key.startsWith("explore-use-"),
      );
      const back = actions.find((a) => a.key === "back-craft");
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
        <div className="space-y-2" role="group" aria-label="クラフトと所持品">
          <div>
            <p className="mb-1 text-xs text-[var(--muted)]">クラフト（草から）</p>
            <div className="flex flex-wrap gap-2">
              {craftsHerb.map((a) => renderBtn(a, indexOf(a.key)))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-[var(--muted)]">
              精製（初級ポーション×{CRAFT_COST}→中級）
            </p>
            <div className="flex flex-wrap gap-2">
              {craftsTier.map((a) => renderBtn(a, indexOf(a.key)))}
            </div>
          </div>
          {uses.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-[var(--muted)]">所持品を使う</p>
              <div className="flex flex-wrap gap-2">
                {uses.map((a) => renderBtn(a, indexOf(a.key)))}
              </div>
            </div>
          )}
          {back && (
            <div className="pt-1">
              {renderBtn(back, indexOf(back.key))}
            </div>
          )}
        </div>
      );
    }

    if (game.exploreMenu === "use") {
      const uses = actions.filter((a) => a.key.startsWith("explore-use-"));
      const back = actions.find((a) => a.key === "back-use");
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
        <div className="space-y-2" role="group" aria-label="アイテム">
          {uses.length > 0 ? (
            <div>
              <p className="mb-1 text-xs text-[var(--muted)]">使う</p>
              <div className="flex flex-wrap gap-2">
                {uses.map((a) => renderBtn(a, indexOf(a.key)))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">所持品がない。</p>
          )}
          {back && (
            <div className="pt-1">
              {renderBtn(back, indexOf(back.key))}
            </div>
          )}
        </div>
      );
    }

    if (game.exploreMenu === "main") {
      const exploreA = actions.find((a) => a.key === "explore");
      const craftA = actions.find((a) => a.key === "craft-open");
      const useA = actions.find((a) => a.key === "open-use");
      const descendA = actions.find((a) => a.key === "descend");
      if (!exploreA || !craftA || !useA) return null;

      const iExplore = actions.indexOf(exploreA);
      const iCraft = actions.indexOf(craftA);
      const iUse = actions.indexOf(useA);
      const iDescend = descendA ? actions.indexOf(descendA) : -1;

      return (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="行動">
          <button
            type="button"
            className={btnClassGrid(selectedIndex === iExplore)}
            disabled={exploreA.disabled}
            aria-current={selectedIndex === iExplore ? "true" : undefined}
            onClick={() => {
              setSelectedIndex(iExplore);
              if (!exploreA.disabled) exploreA.onActivate();
            }}
          >
            {exploreA.label}
          </button>
          <button
            type="button"
            className={btnClassGrid(selectedIndex === iCraft)}
            disabled={craftA.disabled}
            aria-current={selectedIndex === iCraft ? "true" : undefined}
            onClick={() => {
              setSelectedIndex(iCraft);
              if (!craftA.disabled) craftA.onActivate();
            }}
          >
            {craftA.label}
          </button>
          <button
            type="button"
            className={btnClassGrid(selectedIndex === iUse)}
            disabled={useA.disabled}
            title={useA.disabled ? "所持品がありません" : undefined}
            aria-current={selectedIndex === iUse ? "true" : undefined}
            onClick={() => {
              setSelectedIndex(iUse);
              if (!useA.disabled) useA.onActivate();
            }}
          >
            {useA.label}
          </button>
          {descendA && iDescend >= 0 ? (
            <button
              type="button"
              className={btnClassGrid(selectedIndex === iDescend)}
              disabled={descendA.disabled}
              aria-current={selectedIndex === iDescend ? "true" : undefined}
              onClick={() => {
                setSelectedIndex(iDescend);
                if (!descendA.disabled) descendA.onActivate();
              }}
            >
              {descendA.label}
            </button>
          ) : (
            <div
              className="min-h-[48px] sm:min-h-0"
              aria-hidden
            />
          )}
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
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="魔法">
            {actions.slice(0, -1).map((a, i) => (
              <button
                key={a.key}
                type="button"
                className={btnClass(i === selectedIndex)}
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
              className={btnClass(selectedIndex === actions.length - 1)}
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
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="道具">
            {actions.slice(0, -1).map((a, i) => (
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
            ))}
          </div>
          {actions.length > 0 && (
            <button
              type="button"
              className={btnClass(selectedIndex === actions.length - 1)}
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

  return (
    <div className="mx-auto flex h-[100dvh] max-w-lg flex-col px-3 py-3">
      <header className="mb-2 shrink-0 border-b border-[var(--border)] pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight text-[var(--text)]">
              テキストハクスラ
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void toggleBgm()}
            disabled={bgmMissing}
            className="touch-manipulation shrink-0 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[#24303d] disabled:cursor-not-allowed disabled:opacity-40"
            title={
              bgmMissing
                ? "public/bgm に explore.mp3・combat.mp3、または従来どおり theme.mp3 を置いてください"
                : "探索は explore.mp3、戦闘は combat.mp3（無い場合は theme.mp3）。自動再生は不可のためボタンで開始"
            }
          >
            {bgmMissing ? "BGM未設定" : bgmPlaying ? "BGM停止" : "BGM"}
          </button>
        </div>
      </header>

      <section
        ref={logWrapRef}
        className="min-h-0 max-sm:min-h-[min(46dvh,22rem)] flex-1 overflow-y-auto rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
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
        <p className="text-xs text-[var(--muted)]">行動</p>
        {/* 探索・戦闘の基本メニューは 2×2。サブメニュー時は可変 */}
        <div className="min-h-[7.25rem] content-start sm:min-h-0">
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
          <span>{p.exp}</span>
        </div>
        <div className="mt-2 border-t border-[var(--border)] pt-2 text-[var(--text)]">
          <p className="text-xs text-[var(--muted)]">装備</p>
          <p>{p.weapon ? `${p.weapon.fullName}（攻撃補正 +${p.weapon.atk}）` : "素手"}</p>
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
          <p className="text-sm">
            {p.inventory.length === 0
              ? "なし"
              : p.inventory.map((it) => formatStack(it.name, it.count)).join("、")}
          </p>
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
