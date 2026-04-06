import {
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
  SPELLS,
  WEAPON_BASES,
  WEAPON_PREFIXES,
  nextItemId,
  resetItemIdCounter,
  rollWeaponSpecial,
  templatesForFloor,
  WEAPON_SPECIAL_LABEL,
} from "./data";
import type {
  EnemyInstance,
  GameState,
  InventoryItem,
  ItemKind,
  Player,
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

function mergeInventory(inv: InventoryItem[], add: InventoryItem): InventoryItem[] {
  const match = inv.find((x) => inventoryItemsMatch(x, add));
  if (match) {
    return inv.map((x) =>
      x.id === match.id ? { ...x, count: x.count + add.count } : x,
    );
  }
  return [...inv, { ...add, id: add.id || nextItemId(), count: add.count }];
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
  return next;
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
    ],
  };
}

function resetToEntrance(prevLog: string[]): GameState {
  const tail = [...prevLog, "力尽きた。", "気がつくと入り口にいた。"];
  return {
    ...initialGameState(),
    log: tail,
  };
}

function spawnEnemyForFloor(floor: number): EnemyInstance {
  const pool = templatesForFloor(floor);
  const t = pick(pool.length ? pool : templatesForFloor(1));
  return {
    templateKey: t.key,
    name: t.name,
    hp: t.maxHp,
    maxHp: t.maxHp,
    atk: t.atk,
    def: t.def,
    expReward: t.expReward,
  };
}

function spawnBoss(): EnemyInstance {
  const t = BOSS_TEMPLATE;
  return {
    templateKey: t.key,
    name: t.name,
    hp: t.maxHp,
    maxHp: t.maxHp,
    atk: t.atk,
    def: t.def,
    expReward: t.expReward,
    isBoss: true,
  };
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
    lines.push(
      pick([
        "静かだ。",
        "風が止んでいる。",
        "もう敵はいない。",
        "底に着いた気がする。",
        "帰路は長く感じる。",
        "胸の奥がまだ熱い。",
      ]),
    );
    return { ...state, log: [...state.log, ...lines] };
  }

  if (f < 10 && Math.random() < 0.14) {
    lines.push("下へ続く階段を見つけた。");
    return { ...state, stairsVisible: true, log: [...state.log, ...lines] };
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
      return resetToEntrance([...state.log, ...lines]);
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
    lines.push(
      pick([
        "壁に文字がある。読めない。",
        "冷たい風が抜けた。",
        "水滴が落ちた。",
        "指輪が転がっていた。拾わなかった。",
        "蝋が溶けかけている。",
        "誰かの足跡。古い。",
        "釘が刺さっている。触らなかった。",
        "薄い布が床に落ちていた。",
        "かすかにカビの匂い。",
        "遠くで水が滴る音がした。",
      ]),
    );
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

  const quiet = pick([
    "風の音だけが聞こえる。",
    "足元に小石が転がっている。",
    "何も起きなかった。",
    "遠くで鳥の声がした。",
    "息が白くなった。",
    "しばらく立ち止まった。",
    "背中が冷えた。気のせいかもしれない。",
    "小さな虫が這っていった。",
  ]);
  lines.push(quiet);
  return { ...state, log: [...state.log, ...lines] };
}

