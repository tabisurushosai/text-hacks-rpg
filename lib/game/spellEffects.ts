/**
 * 呪文の効果計算（戦闘・探索の共有ロジックをここに集約）
 */

import {
  jobOffensiveMagicMul,
  jobPhysicalMul,
} from "./balance";
import { SPELL_ELEMENT } from "./data";
import type {
  EnemyInstance,
  JobId,
  Player,
  SpellElement,
  SpellId,
} from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function weaponPierceFlat(player: Player): number {
  return player.weapon?.special === "piercing" ? 2 : 0;
}

export function rollHealSoftAmount(lv: number): number {
  return 10 + Math.floor(Math.random() * 6) + Math.floor(lv * 0.75);
}

export function rollHealSolidAmount(lv: number): number {
  return 22 + Math.floor(Math.random() * 11) + Math.floor(lv * 1.35);
}

export function rollWarResolveHeal(lv: number): number {
  return 8 + Math.floor(Math.random() * 5) + Math.floor(lv * 0.65);
}

export function rollMageTapMp(lv: number): number {
  return 5 + Math.floor(Math.random() * 4) + Math.floor(lv * 0.35);
}

export function rollFarRestHeal(lv: number): number {
  return 6 + Math.floor(Math.random() * 4) + Math.floor(lv * 0.5);
}

export function rollFarRestMp(lv: number): number {
  return 3 + Math.floor(Math.random() * 3) + Math.floor(lv * 0.2);
}

function applyElementalMagicDamage(
  lines: string[],
  enemy: EnemyInstance,
  spell: SpellId,
  rawDmg: number,
  job: JobId,
): SpellElement | undefined {
  let dmg = Math.max(1, Math.floor(rawDmg * jobOffensiveMagicMul(job)));
  const el = SPELL_ELEMENT[spell];
  if (el && enemy.weakness === el) {
    dmg = Math.floor(dmg * 1.52);
    lines.push("弱点を突いた！");
    enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
    lines.push(`${dmg}のダメージ。`);
    return el;
  }
  enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
  lines.push(`${dmg}のダメージ。`);
  return undefined;
}

function tryApplyStun(
  lines: string[],
  enemy: EnemyInstance,
  normalChance: number,
  normalTurnsMin: number,
  normalTurnsMax: number,
  bossChance: number,
  bossTurns: number,
): void {
  if (enemy.isBoss) {
    if (Math.random() < bossChance) {
      const prev = enemy.frozenTurns ?? 0;
      enemy.frozenTurns = Math.max(prev, bossTurns);
      lines.push(
        `${enemy.name}は動けない（あと${enemy.frozenTurns}ターン）。`,
      );
    }
    return;
  }
  if (Math.random() < normalChance) {
    const t =
      normalTurnsMin +
      Math.floor(Math.random() * (normalTurnsMax - normalTurnsMin + 1));
    const prev = enemy.frozenTurns ?? 0;
    enemy.frozenTurns = Math.max(prev, t);
    lines.push(`${enemy.name}は動けない（あと${enemy.frozenTurns}ターン）。`);
  }
}

export type CombatSpellContext = {
  player: Player;
  enemy: EnemyInstance;
  floor: number;
  lv: number;
  job: JobId;
};

export type CombatSpellResult = {
  lines: string[];
  player: Player;
  enemy: EnemyInstance;
  weaknessRevealed?: SpellElement;
};

/**
 * MP 消費後の player / enemy のコピーに対して効果を適用する。
 */
