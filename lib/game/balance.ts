/**
 * 周回・難易の設計基準（数値はここを見て調整する）
 *
 * - 想定プレイヤー: コアゲーマー／小説好き
 * - 1周の目安: 約30分前後（探索の引き・戦闘回数は別ロジックと併せて調整）
 * - 商業・拡張時: 難易度プリセットを増やすなら、この倍率を切り替えるのが最短
 */

import type { JobId } from "./types";

/** タイトル・ステータス・ヘルプ用 */
export const JOB_META: Record<
  JobId,
  { label: string; tag: string; helpLine: string }
> = {
  warrior: {
    label: "戦士",
    tag: "Easy",
    helpLine:
      "物理攻撃がやや強い。攻撃魔法はやや控えめ。職スキルは「強撃」「応急措置」から開始。",
  },
  mage: {
    label: "魔法使い",
    tag: "Normal",
    helpLine:
      "攻撃魔法がやや強い。物理はやや控えめ。職スキルは「魔力撃」「精神統一」から開始。",
  },
  farmer: {
    label: "農民",
    tag: "Hard",
    helpLine:
      "物理も攻撃魔法も控えめ。職スキルは「泥投げ」「仮眠」から開始。やり込み向け。",
  },
};

export const JOB_ORDER: JobId[] = ["warrior", "mage", "farmer"];

/** 通常攻撃（会心・連閃の前）に掛ける倍率 */
export function jobPhysicalMul(job: JobId): number {
  switch (job) {
    case "warrior":
      return 1.12;
    case "mage":
      return 0.88;
    case "farmer":
      return 0.78;
  }
}

/** 属性魔法・職の攻撃スキル（魔力撃・泥投げ等）。回復・MP回復・強撃は対象外 */
export function jobOffensiveMagicMul(job: JobId): number {
  switch (job) {
    case "warrior":
      return 0.94;
    case "mage":
      return 1.14;
    case "farmer":
      return 0.78;
  }
}

/** 1周の長さの参照（分）。UIやコメントの根拠用 */
export const RUN_TARGET_MINUTES = 30;

/**
 * 敵テンプレからインスタンスを作るときの倍率。
 * 初見で数回は落ちるが学習で乗り越えられる程度に寄せる。
 */
export const ENEMY_STAT_MULTIPLIER = {
  hp: 0.92,
  atk: 0.93,
} as const;

/**
 * ボスはテンプレ値から別曲線（雑魚弱体化と独立）。
 * 「あっさり撃破」を避け、節目ログ＋底近くの脅威で学習させる。
 */
export const BOSS_CURVE = {
  /** テンプレ maxHp に掛ける倍率（その後に min 下限を適用） */
  hpMul: 1.42,
  atkMul: 1.14,
  defBonus: 2,
  minHp: 210,
  minAtk: 18,
} as const;

/** HP 割合がこれ以下で主の攻撃が強まる（ログで気づける） */
export const BOSS_ENRAGE_HP_RATIO = 0.32;

/** 激昂時の与ダメ倍率（敵の攻撃） */
export const BOSS_ENRAGE_DAMAGE_MUL = 1.38;

export function scaleEnemyHp(hp: number): number {
  return Math.max(1, Math.floor(hp * ENEMY_STAT_MULTIPLIER.hp));
}

export function scaleEnemyAtk(atk: number): number {
  return Math.max(1, Math.floor(atk * ENEMY_STAT_MULTIPLIER.atk));
}

export function scaleBossFromTemplate(maxHp: number, atk: number, def: number) {
  const hp = Math.max(
    BOSS_CURVE.minHp,
    Math.floor(maxHp * BOSS_CURVE.hpMul),
  );
  const a = Math.max(
    BOSS_CURVE.minAtk,
    Math.floor(atk * BOSS_CURVE.atkMul),
  );
  const d = def + BOSS_CURVE.defBonus;
  return { maxHp: hp, atk: a, def: d };
}
