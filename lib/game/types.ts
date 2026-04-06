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

export type ItemKind = "restoreHp" | "restoreMp" | "weapon";

/** 武器の系統（表示・生成用。防具は無し） */
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

export type CombatMenu = "main" | "magic" | "item";

export type GamePhase = "explore" | "combat" | "cleared";

/** main=行動選択 / items=調合と所持品の使用を同一画面 / magic=探索中の回復魔法のみ */
export type ExploreMenu = "main" | "items" | "magic";

export interface GameState {
  phase: GamePhase;
  job: JobId;
  player: Player;
  enemy: EnemyInstance | null;
  combatMenu: CombatMenu;
  log: string[];
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