export function runCombatSpell(
  spell: SpellId,
  ctx: CombatSpellContext,
): CombatSpellResult {
  const lines: string[] = [];
  let player = ctx.player;
  const enemy = { ...ctx.enemy };
  const { floor, lv, job } = ctx;
  let weaknessRevealed: SpellElement | undefined;

  const pushWeakness = (el: SpellElement | undefined) => {
    if (el) weaknessRevealed = el;
  };

  switch (spell) {
    case "fire_jolt": {
      const raw =
        8 +
        Math.floor(Math.random() * 7) +
        Math.floor(lv * 1.45) +
        Math.floor(floor * 0.42);
      const pierce = Math.floor(enemy.def * 0.42);
      const dmg = Math.max(2, raw - pierce);
      lines.push("火矢を放った。");
      pushWeakness(
        applyElementalMagicDamage(lines, enemy, spell, dmg, job),
      );
      break;
    }
    case "fire_blast": {
      const raw =
        15 +
        Math.floor(Math.random() * 9) +
        Math.floor(lv * 2.05) +
        Math.floor(floor * 0.52);
      const dmg = Math.max(4, raw);
      lines.push("業火が敵を包んだ。");
      pushWeakness(
        applyElementalMagicDamage(lines, enemy, spell, dmg, job),
      );
      break;
    }
    case "ice_shard": {
      const raw =
        5 +
        Math.floor(Math.random() * 6) +
        Math.floor(lv * 1.05) +
        Math.floor(floor * 0.32);
      const pierce = Math.floor(enemy.def * 0.22);
      const dmg = Math.max(2, raw - pierce);
      lines.push("氷片を叩きつけた。");
      pushWeakness(
        applyElementalMagicDamage(lines, enemy, spell, dmg, job),
      );
      tryApplyStun(lines, enemy, 0.48, 2, 4, 0.24, 1);
      break;
    }
    case "ice_wrath": {
      const raw =
        11 +
        Math.floor(Math.random() * 8) +
        Math.floor(lv * 1.75) +
        Math.floor(floor * 0.48);
      const pierce = Math.floor(enemy.def * 0.3);
      const dmg = Math.max(3, raw - pierce);
      lines.push("凍嵐を巻き起こした。");
      pushWeakness(
        applyElementalMagicDamage(lines, enemy, spell, dmg, job),
      );
      tryApplyStun(lines, enemy, 0.62, 2, 4, 0.32, 2);
      break;
    }
    case "volt_needle": {
      const raw =
        3 +
        Math.floor(Math.random() * 4) +
        Math.floor(lv * 0.75) +
        Math.floor(floor * 0.22);
      const dmg = Math.max(1, raw);
      lines.push("細い雷が刺さった。");
      pushWeakness(
        applyElementalMagicDamage(lines, enemy, spell, dmg, job),
      );
      tryApplyStun(lines, enemy, 0.74, 2, 4, 0.38, 1);
      break;
    }
    case "volt_chain": {
      const raw =
        9 +
        Math.floor(Math.random() * 7) +
        Math.floor(lv * 1.35) +
        Math.floor(floor * 0.38);
      const dmg = Math.max(2, raw);
      lines.push("落雷が走った。");
      pushWeakness(
        applyElementalMagicDamage(lines, enemy, spell, dmg, job),
      );
      tryApplyStun(lines, enemy, 0.86, 3, 4, 0.46, 2);
      break;
    }
    case "war_cleave": {
      const w = player.weapon?.atk ?? 0;
      const pierceFlat =
        weaponPierceFlat(player) + Math.floor(enemy.def * 0.25);
      const effDef = Math.max(0, enemy.def - pierceFlat);
      const raw =
        player.baseAtk +
        w -
        effDef +
        Math.floor(Math.random() * 4) +
        Math.floor(floor * 0.35) +
        Math.floor(lv * 0.4);
      let dmg = Math.max(2, raw);
      dmg = Math.max(1, Math.floor(dmg * jobPhysicalMul(job)));
      enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
      lines.push("強撃を放った。");
      lines.push(`${dmg}のダメージ。`);
      break;
    }
    case "mage_ether": {
      const raw =
        6 +
        Math.floor(Math.random() * 6) +
        Math.floor(lv * 1.2) +
        Math.floor(floor * 0.38);
      const pierce = Math.floor(enemy.def * 0.35);
      const dmg = Math.max(2, raw - pierce);
      lines.push("魔力撃を放った。");
      pushWeakness(
        applyElementalMagicDamage(lines, enemy, spell, dmg, job),
      );
      break;
    }
    case "far_mud": {
      const raw =
        2 +
        Math.floor(Math.random() * 4) +
        Math.floor(lv * 0.55) +
        Math.floor(floor * 0.2);
      const dmg = Math.max(1, raw);
      lines.push("泥を投げつけた。");
      pushWeakness(
        applyElementalMagicDamage(lines, enemy, spell, dmg, job),
      );
      tryApplyStun(lines, enemy, 0.55, 1, 3, 0.2, 1);
      break;
    }
    case "war_resolve": {
      const heal = rollWarResolveHeal(lv);
      const nh = clamp(player.hp + heal, 0, player.maxHp);
      lines.push(`応急措置を取った。HPが${nh - player.hp}回復した。`);
      player = { ...player, hp: nh };
      break;
    }
    case "mage_tap": {
      const gain = rollMageTapMp(lv);
      const nm = clamp(player.mp + gain, 0, player.maxMp);
      lines.push(`精神を統一した。MPが${nm - player.mp}回復した。`);
      player = { ...player, mp: nm };
      break;
    }
    case "far_rest": {
      const heal = rollFarRestHeal(lv);
      const mpGain = rollFarRestMp(lv);
      const nh = clamp(player.hp + heal, 0, player.maxHp);
      const nm = clamp(player.mp + mpGain, 0, player.maxMp);
      lines.push(
        `仮眠を取った。HPが${nh - player.hp}、MPが${nm - player.mp}回復した。`,
      );
      player = { ...player, hp: nh, mp: nm };
      break;
    }
    case "heal_soft": {
      const heal = rollHealSoftAmount(lv);
      const nh = clamp(player.hp + heal, 0, player.maxHp);
      lines.push(`癒しを唱えた。HPが${nh - player.hp}回復した。`);
      player = { ...player, hp: nh };
      break;
    }
    case "heal_solid": {
      const heal = rollHealSolidAmount(lv);
      const nh = clamp(player.hp + heal, 0, player.maxHp);
      lines.push(`大癒を唱えた。HPが${nh - player.hp}回復した。`);
      player = { ...player, hp: nh };
      break;
    }
  }

  return { lines, player, enemy, weaknessRevealed };
}

