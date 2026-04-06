"use client";

import { Noto_Serif_JP } from "next/font/google";
import { useCallback, useEffect } from "react";
import { useGameBgm } from "@/components/GameBgmContext";

const titleSerif = Noto_Serif_JP({
  weight: ["600", "900"],
  subsets: ["latin"],
  display: "swap",
});

type TitleScreenProps = {
  onEnter: () => void;
};

export function TitleScreen({ onEnter }: TitleScreenProps) {
  const { startBgmExplore, bgmMissing, tryPlayTitleBgm } = useGameBgm();

  const handleEnter = useCallback(async () => {
    await startBgmExplore();
    onEnter();
  }, [onEnter, startBgmExplore]);

  useEffect(() => {
    void tryPlayTitleBgm();
  }, [tryPlayTitleBgm]);

  useEffect(() => {
    const onFirstPointer = () => {
      void tryPlayTitleBgm();
      window.removeEventListener("pointerdown", onFirstPointer);
    };
    window.addEventListener("pointerdown", onFirstPointer);
    return () => window.removeEventListener("pointerdown", onFirstPointer);
  }, [tryPlayTitleBgm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      void handleEnter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleEnter]);

  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-10 ${titleSerif.className}`}
    >
      {/* 奥行き：底へ沈むグラデーション */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 100%, #1a3d32 0%, #0f1a18 38%, #080c10 72%, #030506 100%)",
        }}
        aria-hidden
      />
      {/* 石畳の目安：斜めストライプ＋薄グリッド */}
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
      {/* 霧・燭気の揺らぎ */}
      <div
        className="title-screen-mist pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(91,140,122,0.18),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.75)]"
        aria-hidden
      />

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <p className="mb-3 font-sans text-[11px] tracking-[0.35em] text-[var(--muted)] uppercase">
          Text descent
        </p>
        <h1 className="mb-10 text-[clamp(2.5rem,12vw,3.75rem)] font-black leading-none tracking-[0.02em] text-[var(--text)] drop-shadow-[0_0_40px_rgba(91,140,122,0.25)]">
          層底譚
        </h1>

        <button
          type="button"
          onClick={() => void handleEnter()}
          className="group touch-manipulation rounded border border-[#3d5c52] bg-[#15221c]/90 px-8 py-3.5 text-base font-semibold tracking-wide text-[var(--text)] shadow-[0_0_24px_rgba(91,140,122,0.12)] transition hover:border-[var(--accent)] hover:bg-[#1a2e26] hover:shadow-[0_0_32px_rgba(91,140,122,0.22)] active:scale-[0.99]"
        >
          ダンジョンに潜る
        </button>

        <p className="mt-8 font-sans text-[11px] text-[var(--muted)] opacity-80">
          {bgmMissing
            ? "本編: explore.mp3 と combat.mp3（または theme）を public/bgm に"
            : "Enter でも潜れる · 本編の BGM は画面右上から停止できます"}
        </p>
      </div>
    </div>
  );
}
