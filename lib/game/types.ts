export type SpellId = "ember" | "mend";

export type ItemKind = "restoreHp" | "restoreMp" | "weapon";

export interface Weapon {
  fullName: string;
  atk: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  kind: ItemKind;
  power: number;
  /** 同名・同種・同威力はスタック */
  count: number;
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
}

export type CombatMenu = "main" | "magic" | "item";

export type GamePhase = "explore" | "combat";

export type ExploreMenu = "main" | "craft" | "use";

export interface GameState {
  phase: GamePhase;
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