/** 探索で唱えたときの効果（MP 消費後の player を渡す） */
export function applyExploreSelfSpell(
  spell: SpellId,
  player: Player,
  lv: number,
): { lines: string[]; player: Player } | null {
  if (spell === "heal_soft") {
    const heal = rollHealSoftAmount(lv);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    return {
      lines: [`癒しを唱えた。HPが${nh - player.hp}回復した。`],
      player: { ...player, hp: nh },
    };
  }
  if (spell === "heal_solid") {
    const heal = rollHealSolidAmount(lv);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    return {
      lines: [`大癒を唱えた。HPが${nh - player.hp}回復した。`],
      player: { ...player, hp: nh },
    };
  }
  if (spell === "war_resolve") {
    const heal = rollWarResolveHeal(lv);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    return {
      lines: [`応急措置を取った。HPが${nh - player.hp}回復した。`],
      player: { ...player, hp: nh },
    };
  }
  if (spell === "mage_tap") {
    const gain = rollMageTapMp(lv);
    const nm = clamp(player.mp + gain, 0, player.maxMp);
    return {
      lines: [`精神を統一した。MPが${nm - player.mp}回復した。`],
      player: { ...player, mp: nm },
    };
  }
  if (spell === "far_rest") {
    const heal = rollFarRestHeal(lv);
    const mpGain = rollFarRestMp(lv);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    const nm = clamp(player.mp + mpGain, 0, player.maxMp);
    return {
      lines: [
        `仮眠を取った。HPが${nh - player.hp}、MPが${nm - player.mp}回復した。`,
      ],
      player: { ...player, hp: nh, mp: nm },
    };
  }
  return null;
}
