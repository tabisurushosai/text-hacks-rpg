"use client";

import { GameBgmProvider } from "@/components/GameBgmContext";
import { HackAndSlashGame } from "@/components/HackAndSlashGame";
import { PreventUnsafeZoom } from "@/components/PreventUnsafeZoom";
import { TitleScreen } from "@/components/TitleScreen";
import { useState } from "react";

export default function Home() {
  const [started, setStarted] = useState(false);

  return (
    <GameBgmProvider titleScreenActive={!started}>
      <PreventUnsafeZoom />
      {started ? (
        <HackAndSlashGame key="game" />
      ) : (
        <TitleScreen key="title" onEnter={() => setStarted(true)} />
      )}
    </GameBgmProvider>
  );
}
