"use client";

import { useEffect } from "react";

/**
 * iOS / モバイル WebView のピンチ拡大を抑える。
 * 本番想定は PC とホーム画面追加（スタンドアロン）だが、共有用 in-app でも効くよう残す。
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
