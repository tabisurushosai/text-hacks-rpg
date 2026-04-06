/**
 * バランス調整の単一入口（テストしやすくする・将来 JSON 化しやすくする）
 *
 * 敵テンプレ・呪文定義は data.ts、職倍率は balance.ts に残す。
 */

export const BALANCE_TUNING = {
  /** 生成武器の攻撃力上限（data の生成ループでも使用） */
  weaponAtkMax: 15,
  /** 生成防具の防御力上限（武器と同帯） */
  armorDefMax: 15,

  /** 戦闘勝利時のドロップ（floor は 1 始まり） */
  combatLoot: {
    weapon: {
      /** 1 階付近の基準確率 */
      baseChance: 0.01,
      /** (floor - 1) に掛ける係数 */
      perFloor: 0.0167,
      cap: 0.16,
    },
    armor: {
      baseChance: 0.009,
      perFloor: 0.015,
      cap: 0.14,
    },
    spellBook: {
      baseMin: 0.32,
      perFloor: 0.018,
      cap: 0.46,
    },
    /** Math.min(cap, intercept + floor * perFloor) */
    herb: {
      intercept: 0.38,
      perFloor: 0.012,
      cap: 0.48,
    },
    manaHerb: {
      intercept: 0.2,
      perFloor: 0.012,
      cap: 0.3,
    },
  },
} as const;

export const PERSISTENCE_KEYS = {
  save: "text-hacks-rpg-save-v1",
  meta: "text-hacks-rpg-meta-v1",
} as const;

/** セーブ JSON の版。古い版は読み込み時に正規化する */
export const SAVE_PAYLOAD_VERSION = 2 as const;
export const SAVE_LEGACY_VERSION = 1 as const;
export const META_RECORDS_VERSION = 1 as const;
