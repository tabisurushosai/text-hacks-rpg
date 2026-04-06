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
  SPELL_BOOKS,
  SPELL_ELEMENT,
  SPELLS,
  WEAPON_BASES,
  WEAPON_PREFIXES,
  nextItemId,
  resetItemIdCounter,
  rollWeaponSpecial,
  templatesForFloor,
  WEAPON_SPECIAL_LABEL,
} from "./data";
import {
  flavorAmbientDetail,
  flavorAbyssCalm,
  flavorQuiet,
} from "./exploreFlavor";
import { LORE_INTRO_DESCENDER } from "./lore";
import type {
  EnemyInstance,
  GameState,
  InventoryItem,
  ItemKind,
  Player,
  SpellElement,
  SpellId,
  Weapon,
} from "./types";

export function inventoryActionLabel(it: InventoryItem): string {
  const head = it.kind === "weapon" ? "装備" : "使う";
  return `${head}：${it.count > 1 ? `${it.name}×${it.count}` : it.name}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function expToNext(level: number): number {
  return 8 + level * 6;
}

/** UI 用：次のレベルまでに必要な経験値の残り */
export function expUntilLevelUp(player: Player): number {
  return expToNext(player.level) - player.exp;
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
  return true;
}

/** 回復品は power（回復量）の大きい順、武器は攻撃力の大きい順、そのあと名前 */
function sortInventoryItems(inv: InventoryItem[]): InventoryItem[] {
  return [...inv].sort((a, b) => {
    const tier = (it: InventoryItem) => (it.kind === "weapon" ? 1 : 0);
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 0) {
      if (b.power !== a.power) return b.power - a.power;
      if (a.kind !== b.kind) return a.kind === "restoreHp" ? -1 : 1;
      return a.name.localeCompare(b.name, "ja");
    }
    if (b.power !== a.power) return b.power - a.power;
    return a.name.localeCompare(b.name, "ja");
  });
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

export function initialPlayer(): Player {
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
    knownSpells: [],
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

export function initialGameState(): GameState {
  return {
    phase: "explore",
    player: initialPlayer(),
    enemy: null,
    combatMenu: "main",
    floor: 1,
    stairsVisible: false,
    bossDefeated: false,
    exploreMenu: "main",
    bossCombatTurns: 0,
    totalBattlesFought: 0,
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
  return "【手がかり】武器の攻撃力や特殊効果（吸命・心眼など）を見直し、落とし物を見逃していないか確かめよう。";
}

function resetToEntrance(prevLog: string[], hint?: string | null): GameState {
  const tail = [...prevLog, "力尽きた。", "気がつくと入り口にいた。"];
  if (hint) tail.push(hint);
  return {
    ...initialGameState(),
    log: tail,
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

function weaponPierceFlat(player: Player): number {
  return player.weapon?.special === "piercing" ? 2 : 0;
}

function playerCritChance(player: Player): number {
  const bonus = player.weapon?.special === "keen" ? 0.08 : 0;
  return Math.min(0.42, PLAYER_CRIT_CHANCE + bonus);
}

function rollPhysicalDamage(player: Player, enemyDef: number): number {
  const w = player.weapon?.atk ?? 0;
  const pierce = weaponPierceFlat(player);
  const effDef = Math.max(0, enemyDef - pierce);
  const raw = player.baseAtk + w - effDef + Math.floor(Math.random() * 3);
  return clamp(raw, 1, 999);
}

const PLAYER_ATTACK_MISS_CHANCE = 0.05;
const ENEMY_ATTACK_MISS_CHANCE = 0.15;
const PLAYER_CRIT_CHANCE = 0.1;

function rollEnemyDamage(enemyAtk: number): number {
  const raw = enemyAtk + Math.floor(Math.random() * 2);
  return clamp(raw, 1, 999);
}

function maybeLevelUp(player: Player, lines: string[]): Player {
  const p = { ...player };
  let need = expToNext(p.level);
  while (p.exp >= need) {
    p.exp -= need;
    p.level += 1;
    p.maxHp += 5;
    p.maxMp += 3;
    p.baseAtk += 1;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    lines.push(`レベルが上がった。Lv${p.level}。`);
    need = expToNext(p.level);
  }
  return p;
}

function generateWeapon(): Weapon {
  for (let n = 0; n < 64; n++) {
    const base = pick(WEAPON_BASES);
    const pre = pick(WEAPON_PREFIXES);
    const atk = base.atk + pre.atk;
    if (atk >= 1) {
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
  return {
    ...player,
    inventory: mergeInventory(player.inventory, stack),
  };
}

function rollDrops(player: Player, lines: string[], floor: number): Player {
  let p = { ...player, inventory: [...player.inventory] };

  const weaponChance = Math.min(0.52, 0.36 + floor * 0.014);
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
  }

  const bookChance = Math.min(0.46, 0.32 + Math.max(0, floor - 1) * 0.018);
  if (Math.random() < bookChance) {
    const book = pick(SPELL_BOOKS);
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

  if (Math.random() < Math.min(0.48, 0.38 + floor * 0.012)) {
    p = addLootItem(p, {
      name: ITEM_HERB,
      kind: "restoreHp",
      power: 10,
      count: 1,
    });
    lines.push(`薬草を拾った。苦い。`);
  }

  if (Math.random() < Math.min(0.3, 0.2 + floor * 0.012)) {
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

  return p;
}

function withBossTurnIncrement(state: GameState): GameState {
  if (!state.enemy?.isBoss) return state;
  return { ...state, bossCombatTurns: state.bossCombatTurns + 1 };
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
        lines.push(`静寂の中、星屑のような光がMPを${up}だけ満たした。`);
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
    const dmg = 2 + Math.floor(Math.random() * 3);
    const nh = clamp(state.player.hp - dmg, 0, state.player.maxHp);
    lines.push(`足を滑らせた。${dmg}のダメージ。`);
    if (nh <= 0) {
      return resetToEntrance(
        [...state.log, ...lines],
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
    if (Math.random() < 0.5) {
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

  lines.push(pick(flavorQuiet(state)));
  return { ...state, log: [...state.log, ...lines] };
}

export function descendStairs(state: GameState): GameState {
  if (state.phase !== "explore" || !state.stairsVisible) return state;
  if (state.floor >= 10) return state;

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

const EXPLORE_HEAL_SPELLS: SpellId[] = ["heal_soft", "heal_solid"];

/** 探索中のみ。回復魔法（癒し・大癒）を唱える */
export function exploreMagic(state: GameState, spell: SpellId): GameState {
  if (state.phase !== "explore") return state;
  if (!EXPLORE_HEAL_SPELLS.includes(spell)) return state;
  if (!state.player.knownSpells.includes(spell)) return state;

  const cost = SPELLS[spell].mpCost;
  if (state.player.mp < cost) {
    return {
      ...state,
      log: [...state.log, "MPが足りない。"],
    };
  }

  let player = { ...state.player, mp: state.player.mp - cost };
  const lines: string[] = [];
  const lv = player.level;

  if (spell === "heal_soft") {
    const heal =
      10 + Math.floor(Math.random() * 6) + Math.floor(lv * 0.75);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    lines.push(`癒しを唱えた。HPが${nh - player.hp}回復した。`);
    player = { ...player, hp: nh };
  } else {
    const heal =
      22 + Math.floor(Math.random() * 11) + Math.floor(lv * 1.35);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    lines.push(`大癒を唱えた。HPが${nh - player.hp}回復した。`);
    player = { ...player, hp: nh };
  }

  return {
    ...state,
    player,
    log: [...state.log, ...lines],
  };
}

/** 所持している武器アイテムをすべて捨てる（装備中はインベントリに無いので残る） */
export function discardInventoryWeapons(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  const inv = state.player.inventory;
  const weapons = inv.filter((x) => x.kind === "weapon");
  const n = weapons.reduce((s, w) => s + w.count, 0);
  if (n === 0) {
    return {
      ...state,
      log: [...state.log, "捨てる武器がない。"],
    };
  }
  const nextInv = sortInventoryItems(inv.filter((x) => x.kind !== "weapon"));
  return {
    ...state,
    player: { ...state.player, inventory: nextInv },
    log: [...state.log, `所持の武器を${n}件手放した。`],
  };
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
    player = rollDrops(player, lines, state.floor);
  } else {
    player = rollBossLoot(player, lines);
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
  const newHp = clamp(state.player.hp - dmg, 0, state.player.maxHp);
  lines.push(`${enemy.name}の攻撃。${dmg}のダメージ。`);
  if (newHp <= 0) {
    return resetToEntrance(
      [...state.log, ...lines],
      deathHintAfterCombat(state),
    );
  }
  return {
    ...state,
    player: { ...state.player, hp: newHp },
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

  let dmg = rollPhysicalDamage(player, enemy.def);
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
    let dmg2 = rollPhysicalDamage(player, enemy.def);
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

function applyElementalMagicDamage(
  lines: string[],
  enemy: EnemyInstance,
  spell: SpellId,
  rawDmg: number,
): void {
  let dmg = rawDmg;
  const el = SPELL_ELEMENT[spell];
  if (el && enemy.weakness === el) {
    dmg = Math.floor(dmg * 1.52);
    lines.push("弱点を突いた！");
  }
  enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
  lines.push(`${dmg}のダメージ。`);
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
  const lines: string[] = [];
  let player = { ...s.player, mp: s.player.mp - cost };
  const enemy = { ...s.enemy! };
  const floor = state.floor;
  const lv = player.level;

  if (spell === "fire_jolt") {
    const raw =
      8 +
      Math.floor(Math.random() * 7) +
      Math.floor(lv * 1.45) +
      Math.floor(floor * 0.42);
    const pierce = Math.floor(enemy.def * 0.42);
    const dmg = Math.max(2, raw - pierce);
    lines.push("火矢を放った。");
    applyElementalMagicDamage(lines, enemy, spell, dmg);
  } else if (spell === "fire_blast") {
    const raw =
      15 +
      Math.floor(Math.random() * 9) +
      Math.floor(lv * 2.05) +
      Math.floor(floor * 0.52);
    const dmg = Math.max(4, raw);
    lines.push("業火が敵を包んだ。");
    applyElementalMagicDamage(lines, enemy, spell, dmg);
  } else if (spell === "ice_shard") {
    const raw =
      5 +
      Math.floor(Math.random() * 6) +
      Math.floor(lv * 1.05) +
      Math.floor(floor * 0.32);
    const pierce = Math.floor(enemy.def * 0.22);
    const dmg = Math.max(2, raw - pierce);
    lines.push("氷片を叩きつけた。");
    applyElementalMagicDamage(lines, enemy, spell, dmg);
    tryApplyStun(lines, enemy, 0.48, 2, 4, 0.24, 1);
  } else if (spell === "ice_wrath") {
    const raw =
      11 +
      Math.floor(Math.random() * 8) +
      Math.floor(lv * 1.75) +
      Math.floor(floor * 0.48);
    const pierce = Math.floor(enemy.def * 0.3);
    const dmg = Math.max(3, raw - pierce);
    lines.push("凍嵐を巻き起こした。");
    applyElementalMagicDamage(lines, enemy, spell, dmg);
    tryApplyStun(lines, enemy, 0.62, 2, 4, 0.32, 2);
  } else if (spell === "volt_needle") {
    const raw =
      3 +
      Math.floor(Math.random() * 4) +
      Math.floor(lv * 0.75) +
      Math.floor(floor * 0.22);
    const dmg = Math.max(1, raw);
    lines.push("細い雷が刺さった。");
    applyElementalMagicDamage(lines, enemy, spell, dmg);
    tryApplyStun(lines, enemy, 0.74, 2, 4, 0.38, 1);
  } else if (spell === "volt_chain") {
    const raw =
      9 +
      Math.floor(Math.random() * 7) +
      Math.floor(lv * 1.35) +
      Math.floor(floor * 0.38);
    const dmg = Math.max(2, raw);
    lines.push("落雷が走った。");
    applyElementalMagicDamage(lines, enemy, spell, dmg);
    tryApplyStun(lines, enemy, 0.86, 3, 4, 0.46, 2);
  } else if (spell === "heal_soft") {
    const heal =
      10 + Math.floor(Math.random() * 6) + Math.floor(lv * 0.75);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    lines.push(`癒しを唱えた。HPが${nh - player.hp}回復した。`);
    player = { ...player, hp: nh };
  } else if (spell === "heal_solid") {
    const heal =
      22 + Math.floor(Math.random() * 11) + Math.floor(lv * 1.35);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    lines.push(`大癒を唱えた。HPが${nh - player.hp}回復した。`);
    player = { ...player, hp: nh };
  }

  if (enemy.hp <= 0) {
    return endCombatVictory({ ...s, player, enemy }, lines);
  }

  const bossed = enemy.isBoss ? applyBossHpMilestones(enemy, lines) : enemy;
  const next: GameState = {
    ...s,
    player,
    enemy: bossed,
    combatMenu: "main",
    log: [...s.log, ...lines],
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

export function useItemExplore(state: GameState, itemIndex: number): GameState {
  if (state.phase !== "explore") return state;
  const item = state.player.inventory[itemIndex];
  if (!item) return state;

  if (item.kind === "weapon") {
    const r = equipWeaponFromInventoryPlayer(state.player, itemIndex);
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
