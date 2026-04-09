/**
 * ビルド時に決まるエディション（体験版 / 有料版）。
 * - 未設定・demo 以外 → 有料版（このリポジトリでの通常開発）
 * - NEXT_PUBLIC_GAME_EDITION=demo → 体験版（配布用ビルド）
 */

export type GameEdition = "demo" | "full";

export function getGameEdition(): GameEdition {
  const raw = process.env.NEXT_PUBLIC_GAME_EDITION;
  if (raw === "demo") return "demo";
  return "full";
}

export function isDemoEdition(): boolean {
  return getGameEdition() === "demo";
}

export function isFullEdition(): boolean {
  return getGameEdition() === "full";
}
