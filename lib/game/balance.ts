/**
 * 周回・難易の設計基準（数値はここを見て調整する）
 *
 * - 想定プレイヤー: コアゲーマー／小説好き
 * - 1周の目安: 約30分前後（探索の引き・戦闘回数は別ロジックと併せて調整）
 * - 商業・拡張時: 難易度プリセットを増やすなら、この倍率を切り替えるのが最短
 */

/** 1周の長さの参照（分）。UIやコメントの根拠用 */
export const RUN_TARGET_MINUTES = 30;

/**
 * 敵テンプレからインスタンスを作るときの倍率。
 * 1.0 が厳しめの基準。やや下げて序盤〜中盤の死亡率を抑える。
 */
export const ENEMY_STAT_MULTIPLIER = {
  hp: 0.88,
  atk: 0.9,
} as const;

/** ボスにも同倍率を掛ける（底の主戦を「学習可能な壁」に寄せる） */
export const BOSS_USES_SAME_MULTIPLIER = true;

export function scaleEnemyHp(hp: number): number {
  return Math.max(1, Math.floor(hp * ENEMY_STAT_MULTIPLIER.hp));
}

export function scaleEnemyAtk(atk: number): number {
  return Math.max(1, Math.floor(atk * ENEMY_STAT_MULTIPLIER.atk));
}
