import type { GameState } from "./types";

/**
 * クリア画面・ログ用の今回周回の称号（タイトル画面には出さない）。
 * 上から優先して一つだけ採用。
 */
export function runClearEpithet(g: GameState): string {
  const battles = g.totalBattlesFought;
  const lv = g.player.level;
  const spells = g.player.knownSpells.length;
  if (battles >= 120) return "歩数を数えし降り手";
  if (battles >= 100) return "層を測りし者";
  if (battles >= 80) return "刃の音に慣れし者";
  if (lv >= 12) return "燈よりも高き綴り礼拝者";
  if (lv >= 10) return "深層の文を読みし者";
  if (spells >= 10) return "綴りを貪りし者";
  if (battles >= 50) return "百戦洗われし者";
  return "層底を踏みしめし者";
}
