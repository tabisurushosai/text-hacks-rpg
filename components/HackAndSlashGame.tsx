"use client";

import { buildGameActions, type ActionEntry } from "@/components/buildGameActions";
import { CombatHud } from "@/components/CombatHud";
import { useGameBgm } from "@/components/GameBgmContext";
import { JOB_META, JOB_ORDER, RUN_TARGET_MINUTES } from "@/lib/game/balance";
import { expUntilLevelUp, initialGameState } from "@/lib/game/core";
import {
  formatArmorEquipLine,
  formatWeaponEquipLine,
  SPELLS,
} from "@/lib/game/data";
import { logLinePrefix, logLineTone, logToneClass } from "@/lib/game/logLineTone";
import {
  persistMetaAfterBossClear,
  persistMetaAfterDeath,
  persistMetaRunStarted,
  saveGameToLocalStorage,
} from "@/lib/game/persistence";
import type { GameState, JobId, SpellId } from "@/lib/game/types";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** クリア報酬（本作 BGM） */
const CLEAR_BGM_DRIVE =
  "https://drive.google.com/drive/folders/1Tp3UyQZCMxpGfHYfC-gFw93FsOJm3I_V?usp=sharing";

export function HackAndSlashGame({
  job,
  initialSnapshot = null,
  onRequestTitle,
}: {
  job: JobId;
  initialSnapshot?: GameState | null;
  onRequestTitle?: () => void;
}) {
  const [game, setGame] = useState<GameState>(
    () => initialSnapshot ?? initialGameState(job),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [liveLogAnnouncement, setLiveLogAnnouncement] = useState("");
  const { bgmPlaying, bgmMissing, toggleBgm, resetGameBgm, syncPhase } =
    useGameBgm();
  const selectedIndexRef = useRef(0);
  const helpOpenRef = useRef(false);
  helpOpenRef.current = helpOpen;
  const logEndRef = useRef<HTMLDivElement>(null);
  const logWrapRef = useRef<HTMLDivElement>(null);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const helpHeadingRef = useRef<HTMLHeadingElement>(null);
  const prevLogLenRef = useRef(-1);
  const gameRef = useRef(game);
  gameRef.current = game;
  selectedIndexRef.current = selectedIndex;

  const metaHandledRef = useRef<Set<string>>(new Set());
  const runStartedRecordedRef = useRef(false);

  useEffect(() => {
    if (initialSnapshot || runStartedRecordedRef.current) return;
    runStartedRecordedRef.current = true;
    persistMetaRunStarted();
  }, [initialSnapshot]);

  useEffect(() => {
    const ev = game.pendingClientEvent;
    if (!ev) return;
    const token =
      ev.type === "death"
        ? `death:${ev.diedAtFloor}:${game.log.length}`
        : `boss:${game.floor}:${game.log.length}`;
    if (metaHandledRef.current.has(token)) {
      setGame((g) =>
        g.pendingClientEvent ? { ...g, pendingClientEvent: null } : g,
      );
      return;
    }
    metaHandledRef.current.add(token);
    if (ev.type === "death") persistMetaAfterDeath(ev.diedAtFloor);
    else persistMetaAfterBossClear(game.floor);
    setGame((g) => ({ ...g, pendingClientEvent: null }));
  }, [game.pendingClientEvent, game.floor, game.log.length]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveGameToLocalStorage(gameRef.current);
    }, 450);
    return () => window.clearTimeout(t);
  }, [game]);

  useEffect(() => {
    syncPhase(game.phase === "cleared" ? "explore" : game.phase);
  }, [game.phase, syncPhase]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (prevLogLenRef.current < 0) {
      prevLogLenRef.current = game.log.length;
      return;
    }
    if (game.log.length > prevLogLenRef.current) {
      const line = game.log[game.log.length - 1] ?? "";
      const tone = logLineTone(line);
      setLiveLogAnnouncement(`${logLinePrefix(tone)}${line}`);
    }
    prevLogLenRef.current = game.log.length;
  }, [game.log]);

  useEffect(() => {
    if (!helpOpen) return;
    const back = helpBtnRef.current;
    queueMicrotask(() => {
      helpHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => {
      back?.focus({ preventScroll: true });
    };
  }, [helpOpen]);

  const actions = useMemo(() => buildGameActions(game, setGame), [game, setGame]);

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
    logEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [reduceMotion]);

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

      const list = buildGameActions(gameRef.current, setGame);
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
        const fresh = buildGameActions(gameRef.current, setGame);
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

  const compactExploreMain =
    game.phase === "explore" && game.exploreMenu === "main";
  const compactCombatMain =
    game.phase === "combat" && game.combatMenu === "main";

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
      const fightA = actions.find((a) => a.key === "fight");
      const abilA = actions.find((a) => a.key === "abilities-open");
      const itemA = actions.find((a) => a.key === "item-open");
      const runA = actions.find((a) => a.key === "run");
      if (!fightA || !abilA || !itemA || !runA) return null;

      const row: ActionEntry[] = [fightA, abilA, itemA, runA];

      return (
        <div
          className="grid grid-cols-2 grid-rows-2 gap-2"
          role="group"
          aria-label="戦闘コマンド"
        >
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

    if (game.combatMenu === "abilities") {
      const subLabel = "スキル・魔法";
      return (
        <div className="grid grid-cols-2 gap-2">
          <div
            className="col-span-2 grid grid-cols-2 gap-2"
            role="group"
            aria-label={subLabel}
          >
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
              ref={helpHeadingRef}
              id="help-title"
              tabIndex={-1}
              className="mb-3 text-base font-semibold text-[var(--text)] outline-none ring-[var(--accent)] focus-visible:ring-2"
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
                  職業
                </h3>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {JOB_ORDER.map((id) => (
                    <li key={id}>
                      <span className="font-medium text-[var(--text)]">
                        {JOB_META[id].label}
                      </span>
                      <span className="text-[var(--muted)]">
                        （{JOB_META[id].tag}）
                      </span>
                      … {JOB_META[id].helpLine}
                    </li>
                  ))}
                </ul>
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
                    つ（探索／調合アイテム／魔法／階段）。武器・防具の一括捨ては「調合アイテム」内です。
                  </li>
                  <li>
                    戦闘のメインは 2×2 の 4
                    つ（戦う／スキル・魔法／道具／逃げる）。「スキル・魔法」で職スキルと綴りの魔法をまとめて選びます。
                  </li>
                  <li>
                    進行は端末の localStorage に自動保存されます。「続きから」で再開、「新しく冒険する」でセーブは消えます。右上「タイトルへ」で保存のまま戻れます。
                  </li>
                  <li>
                    ログは行頭の［傷］［癒］などの印と、種類に応じた色で分かりやすくしています。読み上げでは新しい行が通知されます。戦闘中はログの上に敵と自分の HP/MP バーが出ます。OS
                    の「動きを減らす」を有効にすると、ログの自動スクロールやタイトルの背景動きを控えめにします。
                  </li>
                </ul>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  魔法
                </h3>
                <p className="text-sm">
                  炎・氷・雷は攻撃、回復は HP
                  回復です。各職には冒険開始時から2つの職スキルがあり、綴りでは覚えません。綴りは1〜5階で基本形（火矢・氷片・細雷・癒し）のみ、6階以降から上位（業火・凍嵐・落雷・大癒）が混ざります。探索で唱えられるのは癒し・大癒に加え、応急措置・精神統一・仮眠など職によって異なります。戦闘では「スキル・魔法」に職スキルを先に、続けて【攻撃魔法】【回復魔法】の順で並びます。
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
                  武器・防具の括弧
                </h3>
                <p className="text-sm">
                  装備・所持に表示される短い説明（括弧内）は、武器なら吸命・心眼・貫通・連閃、防具なら棘甲・結界・堅壳・滴血などの効き方の目安です。防御は敵の物理攻撃を軽減し、探索での転倒ダメージも少し抑えます。長押しやホバーで全文を確認できます。
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
                  戦闘に勝ったあと
                </h3>
                <p className="text-sm">
                  ログの末尾付近に「戦闘後: HP … MP …」と、数値だけを一行記録します（装備・ドロップの処理のあと）。
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
              ref={helpBtnRef}
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
            {onRequestTitle ? (
              <button
                type="button"
                onClick={() => {
                  saveGameToLocalStorage(gameRef.current);
                  onRequestTitle();
                }}
                className="touch-manipulation min-h-[36px] select-none rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-[#24303d] hover:text-[var(--text)]"
                title="いまの状態を端末に保存してタイトルへ戻ります（続きからで再開）"
              >
                タイトルへ
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {inCombat && game.enemy ? (
        <CombatHud enemy={game.enemy} player={p} />
      ) : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveLogAnnouncement}
      </div>

      <section
        ref={logWrapRef}
        className="touch-scroll-y min-h-0 max-sm:min-h-[min(46dvh,22rem)] flex-1 overflow-y-auto rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
        aria-label="探索・戦闘ログ"
      >
        <ul className="space-y-1.5 text-sm leading-relaxed">
          {game.log.map((line, i) => {
            const tone = logLineTone(line);
            const prefix = logLinePrefix(tone);
            return (
              <li key={i} className={logToneClass(tone)}>
                {prefix ? (
                  <span className="text-[var(--muted)]">{prefix}</span>
                ) : null}
                {line}
              </li>
            );
          })}
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
            compactExploreMain
              ? "h-[104px] shrink-0 overflow-hidden"
              : compactCombatMain
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
          <span className="text-[var(--muted)]">職業</span>
          <span>
            {JOB_META[game.job].label}
            <span className="text-[var(--muted)]">
              （{JOB_META[game.job].tag}）
            </span>
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
          <p className="mt-1">
            {p.armor ? formatArmorEquipLine(p.armor) : "防具なし"}
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
