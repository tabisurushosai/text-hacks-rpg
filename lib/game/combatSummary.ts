import { SPELL_ELEMENT_LABEL } from "./data";
import type { EnemyInstance, SpellElement } from "./types";

/** 敵の残り体力の目安（数値は出さずログの補助用） */
export function enemyHpBandText(enemy: EnemyInstance): string {
  const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
  if (ratio > 0.72) return "手応えはまだ厚い";
  if (ratio > 0.48) return "半分ほど削れた";
  if (ratio > 0.24) return "いよいよ弱ってきた";
  if (ratio > 0) return "あと一息で倒せそうだ";
  return "";
}

export function enemyFrozenLine(enemy: EnemyInstance): string | null {
  const t = enemy.frozenTurns ?? 0;
  if (t <= 0) return null;
  return `拘束 あと${t}ターン`;
}

export function weaknessKnownLine(revealed: SpellElement | undefined): string | null {
  if (!revealed) return null;
  const label = SPELL_ELEMENT_LABEL[revealed];
  return `手応え: ${label}が効いた`;
}
