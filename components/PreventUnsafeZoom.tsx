"use client";

import { useEffect } from "react";

/**
 * iOS（LINE 内ブラウザ含む）のピンチ拡大を抑える。
 * viewport + touch-action に加え、Safari の gesture 系イベントを止める。
 */
export function PreventUnsafeZoom() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", block, { passive: false });
    document.addEventListener("gesturechange", block, { passive: false });
    document.addEventListener("gestureend", block, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
    };
  }, []);
  return null;
}
