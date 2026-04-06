"use client";

import { GameBgmProvider } from "@/components/GameBgmContext";
import { HackAndSlashGame } from "@/components/HackAndSlashGame";
import { PreventUnsafeZoom } from "@/components/PreventUnsafeZoom";
import { TitleScreen } from "@/components/TitleScreen";
import {
  clearSaveFromLocalStorage,
  hasSaveInLocalStorage,
  loadGameFromLocalStorageDetailed,
} from "@/lib/game/persistence";
import type { GameState, JobId } from "@/lib/game/types";
import { useCallback, useEffect, useState } from "react";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [boot, setBoot] = useState<{
    job: JobId;
    snapshot: GameState | null;
  }>({ job: "warrior", snapshot: null });
  const [saveAvailable, setSaveAvailable] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  useEffect(() => {
    if (started) return;
    setSaveAvailable(hasSaveInLocalStorage());
  }, [started]);

  const goTitle = useCallback(() => {
    setStarted(false);
  }, []);

  const onContinue = useCallback(() => {
    setContinueError(null);
    const r = loadGameFromLocalStorageDetailed();
    if (!r.ok) {
      if (r.reason === "corrupt") {
        clearSaveFromLocalStorage();
        setContinueError(
          "セーブが読めませんでした。壊れているか、対応できない古さです。保存データは削除済みです。「新しく冒険する」で始めてください。",
        );
      }
      setSaveAvailable(false);
      return;
    }
    setBoot({ job: r.state.job, snapshot: r.state });
    setStarted(true);
  }, []);

  const onNewGame = useCallback((job: JobId) => {
    clearSaveFromLocalStorage();
    setBoot({ job, snapshot: null });
    setStarted(true);
  }, []);

  return (
    <GameBgmProvider titleScreenActive={!started}>
      <PreventUnsafeZoom />
      {started ? (
        <HackAndSlashGame
          key={boot.snapshot ? `c-${boot.job}` : `n-${boot.job}`}
          job={boot.job}
          initialSnapshot={boot.snapshot}
          onRequestTitle={goTitle}
        />
      ) : (
        <TitleScreen
          saveAvailable={saveAvailable}
          continueError={continueError}
          onDismissContinueError={() => setContinueError(null)}
          onContinue={onContinue}
          onNewGame={onNewGame}
        />
      )}
    </GameBgmProvider>
  );
}