export function descendStairs(state: GameState): GameState {
  if (state.phase !== "explore" || !state.stairsVisible) return state;
  if (state.floor >= 10) return state;

  const nf = state.floor + 1;
  const lines = ["階段を下りた。", `${nf}階に着いた。`];

  if (nf === 10 && !state.bossDefeated) {
    const boss = spawnBoss();
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

export function openCraftMenu(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  return { ...state, exploreMenu: "craft" };
}

export function closeCraftMenu(state: GameState): GameState {
  return { ...state, exploreMenu: "main" };
}

export function openUseItemMenu(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  return { ...state, exploreMenu: "use" };
}

export function closeUseItemMenu(state: GameState): GameState {
  return { ...state, exploreMenu: "main" };
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

  return {
    ...state,
    phase: "explore",
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
    lines.push(`${enemy.name}は凍りついている。`);
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
  const dmg = rollEnemyDamage(enemy.atk);
  const newHp = clamp(state.player.hp - dmg, 0, state.player.maxHp);
  lines.push(`${enemy.name}の攻撃。${dmg}のダメージ。`);
  if (newHp <= 0) {
    return resetToEntrance([...state.log, ...lines]);
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
  const next: GameState = { ...s, player, enemy, log: [...s.log, ...lines] };
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
  const lines: string[] = [];
  let player = { ...s.player, mp: s.player.mp - cost };
  const enemy = { ...s.enemy! };
  const floor = state.floor;
  const lv = player.level;

  const applyMagicDamage = (dmg: number, msg: string) => {
    enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
    lines.push(`${msg}${dmg}のダメージ。`);
  };

  if (spell === "ember") {
    const raw =
      8 +
      Math.floor(Math.random() * 7) +
      Math.floor(lv * 1.5) +
      Math.floor(floor * 0.45);
    const pierce = Math.floor(enemy.def * 0.45);
    const dmg = Math.max(2, raw - pierce);
    applyMagicDamage(dmg, "小火を放った。");
  } else if (spell === "fireball") {
    const raw =
      14 +
      Math.floor(Math.random() * 9) +
      Math.floor(lv * 2.1) +
      Math.floor(floor * 0.55);
    const dmg = Math.max(4, raw);
    applyMagicDamage(dmg, "火球が炸裂した。");
  } else if (spell === "spark") {
    const raw =
      4 +
      Math.floor(Math.random() * 5) +
      Math.floor(lv * 0.9) +
      Math.floor(floor * 0.25);
    const dmg = Math.max(2, raw);
    applyMagicDamage(dmg, "雷線が走った。");
  } else if (spell === "thunder") {
    const raw =
      20 +
      Math.floor(Math.random() * 11) +
      Math.floor(lv * 2.6) +
      Math.floor(floor * 0.65);
    const dmg = Math.max(6, raw);
    applyMagicDamage(dmg, "落雷が敵を直撃した。");
  } else if (spell === "frost") {
    const raw =
      5 +
      Math.floor(Math.random() * 6) +
      Math.floor(lv * 1.1) +
      Math.floor(floor * 0.35);
    const pierce = Math.floor(enemy.def * 0.25);
    const dmg = Math.max(2, raw - pierce);
    applyMagicDamage(dmg, "凍霧を浴びせた。");
    if (!enemy.isBoss) {
      if (Math.random() < 0.4) {
        const t = 1 + Math.floor(Math.random() * 3);
        const prev = enemy.frozenTurns ?? 0;
        enemy.frozenTurns = Math.max(prev, t);
        lines.push(`${enemy.name}は身動きがとれない（あと${enemy.frozenTurns}ターン）。`);
      }
    } else if (Math.random() < 0.14) {
      enemy.frozenTurns = Math.max(enemy.frozenTurns ?? 0, 1);
      lines.push(`${enemy.name}の動きが一瞬鈍った。`);
    }
  } else if (spell === "mend") {
    const heal =
      12 +
      Math.floor(Math.random() * 7) +
      Math.floor(lv * 0.85);
    const nh = clamp(player.hp + heal, 0, player.maxHp);
    lines.push(`癒しを唱えた。HPが${nh - player.hp}回復した。`);
    player = { ...player, hp: nh };
  }

  if (enemy.hp <= 0) {
    return endCombatVictory({ ...s, player, enemy }, lines);
  }

  const next: GameState = {
    ...s,
    player,
    enemy,
    combatMenu: "main",
    log: [...s.log, ...lines],
  };
  return enemyTurn(next, []);
}

function removeOneItem(inv: InventoryItem[], index: number): InventoryItem[] {
  const it = inv[index];
  if (!it) return inv;
  if (it.count > 1) {
    return inv.map((x, i) =>
      i === index ? { ...x, count: x.count - 1 } : x,
    );
  }
  return inv.filter((_, i) => i !== index);
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
