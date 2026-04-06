"use client";

import { GameBgmProvider } from "@/components/GameBgmContext";
import { HackAndSlashGame } from "@/components/HackAndSlashGame";
import { TitleScreen } from "@/components/TitleScreen";
import { useState } from "react";

export default function Home() {
  const [started, setStarted] = useState(false);

  return (
    <GameBgmProvider>
      {started ? (
        <HackAndSlashGame />
      ) : (
        <TitleScreen onEnter={() => setStarted(true)} />
      )}
    </GameBgmProvider>
  );
}
