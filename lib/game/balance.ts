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
