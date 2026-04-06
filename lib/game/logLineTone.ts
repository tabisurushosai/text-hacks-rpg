/**
 * ログ行の表示トーン（ヒューリスティック。本文は変えない）
 */
export type LogLineTone =
  | "damage"
  | "heal"
  | "loot"
  | "emphasis"
  | "muted"
  | "default";

export function logLineTone(line: string): LogLineTone {
  const t = line.trim();
  if (t.startsWith("【") || t.includes("弱点を突いた")) return "emphasis";
  if (t.startsWith("戦闘後:") || t.includes("気がつくと入り口にいた")) {
    return "muted";
  }
  if (t.includes("ダメージ")) return "damage";
  if (t.includes("回復")) return "heal";
  if (
    t.includes("拾った") ||
    t.includes("得た") ||
    t.includes("所持品に入れた") ||
    t.includes("を手放した")
  ) {
    return "loot";
  }
  return "default";
}

export function logToneClass(tone: LogLineTone): string {
  switch (tone) {
    case "damage":
      return "text-[#e8a0a0]";
    case "heal":
      return "text-[#8ec5a8]";
    case "loot":
      return "text-[#a8c4e8]";
    case "emphasis":
      return "text-[var(--accent)] font-medium";
    case "muted":
      return "text-[var(--muted)] text-[0.8125rem]";
    default:
      return "text-[var(--text)]";
  }
}
