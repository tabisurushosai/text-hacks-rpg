/** 冒険開始時に選ぶ職（戦闘倍率に反映） */
export type JobId = "warrior" | "mage" | "farmer";

/** 魔法の属性（弱点判定用。回復は無し） */
export type SpellElement = "fire" | "ice" | "thunder";

export type SpellId =
  | "fire_jolt"
  | "fire_blast"
  | "ice_shard"
  | "ice_wrath"
  | "volt_needle"
  | "volt_chain"
  | "heal_soft"
  | "heal_solid"
  /** 職スキル（綴りでは習得しない） */
  | "war_cleave"
  | "war_resolve"
  | "mage_ether"
  | "mage_tap"
  | "far_mud"
  | "far_rest";

export type ItemKind = "restoreHp" | "restoreMp" | "weapon" | "armor";

/** 武器の系統（表示・生成用） */
export type WeaponCategory =
  | "sword"
  | "axe"
  | "spear"
  | "mace"
  | "dagger"
  | "wand";

/** 武器の特殊効果（戦闘で自動発動） */
export type WeaponSpecial =
  | "none"
  | "vampiric"
  | "keen"
  | "piercing"
  | "twin";

export interface Weapon {
  fullName: string;
  atk: number;
  category: WeaponCategory;
  special: WeaponSpecial;
}

/** 防具の系統（表示・生成用） */
export type ArmorCategory =
  | "leather"
  | "mail"
  | "plate"
  | "robe"
  | "cloak"
  | "buckler";

/** 防具の特殊効果（被弾時・軽減で発動） */
export type ArmorSpecial =
  | "none"
  /** 被ダメ後に敵に小ダメージ */
  | "thorns"
  /** 被ダメをさらに 1 軽減 */
  | "ward"
  /** 低確率で被ダメを大きく抑える */
  | "aegis"
  /** 被ダメ後に HP が少し回復 */
  | "regen";

export interface Armor {
  fullName: string;
  def: number;
  category: ArmorCategory;
  special: ArmorSpecial;
}

export interface InventoryItem {
  id: string;
  name: string;
  kind: ItemKind;
  power: number;
  /** 同名・同種・同威力はスタック */
  count: number;
  /** kind が weapon のときのみ */
  weaponCategory?: WeaponCategory;
  weaponSpecial?: WeaponSpecial;
  /** kind が armor のときのみ */
  armorCategory?: ArmorCategory;
  armorSpecial?: ArmorSpecial;
}

export interface Player {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
  baseAtk: number;
  weapon: Weapon | null;
  armor: Armor | null;
  knownSpells: SpellId[];
  inventory: InventoryItem[];
}

export interface EnemyTemplate {
  key: string;
  name: string;
  maxHp: number;
  atk: number;
  def: number;
  expReward: number;
  /** この属性の魔法で追加ダメージ */
  weakness?: SpellElement;
}

export interface EnemyInstance {
  templateKey: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  expReward: number;
  isBoss?: boolean;
  weakness?: SpellElement;
  /** 残りターン。0 より大きいとき敵は行動できない（凍結・痺れ等で共通） */
  frozenTurns?: number;
  /** ボス戦：HP 割合メッセージを何段まで出したか（学習用の節目ログ） */
  bossMilestonesLogged?: number;
}

/** main=2×2 / abilities=職スキル+綴り魔法 / item=所持品 */
export type CombatMenu = "main" | "abilities" | "item";

export type GamePhase = "explore" | "combat" | "cleared";

/** main=行動選択 / items=調合と所持品 / magic=探索魔法 / smith=武器・防具を経験値に分解 */
export type ExploreMenu = "main" | "items" | "magic" | "smith";

/**
 * ローカル記録・セーブ同期用。1 フレームだけ載せ、UI が処理後に除去する。
 */
export type PendingClientEvent =
  | { type: "death"; diedAtFloor: number; job: JobId }
  | { type: "boss_clear"; job: JobId };

export interface GameState {
  phase: GamePhase;
  job: JobId;
  player: Player;
  enemy: EnemyInstance | null;
  combatMenu: CombatMenu;
  log: string[];
  pendingClientEvent?: PendingClientEvent | null;
  /** 1〜10。10階はボス。 */
  floor: number;
  /** 下り階段を発見したが未処理 */
  stairsVisible: boolean;
  bossDefeated: boolean;
  exploreMenu: ExploreMenu;
  /** ボス戦のみ。プレイヤーが行動するたびに加算 */
  bossCombatTurns: number;
  /** この周回で交戦を開始した回数（入り口リセットで0に戻る） */
  totalBattlesFought: number;
}
