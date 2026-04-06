"use client";

import { GameBgmProvider } from "@/components/GameBgmContext";
import { HackAndSlashGame } from "@/components/HackAndSlashGame";
import { PreventUnsafeZoom } from "@/components/PreventUnsafeZoom";
import { TitleScreen } from "@/components/TitleScreen";
import {
  clearSaveFromLocalStorage,
  hasSaveInLocalStorage,
  loadGameFromLocalStorage,
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

  useEffect(() => {
    if (started) return;
    setSaveAvailable(hasSaveInLocalStorage());
  }, [started]);

  const goTitle = useCallback(() => {
    setStarted(false);
  }, []);

  const onContinue = useCallback(() => {
    const s = loadGameFromLocalStorage();
    if (!s) {
      setSaveAvailable(false);
      return;
    }
    setBoot({ job: s.job, snapshot: s });
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
          onContinue={onContinue}
          onNewGame={onNewGame}
        />
      )}
    </GameBgmProvider>
  );
}
