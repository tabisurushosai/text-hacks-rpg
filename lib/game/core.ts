import {
  BOSS_ENRAGE_DAMAGE_MUL,
  BOSS_ENRAGE_HP_RATIO,
  scaleBossFromTemplate,
  scaleEnemyAtk,
  scaleEnemyHp,
} from "./balance";
import {
  BOSS_HP_MILESTONES,
  BOSS_TEMPLATE,
  CRAFT_COST,
  ITEM_HERB,
  ITEM_MANA_HERB,
  ITEM_MANA_POTION_MINOR,
  ITEM_MANA_POTION_MEDIUM,
  ITEM_POTION_MINOR,
  ITEM_POTION_MEDIUM,
  POTION_MEDIUM_HP_POWER,
  POTION_MEDIUM_MP_POWER,
  EXPLORE_CASTABLE_SPELLS,
  JOB_STARTING_SPELLS,
  ARMOR_BASES,
  ARMOR_DEF_MAX,
  ARMOR_PREFIXES,
  ARMOR_SPECIAL_LABEL,
  ENEMY_EXTRA_LOOT,
  spellBooksLootPool,
  SPELLS,
  rollLootQualityFlairLine,
  WEAPON_ATK_MAX,
  WEAPON_BASES,
  WEAPON_PREFIXES,
  nextItemId,
  resetItemIdCounter,
  rollArmorSpecial,
  rollWeaponSpecial,
  templatesForFloor,
  WEAPON_SPECIAL_LABEL,
} from "./data";
import {
  computeEnemyDamage,
  computePhysicalDamage,
  expToNextLevelRequirement,
  mitigateDamageWithArmor,
  processLevelUpAccumulation,
} from "./combatMath";
import { BALANCE_TUNING } from "./gameConfig";
import {
  DEMO_DESCEND_BLOCKED_LINE,
  demoAllowsDescendFromFloor,
} from "./editionLimits";
import {
  flavorAmbientDetail,
  flavorAbyssCalm,
  flavorQuiet,
} from "./exploreFlavor";
import { LORE_INTRO_DESCENDER } from "./lore";
import { runClearEpithet } from "./runEpithet";
import { applyExploreSelfSpell, runCombatSpell } from "./spellEffects";
import type {
  Armor,
  EnemyInstance,
  GameState,
  InventoryItem,
  ItemKind,
  JobId,
  Player,
  SpellElement,
  SpellId,
  Weapon,
} from "./types";

