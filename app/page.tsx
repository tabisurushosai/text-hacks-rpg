"use client";

import { GameBgmProvider } from "@/components/GameBgmContext";
import { HackAndSlashGame } from "@/components/HackAndSlashGame";
import { PreventUnsafeZoom } from "@/components/PreventUnsafeZoom";
import { TitleScreen } from "@/components/TitleScreen";
import type { JobId } from "@/lib/game/types";
import { useState } from "react";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [job, setJob] = useState<JobId>("warrior");

  return (
    <GameBgmProvider titleScreenActive={!started}>
      <PreventUnsafeZoom />
      {started ? (
        <HackAndSlashGame key={job} job={job} />
      ) : (
        <TitleScreen
          key="title"
          onEnter={(j) => {
            setJob(j);
            setStarted(true);
          }}
        />
      )}
    </GameBgmProvider>
  );
}
