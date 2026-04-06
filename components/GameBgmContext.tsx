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

type GameBgmContextValue = {
  bgmPlaying: boolean;
  /** 本編の探索／戦闘用。両方読めないとき true */
  bgmMissing: boolean;
  /** タイトル専用要素が title→theme→explore まで全部失敗 */
  titleBgmDead: boolean;
  toggleBgm: () => Promise<void>;
  syncPhase: (phase: GamePhase) => void;
  /**
   * タイトル BGM を再生。必ず同期的に呼ぶこと（ポインター／キー操作のスタック内）。
   * 自動再生だけ試す場合も同関数でよいが、多くの環境ではユーザー操作が必要。
   */
  tryPlayTitleBgm: () => void;
  /** タイトルを止め、探索フェーズ向けトラックを再生（無ければ戦闘へフォールバック） */
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

export function GameBgmProvider({ children }: { children: ReactNode }) {
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [exploreBgmDead, setExploreBgmDead] = useState(false);
  const [combatBgmDead, setCombatBgmDead] = useState(false);
  const [titleBgmDead, setTitleBgmDead] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<GamePhase>("explore");

  const titleBgmRef = useRef<HTMLAudioElement | null>(null);
  const exploreBgmRef = useRef<HTMLAudioElement | null>(null);
  const combatBgmRef = useRef<HTMLAudioElement | null>(null);
  const bgmPlayingRef = useRef(false);
  bgmPlayingRef.current = bgmPlaying;

  const bgmMissing = exploreBgmDead && combatBgmDead;

  useEffect(() => {
    const title = createLoopingBgm({ preload: "auto" });
    const explore = createLoopingBgm();
    const combat = createLoopingBgm();
    titleBgmRef.current = title;
    exploreBgmRef.current = explore;
    combatBgmRef.current = combat;

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

    const unsubs = [
      wireTitle(title, () => setTitleBgmDead(true)),
      wireExploreOrCombat(explore, BGM_PATHS.explore, () =>
        setExploreBgmDead(true),
      ),
      wireExploreOrCombat(combat, BGM_PATHS.combat, () =>
        setCombatBgmDead(true),
      ),
    ];

    return () => {
      for (const u of unsubs) u();
      title.pause();
      explore.pause();
      combat.pause();
      titleBgmRef.current = null;
      exploreBgmRef.current = null;
      combatBgmRef.current = null;
    };
  }, []);

  const syncPhase = useCallback((phase: GamePhase) => {
    setCurrentPhase(phase);
  }, []);

  const tryPlayTitleBgm = useCallback(() => {
    const title = titleBgmRef.current;
    if (!title || titleBgmDead) return;
    const go = () => {
      void title.play().catch(() => {
        /* 未ロード・自動再生拒否など */
      });
    };
    go();
    if (title.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      title.addEventListener("canplay", go, { once: true });
    }
  }, [titleBgmDead]);

  const startBgmExplore = useCallback(async () => {
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
    try {
      await active.play();
      setBgmPlaying(true);
    } catch {
      setBgmPlaying(false);
    }
  }, [exploreBgmDead, combatBgmDead]);

  const toggleBgm = useCallback(async () => {
    const explore = exploreBgmRef.current;
    const combat = combatBgmRef.current;
    const title = titleBgmRef.current;
    if (!explore || !combat || bgmMissing) return;
    if (bgmPlaying) {
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
    currentPhase,
  ]);

  useEffect(() => {
    if (!bgmPlayingRef.current) return;
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
    void active.play().catch(() => setBgmPlaying(false));
  }, [currentPhase, exploreBgmDead, combatBgmDead]);

  const value = useMemo(
    () => ({
      bgmPlaying,
      bgmMissing,
      titleBgmDead,
      toggleBgm,
      syncPhase,
      tryPlayTitleBgm,
      startBgmExplore,
    }),
    [
      bgmPlaying,
      bgmMissing,
      titleBgmDead,
      toggleBgm,
      syncPhase,
      tryPlayTitleBgm,
      startBgmExplore,
    ],
  );

  return (
    <GameBgmContext.Provider value={value}>{children}</GameBgmContext.Provider>
  );
}
