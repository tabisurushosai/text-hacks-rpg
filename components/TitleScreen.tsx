"use client";

import { useCallback, useEffect, useState } from "react";
import { useGameBgm } from "@/components/GameBgmContext";
import { JOB_META, JOB_ORDER } from "@/lib/game/balance";
import { isDemoEdition } from "@/lib/game/edition";
import { DEMO_DEEPEST_FLOOR } from "@/lib/game/editionLimits";
import type { JobId } from "@/lib/game/types";
import {
  AUTHOR_FEEDBACK_X_HANDLE,
  AUTHOR_FEEDBACK_X_URL,
} from "@/lib/siteMeta";

type TitleScreenProps = {
  onNewGame: (job: JobId) => void;
  onContinue: () => void;
  saveAvailable: boolean;
  continueError: string | null;
  onDismissContinueError: () => void;
};

export function TitleScreen({
  onNewGame,
  onContinue,
  saveAvailable,
  continueError,
  onDismissContinueError,
}: TitleScreenProps) {
  const [step, setStep] = useState<"title" | "chooseJob">("title");
  const {
    startBgmExplore,
    tryPlayTitleBgm,
    titleBgmEnabled,
    setTitleBgmEnabled,
    titleBgmDead,
  } = useGameBgm();

  const confirmJob = useCallback(
    async (job: JobId) => {
      await startBgmExplore();
      onNewGame(job);
    },
    [onNewGame, startBgmExplore],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (titleBgmEnabled) tryPlayTitleBgm();
      if (e.key === "Escape" && step === "chooseJob") {
        e.preventDefault();
        setStep("title");
        return;
      }
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (step === "title") {
        setStep("chooseJob");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, tryPlayTitleBgm, titleBgmEnabled]);

  const btnBgm = [
    "touch-manipulation rounded border px-4 py-3 font-sans text-sm font-medium transition",
    "min-h-[48px] w-full sm:min-h-0",
  ].join(" ");

  const btnJob =
    "touch-manipulation rounded border border-[#3d5c52] bg-[#15221c]/90 px-3 py-3 text-left text-sm text-[var(--text)] shadow-[0_0_20px_rgba(91,140,122,0.1)] transition hover:border-[var(--accent)] hover:bg-[#1a2e26] hover:shadow-[0_0_28px_rgba(91,140,122,0.18)] active:scale-[0.99]";

  return (
    <div
      className="font-title-serif relative flex min-h-[100dvh] touch-manipulation flex-col items-center justify-center overflow-hidden px-6 py-10"
      onPointerDownCapture={() => {
        if (titleBgmEnabled) tryPlayTitleBgm();
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 100%, #1a3d32 0%, #0f1a18 38%, #080c10 72%, #030506 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              -18deg,
              transparent,
              transparent 11px,
              rgba(230, 237, 243, 0.06) 11px,
              rgba(230, 237, 243, 0.06) 12px
            ),
            linear-gradient(rgba(91, 140, 122, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(91, 140, 122, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 24px 24px, 24px 24px",
        }}
        aria-hidden
      />
      <div
        className="title-screen-mist pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(91,140,122,0.18),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.75)]"
        aria-hidden
      />

      <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
        <p className="mb-3 font-sans text-[11px] tracking-[0.35em] text-[var(--muted)] uppercase">
          Text descent
        </p>
        <div className="mb-8 flex flex-col items-center gap-2">
          <h1 className="text-[clamp(2.5rem,12vw,3.75rem)] font-black leading-none tracking-[0.02em] text-[var(--text)] drop-shadow-[0_0_40px_rgba(91,140,122,0.25)]">
            層底譚
          </h1>
          {isDemoEdition() ? (
            <span className="rounded border border-[var(--accent)]/55 bg-[#15221c]/90 px-2.5 py-1 font-sans text-[11px] font-medium tracking-wide text-[var(--accent)]">
              体験版（{DEMO_DEEPEST_FLOOR}階まで）
            </span>
          ) : null}
        </div>

        {continueError ? (
          <div
            role="alert"
            className="mb-4 w-full max-w-lg rounded border border-[#8b4040] bg-[#2a1515]/95 px-3 py-2 text-left font-sans text-xs leading-relaxed text-[var(--text)]"
          >
            <p>{continueError}</p>
            <button
              type="button"
              className="mt-2 touch-manipulation text-[var(--accent)] underline"
              onClick={onDismissContinueError}
            >
              メッセージを閉じる
            </button>
          </div>
        ) : null}

        {step === "title" ? (
          <div className="flex w-full max-w-lg flex-col gap-3" role="group" aria-label="タイトル操作">
            {saveAvailable ? (
              <button
                type="button"
                onClick={() => onContinue()}
                className="touch-manipulation w-full rounded border border-[var(--accent)] bg-[#1a2e26] px-4 py-3 text-base font-semibold tracking-wide text-[var(--text)] shadow-[0_0_28px_rgba(91,140,122,0.2)] transition hover:border-[var(--accent)] hover:bg-[#243a32] active:scale-[0.99] sm:min-h-[3.25rem]"
              >
                続きから
              </button>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
              <button
                type="button"
                onClick={() => setStep("chooseJob")}
                className="touch-manipulation rounded border border-[#3d5c52] bg-[#15221c]/90 px-4 py-3 text-base font-semibold tracking-wide text-[var(--text)] shadow-[0_0_24px_rgba(91,140,122,0.12)] transition hover:border-[var(--accent)] hover:bg-[#1a2e26] hover:shadow-[0_0_32px_rgba(91,140,122,0.22)] active:scale-[0.99] sm:min-h-[4.5rem]"
              >
                新しく冒険する
              </button>
              <button
                type="button"
                disabled={titleBgmDead}
                aria-pressed={titleBgmEnabled}
                onClick={() => setTitleBgmEnabled(true)}
                className={`${btnBgm} border-[#3d5c52] ${
                  titleBgmEnabled
                    ? "bg-[#1a2e26] text-[var(--text)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[#080c10]"
                    : "border-[var(--border)] bg-[#15221c]/80 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                タイトルBGM ON
              </button>
              <button
                type="button"
                aria-pressed={!titleBgmEnabled}
                onClick={() => setTitleBgmEnabled(false)}
                className={`${btnBgm} border-[var(--border)] bg-[#15221c]/80 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)] ${
                  !titleBgmEnabled
                    ? "ring-2 ring-[var(--border)] ring-offset-2 ring-offset-[#080c10]"
                    : ""
                }`}
              >
                タイトルBGM OFF
              </button>
            </div>
          </div>
        ) : (
          <div
            className="w-full max-w-lg space-y-4 text-left"
            role="group"
            aria-label="職の選択"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {JOB_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={btnJob}
                  onClick={() => void confirmJob(id)}
                >
                  <span className="block font-semibold text-[var(--text)]">
                    {JOB_META[id].label}
                  </span>
                  <span className="mt-0.5 block font-sans text-xs text-[var(--muted)]">
                    {JOB_META[id].tag}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep("title")}
              className="touch-manipulation mt-4 w-full rounded border border-[var(--border)] bg-[#15221c]/80 px-4 py-3 font-sans text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              戻る
            </button>
          </div>
        )}

        <p className="mt-10 max-w-md font-sans text-[11px] leading-relaxed text-[var(--muted)]">
          感想・不具合は{" "}
          <a
            href={AUTHOR_FEEDBACK_X_URL}
            className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--text)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            {AUTHOR_FEEDBACK_X_HANDLE}
          </a>
          （X）まで
        </p>
      </div>
    </div>
  );
}