export function inventoryActionLabel(it: InventoryItem): string {
  const head =
    it.kind === "weapon"
      ? "武器"
      : it.kind === "armor"
        ? "防具"
        : "使う";
  return `${head}：${it.count > 1 ? `${it.name}×${it.count}` : it.name}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pushEquipLootFlair(lines: string[], equipStat: number): void {
  const line = rollLootQualityFlairLine(equipStat);
  if (line) lines.push(line);
}

/** UI 用：次のレベルまでに必要な経験値の残り */
export function expUntilLevelUp(player: Player): number {
  return expToNextLevelRequirement(player.level) - player.exp;
}

function inventoryItemsMatch(a: InventoryItem, b: InventoryItem): boolean {
  if (a.kind !== b.kind || a.name !== b.name || a.power !== b.power) {
    return false;
  }
  if (a.kind === "weapon") {
    return (
      (a.weaponCategory ?? "sword") === (b.weaponCategory ?? "sword") &&
      (a.weaponSpecial ?? "none") === (b.weaponSpecial ?? "none")
    );
  }
  if (a.kind === "armor") {
    return (
      (a.armorCategory ?? "leather") === (b.armorCategory ?? "leather") &&
      (a.armorSpecial ?? "none") === (b.armorSpecial ?? "none")
    );
  }
  return true;
}

/** 回復品は power 順、防具・武器は装備値の大きい順（武器を上に） */
function sortInventoryItems(inv: InventoryItem[]): InventoryItem[] {
  return [...inv].sort((a, b) => {
    const tier = (it: InventoryItem) =>
      it.kind === "weapon" ? 2 : it.kind === "armor" ? 1 : 0;
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return tb - ta;
    if (ta === 0) {
      if (b.power !== a.power) return b.power - a.power;
      if (a.kind !== b.kind) return a.kind === "restoreHp" ? -1 : 1;
      return a.name.localeCompare(b.name, "ja");
    }
    if (b.power !== a.power) return b.power - a.power;
    return a.name.localeCompare(b.name, "ja");
  });
}

/** UI 用：武器（攻撃力降順）→防具（防御降順）→消耗品 */
export function orderedInventoryForMenu(inv: InventoryItem[]): InventoryItem[] {
  return sortInventoryItems(inv);
}

function mergeInventory(inv: InventoryItem[], add: InventoryItem): InventoryItem[] {
  const match = inv.find((x) => inventoryItemsMatch(x, add));
  let next: InventoryItem[];
  if (match) {
    next = inv.map((x) =>
      x.id === match.id ? { ...x, count: x.count + add.count } : x,
    );
  } else {
    next = [...inv, { ...add, id: add.id || nextItemId(), count: add.count }];
  }
  return sortInventoryItems(next);
}

function countByName(inv: InventoryItem[], name: string): number {
  return inv
    .filter((x) => x.name === name)
    .reduce((s, x) => s + x.count, 0);
}

export function countMaterial(state: GameState, name: string): number {
  return countByName(state.player.inventory, name);
}

function consumeNamed(
  inv: InventoryItem[],
  name: string,
  amount: number,
): InventoryItem[] | null {
  let left = amount;
  const next: InventoryItem[] = [];
  for (const it of inv) {
    if (it.name !== name || left <= 0) {
      next.push(it);
      continue;
    }
    const take = Math.min(it.count, left);
    const remain = it.count - take;
    left -= take;
    if (remain > 0) next.push({ ...it, count: remain });
  }
  if (left > 0) return null;
  return sortInventoryItems(next);
}

export function initialPlayer(job: JobId): Player {
  resetItemIdCounter();
  return {
    hp: 28,
    maxHp: 28,
    mp: 14,
    maxMp: 14,
    level: 1,
    exp: 0,
    baseAtk: 3,
    weapon: null,
    armor: null,
    knownSpells: [...JOB_STARTING_SPELLS[job]],
    inventory: [
      {
        id: nextItemId(),
        name: ITEM_HERB,
        kind: "restoreHp",
        power: 10,
        count: 1,
      },
    ],
  };
}

export function initialGameState(job: JobId): GameState {
  return {
    phase: "explore",
    job,
    player: initialPlayer(job),
    enemy: null,
    combatMenu: "main",
    floor: 1,
    stairsVisible: false,
    bossDefeated: false,
    exploreMenu: "main",
    bossCombatTurns: 0,
    totalBattlesFought: 0,
    pendingClientEvent: null,
    log: [
      "ダンジョンの入り口にいる。",
      "下へ続く気配がある。",
      LORE_INTRO_DESCENDER,
      "古い地図では、最下層だけが「層底」とだけ書かれていた。",
      "迷ったら画面右上の「？」で用語と操作のメモを開ける。",
    ],
  };
}

function deathHintAfterCombat(state: GameState): string | null {
  if (state.phase !== "combat" || !state.enemy) return null;
  const e = state.enemy;
  const pl = state.player;
  if (e.isBoss) {
    const r = e.hp / e.maxHp;
    if (r > 0 && r <= BOSS_ENRAGE_HP_RATIO) {
      return "【手がかり】主は傷つくほど一撃が重い。回復と拘束でリズムを崩さないよう工夫できる。";
    }
    return "【手がかり】主は炎・氷・雷のいずれかに弱いことがある。「弱点を突いた」のログを振り返ろう。";
  }
  if (pl.mp <= Math.max(2, Math.floor(pl.maxMp * 0.18))) {
    return "【手がかり】MPが乏しかった。探索での回復魔法や調合で、戦闘前の余白を増やせる。";
  }
  return "【手がかり】武器の攻撃力・防具の防御や特殊効果を見直し、落とし物を見逃していないか確かめよう。";
}

function resetToEntrance(
  job: JobId,
  prevLog: string[],
  diedAtFloor: number,
  hint?: string | null,
): GameState {
  const tail = [...prevLog, "力尽きた。", "気がつくと入り口にいた。"];
  if (hint) tail.push(hint);
  return {
    ...initialGameState(job),
    log: tail,
    pendingClientEvent: { type: "death", diedAtFloor, job },
  };
}

function spawnEnemyForFloor(floor: number): EnemyInstance {
  const pool = templatesForFloor(floor);
  const t = pick(pool.length ? pool : templatesForFloor(1));
  const maxHp = scaleEnemyHp(t.maxHp);
  const atk = scaleEnemyAtk(t.atk);
  return {
    templateKey: t.key,
    name: t.name,
    hp: maxHp,
    maxHp,
    atk,
    def: t.def,
    expReward: t.expReward,
    weakness: t.weakness,
  };
}

const BOSS_WEAKNESS_POOL: SpellElement[] = ["fire", "ice", "thunder"];

function spawnBoss(): EnemyInstance {
  const t = BOSS_TEMPLATE;
  const { maxHp, atk, def } = scaleBossFromTemplate(t.maxHp, t.atk, t.def);
  return {
    templateKey: t.key,
    name: t.name,
    hp: maxHp,
    maxHp,
    atk,
    def,
    expReward: t.expReward,
    isBoss: true,
    weakness: Math.random() < 0.48 ? pick(BOSS_WEAKNESS_POOL) : undefined,
    bossMilestonesLogged: 0,
  };
}

function applyBossHpMilestones(enemy: EnemyInstance, lines: string[]): EnemyInstance {
  if (!enemy.isBoss || enemy.hp <= 0) return enemy;
  let n = enemy.bossMilestonesLogged ?? 0;
  const ratio = enemy.hp / enemy.maxHp;
  let next = enemy;
  for (let i = n; i < BOSS_HP_MILESTONES.length; i++) {
    if (ratio <= BOSS_HP_MILESTONES[i]!.ratio) {
      lines.push(BOSS_HP_MILESTONES[i]!.line);
      n = i + 1;
    }
  }
  if (n !== (enemy.bossMilestonesLogged ?? 0)) {
    next = { ...enemy, bossMilestonesLogged: n };
  }
  return next;
}

function playerCritChance(player: Player): number {
  const bonus = player.weapon?.special === "keen" ? 0.08 : 0;
  return Math.min(0.42, PLAYER_CRIT_CHANCE + bonus);
}

function rollPhysicalDamage(
  player: Player,
  enemyDef: number,
  job: JobId,
): number {
  return computePhysicalDamage(
    player,
    enemyDef,
    job,
    Math.floor(Math.random() * 3),
  );
}

const PLAYER_ATTACK_MISS_CHANCE = 0.05;
const ENEMY_ATTACK_MISS_CHANCE = 0.15;
const PLAYER_CRIT_CHANCE = 0.1;

function rollEnemyDamage(enemyAtk: number): number {
  return computeEnemyDamage(enemyAtk, Math.floor(Math.random() * 2));
}

function maybeLevelUp(player: Player, lines: string[]): Player {
  const { player: next, messages } = processLevelUpAccumulation(player);
  lines.push(...messages);
  return next;
}

function generateWeapon(): Weapon {
  for (let n = 0; n < 96; n++) {
    const base = pick(WEAPON_BASES);
    const pre = pick(WEAPON_PREFIXES);
    const atk = base.atk + pre.atk;
    if (atk >= 1 && atk <= WEAPON_ATK_MAX) {
      const special = rollWeaponSpecial();
      let fullName = `${pre.label}${base.name}`;
      if (special !== "none") {
        fullName += `・${WEAPON_SPECIAL_LABEL[special]}`;
      }
      return {
        fullName,
        atk,
        category: base.category,
        special,
      };
    }
  }
  return {
    fullName: "木片の短剣",
    atk: 1,
    category: "sword",
    special: "none",
  };
}

function generateArmor(): Armor {
  for (let n = 0; n < 96; n++) {
    const base = pick(ARMOR_BASES);
    const pre = pick(ARMOR_PREFIXES);
    const def = base.def + pre.def;
    if (def >= 1 && def <= ARMOR_DEF_MAX) {
      const special = rollArmorSpecial();
      let fullName = `${pre.label}${base.name}`;
      if (special !== "none") {
        fullName += `・${ARMOR_SPECIAL_LABEL[special]}`;
      }
      return {
        fullName,
        def,
        category: base.category,
        special,
      };
    }
  }
  return {
    fullName: "旅人の革当て",
    def: 1,
    category: "leather",
    special: "none",
  };
}

function addLootItem(
  player: Player,
  item: Omit<InventoryItem, "id" | "count"> & { count?: number },
): Player {
  const stack: InventoryItem = {
    id: nextItemId(),
    name: item.name,
    kind: item.kind,
    power: item.power,
    count: item.count ?? 1,
  };
  if (item.kind === "weapon") {
    stack.weaponCategory = item.weaponCategory;
    stack.weaponSpecial = item.weaponSpecial;
  }
  if (item.kind === "armor") {
    stack.armorCategory = item.armorCategory;
    stack.armorSpecial = item.armorSpecial;
  }
  return {
    ...player,
    inventory: mergeInventory(player.inventory, stack),
  };
}

function rollDrops(
  player: Player,
  lines: string[],
  floor: number,
  defeatedTemplateKey: string,
): Player {
  let p = { ...player, inventory: [...player.inventory] };
  const extra = ENEMY_EXTRA_LOOT[defeatedTemplateKey] ?? {};

  const wcfg = BALANCE_TUNING.combatLoot.weapon;
  const weaponChance = Math.min(
    wcfg.cap,
    wcfg.baseChance +
      Math.max(0, floor - 1) * wcfg.perFloor +
      (extra.weaponChanceAdd ?? 0),
  );
  if (Math.random() < weaponChance) {
    const w = generateWeapon();
    p = addLootItem(p, {
      name: w.fullName,
      kind: "weapon",
      power: w.atk,
      count: 1,
      weaponCategory: w.category,
      weaponSpecial: w.special,
    });
    lines.push(`${w.fullName}を拾った。所持品に入れた。`);
    pushEquipLootFlair(lines, w.atk);
  }

  const acfg = BALANCE_TUNING.combatLoot.armor;
  const armorChance = Math.min(
    acfg.cap,
    acfg.baseChance +
      Math.max(0, floor - 1) * acfg.perFloor +
      (extra.armorChanceAdd ?? 0),
  );
  if (Math.random() < armorChance) {
    const a = generateArmor();
    p = addLootItem(p, {
      name: a.fullName,
      kind: "armor",
      power: a.def,
      count: 1,
      armorCategory: a.category,
      armorSpecial: a.special,
    });
    lines.push(`${a.fullName}を拾った。所持品に入れた。`);
    pushEquipLootFlair(lines, a.def);
  }

  const bcfg = BALANCE_TUNING.combatLoot.spellBook;
  const bookChance = Math.min(
    bcfg.cap,
    bcfg.baseMin + Math.max(0, floor - 1) * bcfg.perFloor,
  );
  if (Math.random() < bookChance) {
    const book = pick(spellBooksLootPool(floor));
    if (!p.knownSpells.includes(book.spell)) {
      p = {
        ...p,
        knownSpells: [...p.knownSpells, book.spell],
      };
      lines.push(`${book.name}を拾った。`);
    } else {
      lines.push(`${book.name}を見つけたが、もう読んでいる。`);
    }
  }

  const hcfg = BALANCE_TUNING.combatLoot.herb;
  const herbP = Math.min(
    hcfg.cap,
    hcfg.intercept +
      floor * hcfg.perFloor +
      (extra.herbBonusChance ?? 0),
  );
  if (Math.random() < herbP) {
    p = addLootItem(p, {
      name: ITEM_HERB,
      kind: "restoreHp",
      power: 10,
      count: 1,
    });
    lines.push(`薬草を拾った。苦い。`);
  }

  const mcfg = BALANCE_TUNING.combatLoot.manaHerb;
  const manaP = Math.min(
    mcfg.cap,
    mcfg.intercept +
      floor * mcfg.perFloor +
      (extra.manaHerbBonusChance ?? 0),
  );
  if (Math.random() < manaP) {
    p = addLootItem(p, {
      name: ITEM_MANA_HERB,
      kind: "restoreMp",
      power: 8,
      count: 1,
    });
    lines.push(`魔力草を拾った。`);
  }

  return p;
}

function rollBossLoot(player: Player, lines: string[]): Player {
  let p = { ...player, hp: player.maxHp, mp: player.maxMp };
  lines.push("勝利の余波で体力と魔力が満ちた。");

  p = addLootItem(p, {
    name: ITEM_POTION_MEDIUM,
    kind: "restoreHp",
    power: POTION_MEDIUM_HP_POWER,
    count: 1,
  });
  p = addLootItem(p, {
    name: ITEM_MANA_POTION_MEDIUM,
    kind: "restoreMp",
    power: POTION_MEDIUM_MP_POWER,
    count: 1,
  });
  lines.push("主の残骸から中級ポーションと中級魔力ポーションを得た。");

  const w = generateWeapon();
  p = addLootItem(p, {
    name: w.fullName,
    kind: "weapon",
    power: w.atk,
    count: 1,
    weaponCategory: w.category,
    weaponSpecial: w.special,
  });
  lines.push(`${w.fullName}も手元に転がっていた。`);
  pushEquipLootFlair(lines, w.atk);

  const a = generateArmor();
  p = addLootItem(p, {
    name: a.fullName,
    kind: "armor",
    power: a.def,
    count: 1,
    armorCategory: a.category,
    armorSpecial: a.special,
  });
  lines.push(`${a.fullName}も、主の影に引き寄せられていた。`);
  pushEquipLootFlair(lines, a.def);

  const bossX = ENEMY_EXTRA_LOOT.boss_depth;
  if (bossX?.herbBonusChance && Math.random() < bossX.herbBonusChance) {
    p = addLootItem(p, {
      name: ITEM_HERB,
      kind: "restoreHp",
      power: 10,
      count: 1,
    });
    lines.push("主の屑から薬草が転がり出た。");
  }
  if (bossX?.manaHerbBonusChance && Math.random() < bossX.manaHerbBonusChance) {
    p = addLootItem(p, {
      name: ITEM_MANA_HERB,
      kind: "restoreMp",
      power: 8,
      count: 1,
    });
    lines.push("主の屑に魔力草が混じっていた。");
  }
  if (bossX?.weaponChanceAdd && Math.random() < bossX.weaponChanceAdd) {
    const w2 = generateWeapon();
    p = addLootItem(p, {
      name: w2.fullName,
      kind: "weapon",
      power: w2.atk,
      count: 1,
      weaponCategory: w2.category,
      weaponSpecial: w2.special,
    });
    lines.push(`主の硬い殻の間に、${w2.fullName}が楔のように刺さっていた。`);
    pushEquipLootFlair(lines, w2.atk);
  }

  return p;
}

function withBossTurnIncrement(state: GameState): GameState {
  if (!state.enemy?.isBoss) return state;
  return { ...state, bossCombatTurns: state.bossCombatTurns + 1 };
}

/** 1〜9 階の探索で、なにも起きない系よりやや優先して発生 */
const EXPLORE_TREASURE_CHEST_CHANCE = 0.048;

function openExplorationTreasureChest(
  state: GameState,
  lines: string[],
): GameState {
  const f = state.floor;
  lines.push(
    pick([
      "苔むした宝箱を見つけた。錠は外れている。",
      "壁の凹みに、古い木箱が押し込まれていた。",
      "旅立ちに捨てられた荷だろう。留め金の錆びた箱。",
      "光の届かない角に、小さな宝箱が転がっていた。",
    ]),
  );

  const u = Math.random();
  let p = state.player;

  if (u < 0.3) {
    const v = Math.random();
    if (v < 0.4) {
      p = addLootItem(p, {
        name: ITEM_HERB,
        kind: "restoreHp",
        power: 10,
        count: 1,
      });
      lines.push("薬草が束ねられていた。");
    } else if (v < 0.78) {
      p = addLootItem(p, {
        name: ITEM_MANA_HERB,
        kind: "restoreMp",
        power: 8,
        count: 1,
      });
      lines.push("魔力草が干されてあった。");
    } else if (v < 0.9) {
      p = addLootItem(p, {
        name: ITEM_POTION_MINOR,
        kind: "restoreHp",
        power: 28,
        count: 1,
      });
      lines.push("初級ポーションが一本入っていた。");
    } else {
      p = addLootItem(p, {
        name: ITEM_MANA_POTION_MINOR,
        kind: "restoreMp",
        power: 22,
        count: 1,
      });
      lines.push("初級魔力ポーションが一本入っていた。");
    }
  } else if (u < 0.48) {
    const w = generateWeapon();
    p = addLootItem(p, {
      name: w.fullName,
      kind: "weapon",
      power: w.atk,
      count: 1,
      weaponCategory: w.category,
      weaponSpecial: w.special,
    });
    lines.push(`${w.fullName}が収められていた。`);
    pushEquipLootFlair(lines, w.atk);
  } else if (u < 0.66) {
    const a = generateArmor();
    p = addLootItem(p, {
      name: a.fullName,
      kind: "armor",
      power: a.def,
      count: 1,
      armorCategory: a.category,
      armorSpecial: a.special,
    });
    lines.push(`${a.fullName}が折りたたまれて入っていた。`);
    pushEquipLootFlair(lines, a.def);
  } else if (u < 0.88) {
    const xp = 4 + f * 2 + Math.floor(Math.random() * 6);
    p = { ...p, exp: p.exp + xp };
    lines.push(`箱底に刻まれた文が脳に焼きついた。経験値を${xp}得た。`);
    const lvLines: string[] = [];
    p = maybeLevelUp(p, lvLines);
    lines.push(...lvLines);
  } else {
    const raw = 5 + Math.floor(Math.random() * 6) + Math.floor(f / 2);
    const soft = raw - Math.floor((p.armor?.def ?? 0) / 3);
    const dmg = Math.max(2, soft);
    const nh = clamp(p.hp - dmg, 0, p.maxHp);
    lines.push(
      pick([
        "蓋を開けた瞬間、蒼い火が噴き出した。",
        "罠だ。内側から熱が弾けた。",
        "燐光が弾け、胸元を焼いた。",
      ]),
    );
    lines.push(`${dmg}のダメージを受けた。`);
    if (nh <= 0) {
      return resetToEntrance(
        state.job,
        [...state.log, ...lines],
        state.floor,
        "【手がかり】宝箱にも罠がある。HPが低いときは注意しよう。",
      );
    }
    p = { ...p, hp: nh };
  }

  return { ...state, player: p, log: [...state.log, ...lines] };
}

export function explore(state: GameState): GameState {
  if (state.phase !== "explore") return state;

  const lines: string[] = [];
  const f = state.floor;

  if (f === 10 && state.bossDefeated) {
    if (Math.random() < 0.11) {
      const add = 8 + Math.floor(Math.random() * 12);
      const nh = clamp(state.player.hp + add, 0, state.player.maxHp);
      const up = nh - state.player.hp;
      if (up > 0) {
        lines.push(`底を渡る風が傷を撫でた。HPが${up}回復した。`);
        return { ...state, player: { ...state.player, hp: nh }, log: [...state.log, ...lines] };
      }
    }
    if (Math.random() < 0.09) {
      const add = 4 + Math.floor(Math.random() * 7);
      const nm = clamp(state.player.mp + add, 0, state.player.maxMp);
      const up = nm - state.player.mp;
      if (up > 0) {
        lines.push(`静寂の中、細い光がMPを${up}だけ満たした。`);
        return { ...state, player: { ...state.player, mp: nm }, log: [...state.log, ...lines] };
      }
    }
    lines.push(pick(flavorAbyssCalm()));
    return { ...state, log: [...state.log, ...lines] };
  }

  if (f < 10 && Math.random() < 0.14) {
    lines.push("下へ続く階段を見つけた。");
    return { ...state, stairsVisible: true, log: [...state.log, ...lines] };
  }

  if (f < 10 && Math.random() < 0.048) {
    const msg = pick([
      "泉が湧いている。水を飲んだ。",
      "冷たい泉。体が軽くなった。",
      "光る水たまり。触れたら傷が癒えた。",
      "床に魔法陣が淡く光っている。佇むと力が満ちてきた。",
    ]);
    lines.push(msg);
    const pl = state.player;
    return {
      ...state,
      player: { ...pl, hp: pl.maxHp, mp: pl.maxMp },
      log: [...state.log, ...lines, "HPとMPが全快した。"],
    };
  }

  if (f < 10 && Math.random() < 0.055) {
    const pl = state.player;
    const fh = 0.45 + Math.random() * 0.35;
    const fm = 0.4 + Math.random() * 0.35;
    const nh = clamp(pl.hp + Math.floor(pl.maxHp * fh), 0, pl.maxHp);
    const nm = clamp(pl.mp + Math.floor(pl.maxMp * fm), 0, pl.maxMp);
    if (nh > pl.hp || nm > pl.mp) {
      lines.push(
        pick([
          "壁に刻まれた印が、一瞬だけ体温を上げた。",
          "足元の文様が揺らいだ。魔力が返ってくる。",
          "朽ちた祭壇。そこに手を当てると、力が戻ってきた。",
        ]),
      );
      lines.push(`HP+${nh - pl.hp} MP+${nm - pl.mp}。`);
      return {
        ...state,
        player: { ...pl, hp: nh, mp: nm },
        log: [...state.log, ...lines],
      };
    }
  }

  if (Math.random() < 0.02) {
    lines.push("箱に近づいた。動いた。");
    const enemy = spawnEnemyForFloor(f);
    lines.push(`${enemy.name}が現れた。`);
    return {
      ...state,
      phase: "combat",
      enemy,
      combatMenu: "main",
      exploreMenu: "main",
      bossCombatTurns: 0,
      totalBattlesFought: state.totalBattlesFought + 1,
      log: [...state.log, ...lines],
    };
  }

  if (f < 10 && Math.random() < EXPLORE_TREASURE_CHEST_CHANCE) {
    return openExplorationTreasureChest(state, lines);
  }

  const r = Math.random();

  if (r < 0.3) {
    const enemy = spawnEnemyForFloor(f);
    lines.push(`${enemy.name}が現れた。`);
    return {
      ...state,
      phase: "combat",
      enemy,
      combatMenu: "main",
      exploreMenu: "main",
      bossCombatTurns: 0,
      totalBattlesFought: state.totalBattlesFought + 1,
      log: [...state.log, ...lines],
    };
  }

  if (r < 0.42) {
    const p = addLootItem(state.player, {
      name: ITEM_HERB,
      kind: "restoreHp",
      power: 10,
      count: 1,
    });
    lines.push(`草むらに薬草があった。`);
    return {
      ...state,
      player: p,
      log: [...state.log, ...lines],
    };
  }

  if (r < 0.49) {
    const raw = 2 + Math.floor(Math.random() * 3);
    const soft =
      raw - Math.floor((state.player.armor?.def ?? 0) / 3);
    const dmg = Math.max(1, soft);
    const nh = clamp(state.player.hp - dmg, 0, state.player.maxHp);
    lines.push(`足を滑らせた。${dmg}のダメージ。`);
    if (nh <= 0) {
      return resetToEntrance(
        state.job,
        [...state.log, ...lines],
        state.floor,
        "【手がかり】探索でのダメージも積み重なる。HPが低いときは回復してから動こう。",
      );
    }
    return {
      ...state,
      player: { ...state.player, hp: nh },
      log: [...state.log, ...lines],
    };
  }

  if (r < 0.53) {
    const p = addLootItem(state.player, {
      name: ITEM_MANA_HERB,
      kind: "restoreMp",
      power: 8,
      count: 1,
    });
    lines.push(`湿った壁に芽が出ていた。`);
    return {
      ...state,
      player: p,
      log: [...state.log, ...lines],
    };
  }

  if (r < 0.56) {
    if (Math.random() < 0.58) {
      const p = addLootItem(state.player, {
        name: ITEM_HERB,
        kind: "restoreHp",
        power: 10,
        count: 1,
      });
      lines.push(`欠けた棚に束が残っていた。`);
      return {
        ...state,
        player: p,
        log: [...state.log, ...lines],
      };
    }
    lines.push("欠けた棚。からだった。");
    return { ...state, log: [...state.log, ...lines] };
  }

  if (r < 0.61) {
    lines.push(pick(flavorAmbientDetail(state)));
    return { ...state, log: [...state.log, ...lines] };
  }

  if (r < 0.67) {
    const add = 3 + Math.floor(Math.random() * 7);
    const nm = clamp(state.player.mp + add, 0, state.player.maxMp);
    const up = nm - state.player.mp;
    if (up > 0) {
      lines.push(`湿った空気が肺にしみる。MPが${up}回復した。`);
      return {
        ...state,
        player: { ...state.player, mp: nm },
        log: [...state.log, ...lines],
      };
    }
    lines.push("湿気だけが肌にまとわりついた。");
    return { ...state, log: [...state.log, ...lines] };
  }

  if (r < 0.715) {
    const xp = 2 + Math.floor(Math.random() * 4) + Math.floor(f / 3);
    let pl = state.player;
    pl = { ...pl, exp: pl.exp + xp };
    lines.push(
      pick([
        "床の裂け目から星屑のような粒が浮いた。体が少しだけ覚えた。",
        "通りすぎた燈が、かすかに経験を染めた。",
        "壁の文様が一瞬だけ脈打った。何かが残った気がする。",
      ]),
    );
    lines.push(`経験値を${xp}得た。`);
    const lvLines: string[] = [];
    pl = maybeLevelUp(pl, lvLines);
    lines.push(...lvLines);
    return { ...state, player: pl, log: [...state.log, ...lines] };
  }

  lines.push(pick(flavorQuiet(state)));
  return { ...state, log: [...state.log, ...lines] };
}

export function descendStairs(state: GameState): GameState {
  if (state.phase !== "explore" || !state.stairsVisible) return state;
  if (state.floor >= 10) return state;

  if (!demoAllowsDescendFromFloor(state.floor)) {
    return {
      ...state,
      log: [...state.log, DEMO_DESCEND_BLOCKED_LINE],
    };
  }

  const nf = state.floor + 1;
  const lines = ["階段を下りた。", `${nf}階に着いた。`];

  if (nf === 10 && !state.bossDefeated) {
    const boss = spawnBoss();
    lines.push(
      pick([
        "視界の端で、燈が一つ消えた気がした。",
        "「降り手」と呼ばれる者たちの屑が、床に混ざっている。",
        "盟約の外——地図の余白にそう書かれていた。",
      ]),
    );
    lines.push(
      "粘つく圧が胸を押す。ここが「層底」だ。",
    );
    lines.push(`${boss.name}がいる。`);
    return {
      ...state,
      floor: 10,
      stairsVisible: false,
      phase: "combat",
      enemy: boss,
      combatMenu: "main",
      exploreMenu: "main",
      bossCombatTurns: 0,
      totalBattlesFought: state.totalBattlesFought + 1,
      log: [...state.log, ...lines],
    };
  }

  const pl = state.player;
  const hpRest = Math.min(14, 5 + Math.floor(Math.random() * 7));
  const mpRest = Math.min(10, 2 + Math.floor(Math.random() * 5));
  const nh = clamp(pl.hp + hpRest, 0, pl.maxHp);
  const nm = clamp(pl.mp + mpRest, 0, pl.maxMp);
  if (nh > pl.hp || nm > pl.mp) {
    lines.push(
      `踊り場で肩の力を抜いた。（HP+${nh - pl.hp} MP+${nm - pl.mp}）`,
    );
  }

  return {
    ...state,
    floor: nf,
    stairsVisible: false,
    player: { ...pl, hp: nh, mp: nm },
    log: [...state.log, ...lines],
  };
}

export function dismissStairs(state: GameState): GameState {
  if (!state.stairsVisible) return state;
  return {
    ...state,
    stairsVisible: false,
    log: [...state.log, "階段はあとにした。"],
  };
}

/** 調合と所持アイテムの使用をまとめたサブ画面 */
export function openItemsMenu(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  return { ...state, exploreMenu: "items" };
}

/** 調合画面から：武器・防具を素材に分解するサブ画面 */
export function openSmithMenu(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  return { ...state, exploreMenu: "smith" };
}

export function closeSmithMenu(state: GameState): GameState {
  return { ...state, exploreMenu: "items" };
}

export function closeItemsMenu(state: GameState): GameState {
  return { ...state, exploreMenu: "main" };
}

export function openExploreMagicMenu(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  return { ...state, exploreMenu: "magic" };
}

export function closeExploreMagicMenu(state: GameState): GameState {
  return { ...state, exploreMenu: "main" };
}

/** 探索中のみ。回復・職スキルのうち探索可能なものを唱える */
export function exploreMagic(state: GameState, spell: SpellId): GameState {
  if (state.phase !== "explore") return state;
  if (!EXPLORE_CASTABLE_SPELLS.includes(spell)) return state;
  if (!state.player.knownSpells.includes(spell)) return state;

  const cost = SPELLS[spell].mpCost;
  if (state.player.mp < cost) {
    return {
      ...state,
      log: [...state.log, "MPが足りない。"],
    };
  }

  const playerAfterCost = { ...state.player, mp: state.player.mp - cost };
  const lv = playerAfterCost.level;
  const applied = applyExploreSelfSpell(spell, playerAfterCost, lv);
  if (!applied) {
    return {
      ...state,
      player: { ...state.player, mp: state.player.mp },
      log: [...state.log, "その魔法はここでは唱えられない。"],
    };
  }

  return {
    ...state,
    player: applied.player,
    log: [...state.log, ...applied.lines],
  };
}

/** 所持している武器・防具アイテムをすべて捨てる（装備中はインベントリに無いので残る） */
export function discardInventoryWeapons(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  const inv = state.player.inventory;
  const n = inv
    .filter((x) => x.kind === "weapon" || x.kind === "armor")
    .reduce((s, w) => s + w.count, 0);
  if (n === 0) {
    return {
      ...state,
      log: [...state.log, "捨てる武器や防具がない。"],
    };
  }
  const nextInv = sortInventoryItems(
    inv.filter((x) => x.kind !== "weapon" && x.kind !== "armor"),
  );
  return {
    ...state,
    player: { ...state.player, inventory: nextInv },
    log: [...state.log, `所持の武器・防具を${n}件手放した。`],
  };
}

function dismantleExpYield(power: number): number {
  const t = Math.max(1, power);
  return 5 + t * 2 + Math.floor(Math.random() * (4 + Math.min(4, Math.floor(t / 3))));
}

/** 探索・かばん内の武器または防具1スタック分を砕き、経験値に変える */
export function dismantleInventoryEquip(
  state: GameState,
  itemIndex: number,
): GameState {
  if (state.phase !== "explore") return state;
  const item = state.player.inventory[itemIndex];
  if (!item || (item.kind !== "weapon" && item.kind !== "armor")) {
    return state;
  }

  const inv = removeOneItem(state.player.inventory, itemIndex);
  const xp = dismantleExpYield(item.power);
  let p: Player = { ...state.player, inventory: inv, exp: state.player.exp + xp };
  const kindJa = item.kind === "weapon" ? "武器" : "防具";
  const lines: string[] = [
    `${kindJa}「${item.name}」を砕いた。経験値を${xp}得た。`,
  ];
  p = maybeLevelUp(p, lines);
  return {
    ...state,
    player: p,
    log: [...state.log, ...lines],
  };
}

function findBestWeaponInventoryIndex(inv: InventoryItem[]): number | null {
  let bestI: number | null = null;
  let bestP = -1;
  let bestName = "";
  for (let i = 0; i < inv.length; i++) {
    const it = inv[i]!;
    if (it.kind !== "weapon") continue;
    if (
      it.power > bestP ||
      (it.power === bestP && it.name.localeCompare(bestName, "ja") < 0)
    ) {
      bestP = it.power;
      bestName = it.name;
      bestI = i;
    }
  }
  return bestI;
}

function findBestArmorInventoryIndex(inv: InventoryItem[]): number | null {
  let bestI: number | null = null;
  let bestP = -1;
  let bestName = "";
  for (let i = 0; i < inv.length; i++) {
    const it = inv[i]!;
    if (it.kind !== "armor") continue;
    if (
      it.power > bestP ||
      (it.power === bestP && it.name.localeCompare(bestName, "ja") < 0)
    ) {
      bestP = it.power;
      bestName = it.name;
      bestI = i;
    }
  }
  return bestI;
}

/** かばんに、いま装備より強い武器・防具があるか（最強装備ボタン用） */
export function canUpgradeGearFromInventory(player: Player): boolean {
  const wIdx = findBestWeaponInventoryIndex(player.inventory);
  const wOk =
    wIdx !== null &&
    (player.weapon === null ||
      player.inventory[wIdx]!.power > player.weapon.atk);
  const aIdx = findBestArmorInventoryIndex(player.inventory);
  const aOk =
    aIdx !== null &&
    (player.armor === null ||
      player.inventory[aIdx]!.power > player.armor.def);
  return wOk || aOk;
}

/** かばんと身に着けたもののうち、攻撃・防御が最大の武器と防具を装備する */
export function equipBestGearFromInventory(state: GameState): GameState {
  if (state.phase !== "explore") return state;

  const lines: string[] = [];
  let g: GameState = state;

  const wIdx = findBestWeaponInventoryIndex(g.player.inventory);
  if (
    wIdx !== null &&
    (g.player.weapon === null ||
      g.player.inventory[wIdx]!.power > g.player.weapon.atk)
  ) {
    const r = equipWeaponFromInventoryPlayer(g.player, wIdx);
    if (r) {
      lines.push(r.line);
      g = { ...g, player: r.player };
    }
  }

  const aIdx = findBestArmorInventoryIndex(g.player.inventory);
  if (
    aIdx !== null &&
    (g.player.armor === null ||
      g.player.inventory[aIdx]!.power > g.player.armor.def)
  ) {
    const r = equipArmorFromInventoryPlayer(g.player, aIdx);
    if (r) {
      lines.push(r.line);
      g = { ...g, player: r.player };
    }
  }

  if (lines.length === 0) {
    return {
      ...g,
      log: [
        ...g.log,
        "かばんの中では、いま身につけているもの以上に強い武器も防具もない。",
      ],
    };
  }

  return { ...g, log: [...state.log, ...lines] };
}

function craft(
  state: GameState,
  materialName: string,
  resultName: string,
  resultKind: ItemKind,
  resultPower: number,
  okLine: string,
): GameState {
  if (state.phase !== "explore") return state;
  if (countByName(state.player.inventory, materialName) < CRAFT_COST) {
    return {
      ...state,
      log: [...state.log, "材料が足りない。"],
    };
  }
  const consumed = consumeNamed(
    state.player.inventory,
    materialName,
    CRAFT_COST,
  );
  if (!consumed) {
    return {
      ...state,
      log: [...state.log, "材料が足りない。"],
    };
  }
  let p: Player = {
    ...state.player,
    inventory: consumed,
  };
  p = addLootItem(p, {
    name: resultName,
    kind: resultKind,
    power: resultPower,
    count: 1,
  });
  return {
    ...state,
    player: p,
    log: [...state.log, okLine],
  };
}

export function craftMinorHpPotion(state: GameState): GameState {
  return craft(
    state,
    ITEM_HERB,
    ITEM_POTION_MINOR,
    "restoreHp",
    28,
    "薬草を束ねて初級ポーションにした。",
  );
}

export function craftMinorMpPotion(state: GameState): GameState {
  return craft(
    state,
    ITEM_MANA_HERB,
    ITEM_MANA_POTION_MINOR,
    "restoreMp",
    22,
    "魔力草を束ねて初級魔力ポーションにした。",
  );
}

export function craftMediumHpPotion(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  if (countByName(state.player.inventory, ITEM_POTION_MINOR) < CRAFT_COST) {
    return {
      ...state,
      log: [...state.log, "初級ポーションが足りない。"],
    };
  }
  const consumed = consumeNamed(
    state.player.inventory,
    ITEM_POTION_MINOR,
    CRAFT_COST,
  );
  if (!consumed) {
    return {
      ...state,
      log: [...state.log, "初級ポーションが足りない。"],
    };
  }
  let p: Player = {
    ...state.player,
    inventory: consumed,
  };
  p = addLootItem(p, {
    name: ITEM_POTION_MEDIUM,
    kind: "restoreHp",
    power: POTION_MEDIUM_HP_POWER,
    count: 1,
  });
  return {
    ...state,
    player: p,
    log: [...state.log, "初級ポーションを5つ練り直し、中級ポーションにした。"],
  };
}

export function craftMediumMpPotion(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  if (countByName(state.player.inventory, ITEM_MANA_POTION_MINOR) < CRAFT_COST) {
    return {
      ...state,
      log: [...state.log, "初級魔力ポーションが足りない。"],
    };
  }
  const consumed = consumeNamed(
    state.player.inventory,
    ITEM_MANA_POTION_MINOR,
    CRAFT_COST,
  );
  if (!consumed) {
    return {
      ...state,
      log: [...state.log, "初級魔力ポーションが足りない。"],
    };
  }
  let p: Player = {
    ...state.player,
    inventory: consumed,
  };
  p = addLootItem(p, {
    name: ITEM_MANA_POTION_MEDIUM,
    kind: "restoreMp",
    power: POTION_MEDIUM_MP_POWER,
    count: 1,
  });
  return {
    ...state,
    player: p,
    log: [
      ...state.log,
      "初級魔力ポーションを5つ練り直し、中級魔力ポーションにした。",
    ],
  };
}

function endCombatVictory(state: GameState, lines: string[]): GameState {
  let player = { ...state.player };
  const enemy = state.enemy!;
  const wasBoss = enemy.isBoss;
  const turns = state.bossCombatTurns;

  player.exp += enemy.expReward;
  lines.push(`${enemy.name}を倒した。`);
  if (wasBoss) {
    lines.push(`${turns}ターンかかった。`);
  }
  lines.push(`経験値を${enemy.expReward}得た。`);
  player = maybeLevelUp(player, lines);
  if (!wasBoss) {
    player = rollDrops(player, lines, state.floor, enemy.templateKey);
  } else {
    player = rollBossLoot(player, lines);
  }

  if (wasBoss) {
    lines.push(
      `【今回の称号】「${runClearEpithet({
        ...state,
        player,
        phase: "cleared",
        enemy: null,
        bossDefeated: true,
      })}」`,
    );
  }

  lines.push(
    `戦闘後: HP ${player.hp}/${player.maxHp}、MP ${player.mp}/${player.maxMp}。`,
  );

  return {
    ...state,
    phase: wasBoss ? "cleared" : "explore",
    enemy: null,
    combatMenu: "main",
    bossCombatTurns: 0,
    bossDefeated: wasBoss ? true : state.bossDefeated,
    player,
    log: [...state.log, ...lines],
    pendingClientEvent: wasBoss
      ? { type: "boss_clear", job: state.job }
      : null,
  };
}

function enemyTurn(state: GameState, lines: string[]): GameState {
  const enemy = state.enemy;
  if (!enemy || enemy.hp <= 0) return state;
  const frozen = enemy.frozenTurns ?? 0;
  if (frozen > 0) {
    lines.push(`${enemy.name}は動けない。`);
    const nextEnemy: EnemyInstance = {
      ...enemy,
      frozenTurns: frozen - 1,
    };
    if (nextEnemy.frozenTurns === 0) delete nextEnemy.frozenTurns;
    return {
      ...state,
      enemy: nextEnemy,
      log: [...state.log, ...lines],
    };
  }
  if (Math.random() < ENEMY_ATTACK_MISS_CHANCE) {
    lines.push(`${enemy.name}の攻撃。外れた。`);
    return {
      ...state,
      log: [...state.log, ...lines],
    };
  }
  const hpRatio = enemy.hp / enemy.maxHp;
  const enraged =
    enemy.isBoss && hpRatio > 0 && hpRatio <= BOSS_ENRAGE_HP_RATIO;
  let dmg = rollEnemyDamage(enemy.atk);
  if (enraged) {
    dmg = Math.max(1, Math.floor(dmg * BOSS_ENRAGE_DAMAGE_MUL));
    if (Math.random() < 0.38) {
      lines.push("主の一撃が重い。");
    }
  }
  dmg = mitigateDamageWithArmor(dmg, state.player.armor);
  if (state.player.armor?.special === "aegis" && Math.random() < 0.12) {
    dmg = Math.max(1, Math.floor(dmg * 0.5));
    lines.push("堅壳が一瞬だけ光り、衝撃を散らした。");
  }
  const newHp = clamp(state.player.hp - dmg, 0, state.player.maxHp);
  lines.push(`${enemy.name}の攻撃。${dmg}のダメージ。`);
  if (newHp <= 0) {
    return resetToEntrance(
      state.job,
      [...state.log, ...lines],
      state.floor,
      deathHintAfterCombat(state),
    );
  }

  let playerNext = { ...state.player, hp: newHp };
  let enemyNext: EnemyInstance = { ...enemy };

  if (dmg > 0 && playerNext.armor?.special === "regen") {
    const h = 1 + Math.floor(Math.random() * 2);
    const nh = clamp(playerNext.hp + h, 0, playerNext.maxHp);
    if (nh > playerNext.hp) {
      lines.push(`滴血が傷を塞いだ。HPが${nh - playerNext.hp}回復した。`);
      playerNext = { ...playerNext, hp: nh };
    }
  }

  if (
    dmg > 0 &&
    playerNext.armor?.special === "thorns" &&
    enemyNext.hp > 0
  ) {
    const td = Math.max(
      1,
      Math.floor((playerNext.armor?.def ?? 0) * 0.2) +
        (Math.random() < 0.35 ? 1 : 0),
    );
    enemyNext = {
      ...enemyNext,
      hp: clamp(enemyNext.hp - td, 0, enemyNext.maxHp),
    };
    lines.push(`棘甲が牙を返し、${td}のダメージ。`);
    if (enemyNext.hp <= 0) {
      return endCombatVictory(
        { ...state, player: playerNext, enemy: enemyNext },
        lines,
      );
    }
    enemyNext = enemyNext.isBoss
      ? applyBossHpMilestones(enemyNext, lines)
      : enemyNext;
  }

  return {
    ...state,
    player: playerNext,
    enemy: enemyNext,
    log: [...state.log, ...lines],
  };
}

export function combatFight(state: GameState): GameState {
  if (state.phase !== "combat" || !state.enemy) return state;
  const s = withBossTurnIncrement(state);
  const lines: string[] = [];
  const enemy = { ...s.enemy! };
  let player = s.player;

  if (Math.random() < PLAYER_ATTACK_MISS_CHANCE) {
    lines.push("ミスした。");
    const next: GameState = { ...s, enemy, log: [...s.log, ...lines] };
    return enemyTurn(next, []);
  }

  let totalDealt = 0;

  let dmg = rollPhysicalDamage(player, enemy.def, s.job);
  if (Math.random() < playerCritChance(player)) {
    dmg = Math.max(1, Math.floor(dmg * 2));
    lines.push("会心の一撃。");
  }
  enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
  totalDealt += dmg;
  lines.push(`${dmg}のダメージを与えた。`);

  if (
    player.weapon?.special === "twin" &&
    enemy.hp > 0 &&
    Math.random() < 0.22
  ) {
    let dmg2 = rollPhysicalDamage(player, enemy.def, s.job);
    if (Math.random() < playerCritChance(player)) {
      dmg2 = Math.max(1, Math.floor(dmg2 * 2));
      lines.push("会心の追撃。");
    }
    dmg2 = Math.max(1, Math.floor(dmg2 * 0.55));
    enemy.hp = clamp(enemy.hp - dmg2, 0, enemy.maxHp);
    totalDealt += dmg2;
    lines.push(`連閃。さらに${dmg2}のダメージ。`);
  }

  if (player.weapon?.special === "vampiric" && totalDealt > 0) {
    const leech = Math.max(
      1,
      Math.floor(totalDealt * 0.12 + Math.floor(Math.random() * 2)),
    );
    const nh = clamp(player.hp + leech, 0, player.maxHp);
    if (nh > player.hp) {
      lines.push(`吸命でHPが${nh - player.hp}回復した。`);
      player = { ...player, hp: nh };
    }
  }

  if (enemy.hp <= 0) {
    return endCombatVictory({ ...s, player, enemy }, lines);
  }
  const bossed = enemy.isBoss ? applyBossHpMilestones(enemy, lines) : enemy;
  const next: GameState = {
    ...s,
    player,
    enemy: bossed,
    log: [...s.log, ...lines],
  };
  return enemyTurn(next, []);
}

export function combatMagic(state: GameState, spell: SpellId): GameState {
  if (state.phase !== "combat" || !state.enemy) return state;
  if (!state.player.knownSpells.includes(spell)) return state;

  const cost = SPELLS[spell].mpCost;
  if (state.player.mp < cost) {
    return {
      ...state,
      log: [...state.log, "MPが足りない。"],
    };
  }

  const s = withBossTurnIncrement(state);
  const playerAfterCost = { ...s.player, mp: s.player.mp - cost };
  const enemy = { ...s.enemy! };
  const result = runCombatSpell(spell, {
    player: playerAfterCost,
    enemy,
    floor: state.floor,
    lv: playerAfterCost.level,
    job: s.job,
  });

  if (result.enemy.hp <= 0) {
    return endCombatVictory(
      {
        ...s,
        player: result.player,
        enemy: result.enemy,
      },
      result.lines,
    );
  }

  const bossed = result.enemy.isBoss
    ? applyBossHpMilestones(result.enemy, result.lines)
    : result.enemy;
  const next: GameState = {
    ...s,
    player: result.player,
    enemy: bossed,
    combatMenu: "main",
    log: [...s.log, ...result.lines],
  };
  return enemyTurn(next, []);
}

function removeOneItem(inv: InventoryItem[], index: number): InventoryItem[] {
  const it = inv[index];
  if (!it) return inv;
  let next: InventoryItem[];
  if (it.count > 1) {
    next = inv.map((x, i) =>
      i === index ? { ...x, count: x.count - 1 } : x,
    );
  } else {
    next = inv.filter((_, i) => i !== index);
  }
  return sortInventoryItems(next);
}

function equipWeaponFromInventoryPlayer(
  player: Player,
  itemIndex: number,
): { player: Player; line: string } | null {
  const item = player.inventory[itemIndex];
  if (!item || item.kind !== "weapon") return null;

  const inv = removeOneItem(player.inventory, itemIndex);
  const old = player.weapon;
  let p: Player = {
    ...player,
    inventory: inv,
    weapon: {
      fullName: item.name,
      atk: item.power,
      category: item.weaponCategory ?? "sword",
      special: item.weaponSpecial ?? "none",
    },
  };
  const parts: string[] = [`${item.name}を装備した。`];
  if (old) {
    p = addLootItem(p, {
      name: old.fullName,
      kind: "weapon",
      power: old.atk,
      count: 1,
      weaponCategory: old.category,
      weaponSpecial: old.special,
    });
    parts.push(`手放した${old.fullName}は所持品に入れた。`);
  }
  return { player: p, line: parts.join("") };
}

function equipArmorFromInventoryPlayer(
  player: Player,
  itemIndex: number,
): { player: Player; line: string } | null {
  const item = player.inventory[itemIndex];
  if (!item || item.kind !== "armor") return null;

  const inv = removeOneItem(player.inventory, itemIndex);
  const old = player.armor;
  let p: Player = {
    ...player,
    inventory: inv,
    armor: {
      fullName: item.name,
      def: item.power,
      category: item.armorCategory ?? "leather",
      special: item.armorSpecial ?? "none",
    },
  };
  const parts: string[] = [`${item.name}を装備した。`];
  if (old) {
    p = addLootItem(p, {
      name: old.fullName,
      kind: "armor",
      power: old.def,
      count: 1,
      armorCategory: old.category,
      armorSpecial: old.special,
    });
    parts.push(`外した${old.fullName}は所持品に入れた。`);
  }
  return { player: p, line: parts.join("") };
}

export function useItemExplore(state: GameState, itemIndex: number): GameState {
  if (state.phase !== "explore") return state;
  const item = state.player.inventory[itemIndex];
  if (!item) return state;

  if (item.kind === "weapon") {
    const r = equipWeaponFromInventoryPlayer(state.player, itemIndex);
    if (!r) return state;
    return { ...state, player: r.player, log: [...state.log, r.line] };
  }

  if (item.kind === "armor") {
    const r = equipArmorFromInventoryPlayer(state.player, itemIndex);
    if (!r) return state;
    return { ...state, player: r.player, log: [...state.log, r.line] };
  }

  const inv = removeOneItem(state.player.inventory, itemIndex);
  let player = { ...state.player, inventory: inv };
  const lines: string[] = [];

  if (item.kind === "restoreHp") {
    const nh = clamp(player.hp + item.power, 0, player.maxHp);
    const up = nh - player.hp;
    lines.push(
      `${item.name}を使った。${up > 0 ? `HPが${up}回復した。` : "変わらなかった。"}`,
    );
    player = { ...player, hp: nh };
  } else {
    const nm = clamp(player.mp + item.power, 0, player.maxMp);
    const up = nm - player.mp;
    lines.push(
      `${item.name}を口にした。${up > 0 ? `MPが${up}回復した。` : "変わらなかった。"}`,
    );
    player = { ...player, mp: nm };
  }

  return {
    ...state,
    player,
    log: [...state.log, ...lines],
  };
}

export function combatItem(state: GameState, itemIndex: number): GameState {
  if (state.phase !== "combat" || !state.enemy) return state;
  const item = state.player.inventory[itemIndex];
  if (!item) return state;

  const s = withBossTurnIncrement(state);

  if (item.kind === "weapon") {
    const r = equipWeaponFromInventoryPlayer(s.player, itemIndex);
    if (!r) return state;
    const next: GameState = {
      ...s,
      player: r.player,
      combatMenu: "main",
      log: [...s.log, r.line],
    };
    return enemyTurn(next, []);
  }

  if (item.kind === "armor") {
    const r = equipArmorFromInventoryPlayer(s.player, itemIndex);
    if (!r) return state;
    const next: GameState = {
      ...s,
      player: r.player,
      combatMenu: "main",
      log: [...s.log, r.line],
    };
    return enemyTurn(next, []);
  }

  const lines: string[] = [];
  const inv = removeOneItem(s.player.inventory, itemIndex);
  let player = { ...s.player, inventory: inv };

  if (item.kind === "restoreHp") {
    const nh = clamp(player.hp + item.power, 0, player.maxHp);
    lines.push(`${item.name}を使った。HPが${nh - player.hp}回復した。`);
    player = { ...player, hp: nh };
  } else {
    const nm = clamp(player.mp + item.power, 0, player.maxMp);
    lines.push(`${item.name}を口にした。MPが${nm - player.mp}回復した。`);
    player = { ...player, mp: nm };
  }

  const next: GameState = {
    ...s,
    player,
    combatMenu: "main",
    log: [...s.log, ...lines],
  };
  return enemyTurn(next, []);
}

export function combatRun(state: GameState): GameState {
  if (state.phase !== "combat" || !state.enemy) return state;
  if (state.enemy.isBoss) {
    return {
      ...state,
      log: [...state.log, "足がすくむ。"],
    };
  }

  const s = withBossTurnIncrement(state);
  const lines: string[] = [];
  if (Math.random() < 0.55) {
    lines.push("離れた。");
    const hpGain = 2 + Math.floor(Math.random() * 4);
    const mpGain = 1 + Math.floor(Math.random() * 3);
    const nh = clamp(s.player.hp + hpGain, 0, s.player.maxHp);
    const nm = clamp(s.player.mp + mpGain, 0, s.player.maxMp);
    const hpUp = nh - s.player.hp;
    const mpUp = nm - s.player.mp;
    if (hpUp > 0 || mpUp > 0) {
      lines.push(
        `息を整えた。${hpUp > 0 ? `HPが${hpUp}回復。` : ""}${mpUp > 0 ? `MPが${mpUp}回復。` : ""}`,
      );
    }
    return {
      ...s,
      phase: "explore",
      enemy: null,
      combatMenu: "main",
      bossCombatTurns: 0,
      player: { ...s.player, hp: nh, mp: nm },
      log: [...s.log, ...lines],
    };
  }
  lines.push("逃げられなかった。");
  const next: GameState = { ...s, log: [...s.log, ...lines] };
  return enemyTurn(next, []);
}
