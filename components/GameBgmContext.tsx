"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BGM_DEFAULT_VOLUME, BGM_PATHS } from "@/lib/bgm";
import type { GamePhase } from "@/lib/game/types";

function createLoopingBgm(options?: { preload?: HTMLMediaElement["preload"] }): HTMLAudioElement {
  const a = new Audio();
  a.loop = true;
  a.volume = BGM_DEFAULT_VOLUME;
  if (options?.preload) a.preload = options.preload;
  return a;
}

function pickBgmForPhase(
  phase: GamePhase,
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

/** 別トラックへ切り替える直前の pause で中断された play() の拒否 */
function isPlayInterruptedError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function wireExploreOrCombat(
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

function wireTitle(audio: HTMLAudioElement, onFinalFail: () => void) {
  let step = 0;
  audio.src = BGM_PATHS.title;
  const onError = () => {
    if (step === 0) {
      step = 1;
      audio.src = BGM_PATHS.theme;
      audio.load();
    } else if (step === 1) {
      step = 2;
      audio.src = BGM_PATHS.explore;
      audio.load();
    } else {
      onFinalFail();
    }
  };
  audio.addEventListener("error", onError);
  return () => audio.removeEventListener("error", onError);
}

type GameBgmContextValue = {
  bgmPlaying: boolean;
  bgmMissing: boolean;
  titleBgmDead: boolean;
  /** タイトル BGM を鳴らす設定（初期 true。OFF で停止） */
  titleBgmEnabled: boolean;
  setTitleBgmEnabled: (on: boolean) => void;
  /** タイトル表示中のみ。自動再生できず一定時間停止のとき true（LINE 内ブラウザ等） */
  showTitleBgmHelp: boolean;
  toggleBgm: () => Promise<void>;
  /** 探索／戦闘用 Audio を作り直し、ON なら今のフェーズの曲を再開 */
  resetGameBgm: () => void;
  syncPhase: (phase: GamePhase) => void;
  tryPlayTitleBgm: () => void;
  startBgmExplore: () => Promise<void>;
};

const GameBgmContext = createContext<GameBgmContextValue | null>(null);

export function useGameBgm(): GameBgmContextValue {
  const ctx = useContext(GameBgmContext);
  if (!ctx) {
    throw new Error("useGameBgm must be used within GameBgmProvider");
  }
  return ctx;
}

type GameBgmProviderProps = {
  children: ReactNode;
  /** タイトル画面が前面のとき true（未指定は常に false 扱い） */
  titleScreenActive?: boolean;
};

export function GameBgmProvider({
  children,
  titleScreenActive = false,
}: GameBgmProviderProps) {
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [exploreBgmDead, setExploreBgmDead] = useState(false);
  const [combatBgmDead, setCombatBgmDead] = useState(false);
  const [titleBgmDead, setTitleBgmDead] = useState(false);
  const [titleBgmEnabled, setTitleBgmEnabledState] = useState(true);
  const [showTitleBgmHelp, setShowTitleBgmHelp] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<GamePhase>("explore");

  const titleBgmRef = useRef<HTMLAudioElement | null>(null);
  const exploreBgmRef = useRef<HTMLAudioElement | null>(null);
  const combatBgmRef = useRef<HTMLAudioElement | null>(null);
  const gameBgmUnsubsRef = useRef<Array<() => void>>([]);
  const bgmPlayingRef = useRef(false);
  const gameBgmPlayIdRef = useRef(0);
  const currentPhaseRef = useRef<GamePhase>("explore");
  const exploreBgmDeadRef = useRef(false);
  const combatBgmDeadRef = useRef(false);
  const bgmMissingRef = useRef(false);
  const tryResumeRef = useRef<() => void>(() => {});
  const lastResumeAtRef = useRef(0);
  bgmPlayingRef.current = bgmPlaying;
  currentPhaseRef.current = currentPhase;
  exploreBgmDeadRef.current = exploreBgmDead;
  combatBgmDeadRef.current = combatBgmDead;

  const bgmMissing = exploreBgmDead && combatBgmDead;
  bgmMissingRef.current = bgmMissing;

  const disposeGameBgm = useCallback(() => {
    gameBgmPlayIdRef.current += 1;
    exploreBgmRef.current?.pause();
    combatBgmRef.current?.pause();
    for (const u of gameBgmUnsubsRef.current) u();
    gameBgmUnsubsRef.current = [];
    exploreBgmRef.current = null;
    combatBgmRef.current = null;
  }, []);

  const wireGameBgmPair = useCallback(() => {
    const explore = createLoopingBgm({ preload: "auto" });
    const combat = createLoopingBgm({ preload: "auto" });
    exploreBgmRef.current = explore;
    combatBgmRef.current = combat;
    gameBgmUnsubsRef.current.push(
      wireExploreOrCombat(explore, BGM_PATHS.explore, () =>
        setExploreBgmDead(true),
      ),
      wireExploreOrCombat(combat, BGM_PATHS.combat, () =>
        setCombatBgmDead(true),
      ),
    );
    explore.load();
    combat.load();

    const onGlitch = () => {
      queueMicrotask(() => tryResumeRef.current());
    };
    explore.addEventListener("stalled", onGlitch);
    combat.addEventListener("stalled", onGlitch);
  }, []);

  const ensureGameBgmWired = useCallback(() => {
    if (exploreBgmRef.current && combatBgmRef.current) return;
    wireGameBgmPair();
  }, [wireGameBgmPair]);

  const tryResumeGameBgm = useCallback(() => {
    if (!bgmPlayingRef.current || bgmMissingRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    ensureGameBgmWired();
    const explore = exploreBgmRef.current;
    const combat = combatBgmRef.current;
    if (!explore || !combat) return;
    titleBgmRef.current?.pause();
    const active = pickBgmForPhase(
      currentPhaseRef.current,
      exploreBgmDeadRef.current,
      combatBgmDeadRef.current,
      explore,
      combat,
    );
    if (!active) return;
    if (active !== explore) explore.pause();
    if (active !== combat) combat.pause();
    if (!active.paused) return;

    const now = Date.now();
    if (now - lastResumeAtRef.current < 450) return;
    lastResumeAtRef.current = now;
    void active.play().catch(() => {});
  }, [ensureGameBgmWired]);

  useEffect(() => {
    tryResumeRef.current = tryResumeGameBgm;
  }, [tryResumeGameBgm]);

  useEffect(() => {
    const title = createLoopingBgm({ preload: "auto" });
    titleBgmRef.current = title;
    const unsubTitle = wireTitle(title, () => setTitleBgmDead(true));
    title.load();

    return () => {
      unsubTitle();
      title.pause();
      titleBgmRef.current = null;
      for (const u of gameBgmUnsubsRef.current) u();
      gameBgmUnsubsRef.current = [];
      exploreBgmRef.current?.pause();
      combatBgmRef.current?.pause();
      exploreBgmRef.current = null;
      combatBgmRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!titleScreenActive || !titleBgmEnabled) {
      setShowTitleBgmHelp(false);
      return;
    }
    const title = titleBgmRef.current;
    if (!title || titleBgmDead) {
      setShowTitleBgmHelp(false);
      return;
    }

    const onPlaying = () => setShowTitleBgmHelp(false);
    title.addEventListener("playing", onPlaying);

    const t = window.setTimeout(() => {
      const el = titleBgmRef.current;
      if (el?.paused) setShowTitleBgmHelp(true);
    }, 1400);

    return () => {
      window.clearTimeout(t);
      title.removeEventListener("playing", onPlaying);
    };
  }, [titleScreenActive, titleBgmDead, titleBgmEnabled]);

  const syncPhase = useCallback((phase: GamePhase) => {
    setCurrentPhase(phase);
  }, []);

  const tryPlayTitleBgm = useCallback(() => {
    const title = titleBgmRef.current;
    if (!title || titleBgmDead) return;
    const go = () => {
      void title.play().catch(() => {});
    };
    go();
    if (title.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      title.addEventListener("canplay", go, { once: true });
    }
  }, [titleBgmDead]);

  const setTitleBgmEnabled = useCallback((on: boolean) => {
    setTitleBgmEnabledState(on);
    if (!on) {
      const t = titleBgmRef.current;
      if (t) {
        t.pause();
        t.currentTime = 0;
      }
    }
  }, []);

  useEffect(() => {
    if (!titleScreenActive || !titleBgmEnabled) return;
    tryPlayTitleBgm();
  }, [titleScreenActive, titleBgmEnabled, tryPlayTitleBgm]);

  const playGameTrack = useCallback((active: HTMLAudioElement) => {
    const id = ++gameBgmPlayIdRef.current;
    void active.play().catch((e: unknown) => {
      if (gameBgmPlayIdRef.current !== id) return;
      if (isPlayInterruptedError(e)) return;
      setBgmPlaying(false);
    });
  }, []);

  const resetGameBgm = useCallback(() => {
    disposeGameBgm();
    setExploreBgmDead(false);
    setCombatBgmDead(false);
    wireGameBgmPair();

    const explore = exploreBgmRef.current;
    const combat = combatBgmRef.current;
    if (!explore || !combat) return;

    if (!bgmPlayingRef.current) return;

    const phase = currentPhaseRef.current;
    const active = pickBgmForPhase(phase, false, false, explore, combat);
    if (!active) {
      setBgmPlaying(false);
      return;
    }
    explore.pause();
    combat.pause();
    active.currentTime = 0;
    playGameTrack(active);
  }, [disposeGameBgm, wireGameBgmPair, playGameTrack]);

  const startBgmExplore = useCallback(async () => {
    ensureGameBgmWired();
    const explore = exploreBgmRef.current;
    const combat = combatBgmRef.current;
    const title = titleBgmRef.current;
    if (!explore || !combat) return;
    title?.pause();
    if (title) title.currentTime = 0;
    explore.pause();
    combat.pause();
    const active = pickBgmForPhase(
      "explore",
      exploreBgmDead,
      combatBgmDead,
      explore,
      combat,
    );
    if (!active) return;
    active.currentTime = 0;
    const id = ++gameBgmPlayIdRef.current;
    try {
      await active.play();
      if (gameBgmPlayIdRef.current !== id) return;
      setBgmPlaying(true);
    } catch (e) {
      if (gameBgmPlayIdRef.current !== id) return;
      if (!isPlayInterruptedError(e)) setBgmPlaying(false);
    }
  }, [ensureGameBgmWired, exploreBgmDead, combatBgmDead]);

  const toggleBgm = useCallback(async () => {
    ensureGameBgmWired();
    const explore = exploreBgmRef.current;
    const combat = combatBgmRef.current;
    const title = titleBgmRef.current;
    if (!explore || !combat || bgmMissing) return;
    if (bgmPlaying) {
      gameBgmPlayIdRef.current += 1;
      explore.pause();
      combat.pause();
      title?.pause();
      setBgmPlaying(false);
      return;
    }
    title?.pause();
    const active = pickBgmForPhase(
      currentPhase,
      exploreBgmDead,
      combatBgmDead,
      explore,
      combat,
    );
    if (!active) return;
    explore.pause();
    combat.pause();
    active.currentTime = 0;
    const id = ++gameBgmPlayIdRef.current;
    try {
      await active.play();
      if (gameBgmPlayIdRef.current !== id) return;
      setBgmPlaying(true);
    } catch (e) {
      if (gameBgmPlayIdRef.current !== id) return;
      if (!isPlayInterruptedError(e)) setBgmPlaying(false);
    }
  }, [
    ensureGameBgmWired,
    bgmMissing,
    bgmPlaying,
    combatBgmDead,
    exploreBgmDead,
    currentPhase,
  ]);

  useEffect(() => {
    if (!bgmPlayingRef.current) return;
    ensureGameBgmWired();
    const explore = exploreBgmRef.current;
    const combat = combatBgmRef.current;
    const title = titleBgmRef.current;
    if (!explore || !combat) return;
    title?.pause();
    const active = pickBgmForPhase(
      currentPhase,
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
    playGameTrack(active);
  }, [
    currentPhase,
    exploreBgmDead,
    combatBgmDead,
    ensureGameBgmWired,
    playGameTrack,
  ]);

  /** タブ復帰・フォーカス・タップ後に無音になっていたら再開 */
  useEffect(() => {
    const onVisOrShow = () => {
      if (document.visibilityState !== "visible") return;
      tryResumeGameBgm();
    };

    document.addEventListener("visibilitychange", onVisOrShow);
    window.addEventListener("pageshow", onVisOrShow);
    window.addEventListener("focus", onVisOrShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisOrShow);
      window.removeEventListener("pageshow", onVisOrShow);
      window.removeEventListener("focus", onVisOrShow);
    };
  }, [tryResumeGameBgm]);

  /** iOS / LINE: バックグラウンドや省電力で止まりがちなので定期チェック */
  useEffect(() => {
    const id = window.setInterval(() => tryResumeGameBgm(), 2200);
    return () => window.clearInterval(id);
  }, [tryResumeGameBgm]);

  /** ユーザー操作直後に Audio を再アンロック（無音復帰） */
  useEffect(() => {
    const onPointer = () => tryResumeGameBgm();
    document.addEventListener("pointerdown", onPointer, { capture: true });
    return () =>
      document.removeEventListener("pointerdown", onPointer, { capture: true });
  }, [tryResumeGameBgm]);

  const value = useMemo(
    () => ({
      bgmPlaying,
      bgmMissing,
      titleBgmDead,
      titleBgmEnabled,
      setTitleBgmEnabled,
      showTitleBgmHelp,
      toggleBgm,
      resetGameBgm,
      syncPhase,
      tryPlayTitleBgm,
      startBgmExplore,
    }),
    [
      bgmPlaying,
      bgmMissing,
      titleBgmDead,
      titleBgmEnabled,
      setTitleBgmEnabled,
      showTitleBgmHelp,
      toggleBgm,
      resetGameBgm,
      syncPhase,
      tryPlayTitleBgm,
      startBgmExplore,
    ],
  );

  return (
    <GameBgmContext.Provider value={value}>{children}</GameBgmContext.Provider>
  );
}
