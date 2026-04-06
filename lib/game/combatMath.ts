import { jobPhysicalMul } from "./balance";
import type { Armor, JobId, Player } from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Lv `level` から次のレベルまでに必要な経験値（そのレベル帯の閾値） */
export function expToNextLevelRequirement(level: number): number {
  return 8 + level * 6;
}

/**
 * 物理ダメージ（乱数 0〜2 を外から渡す。戦闘本体とテストで共有）
 */
export function computePhysicalDamage(
  player: Player,
  enemyDef: number,
  job: JobId,
  random0to2: number,
): number {
  const w = player.weapon?.atk ?? 0;
  const pierce = player.weapon?.special === "piercing" ? 2 : 0;
  const effDef = Math.max(0, enemyDef - pierce);
  const raw = player.baseAtk + w - effDef + random0to2;
  const scaled = Math.floor(raw * jobPhysicalMul(job));
  return clamp(scaled, 1, 999);
}

/** 敵の物理ダメージ（追加乱数 0 か 1） */
export function computeEnemyDamage(
  enemyAtk: number,
  random0or1: number,
): number {
  const raw = enemyAtk + random0or1;
  return clamp(raw, 1, 999);
}

/**
 * 敵の一撃に対する防具による軽減（ward は固定 +1）。
 * aegis の確率半減は core の敵ターンで処理。
 */
export function mitigateDamageWithArmor(
  rawDamage: number,
  armor: Armor | null,
): number {
  if (!armor) return clamp(rawDamage, 1, 999);
  const ward = armor.special === "ward" ? 1 : 0;
  return clamp(rawDamage - armor.def - ward, 1, 999);
}

export function processLevelUpAccumulation(player: Player): {
  player: Player;
  messages: string[];
} {
  const p = { ...player };
  const messages: string[] = [];
  let need = expToNextLevelRequirement(p.level);
  while (p.exp >= need) {
    p.exp -= need;
    p.level += 1;
    p.maxHp += 5;
    p.maxMp += 3;
    p.baseAtk += 1;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    messages.push(`レベルが上がった。Lv${p.level}。`);
    need = expToNextLevelRequirement(p.level);
  }
  return { player: p, messages };
}
