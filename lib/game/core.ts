import {
  BOSS_TEMPLATE,
  CRAFT_COST,
  ITEM_HERB,
  ITEM_MANA_HERB,
  ITEM_MANA_POTION_MINOR,
  ITEM_POTION_MINOR,
  SPELL_BOOKS,
  SPELLS,
  WEAPON_BASES,
  WEAPON_PREFIXES,
  nextItemId,
  resetItemIdCounter,
  templatesForFloor,
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function expToNext(level: number): number {
  return 8 + level * 6;
}

function mergeInventory(inv: InventoryItem[], add: InventoryItem): InventoryItem[] {
  const match = inv.find(
    (x) =>
      x.name === add.name && x.kind === add.kind && x.power === add.power,
  );
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

function rollPhysicalDamage(player: Player, enemyDef: number): number {
  const w = player.weapon?.atk ?? 0;
  const raw = player.baseAtk + w - enemyDef + Math.floor(Math.random() * 3);
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
  for (let n = 0; n < 48; n++) {
    const base = pick(WEAPON_BASES);
    const pre = pick(WEAPON_PREFIXES);
    const atk = base.atk + pre.atk;
    if (atk >= 1) {
      return { fullName: `${pre.label}${base.name}`, atk };
    }
  }
  return { fullName: "木片の短剣", atk: 1 };
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
  return {
    ...player,
    inventory: mergeInventory(player.inventory, stack),
  };
}

function rollDrops(player: Player, lines: string[]): Player {
  let p = { ...player, inventory: [...player.inventory] };

  if (Math.random() < 0.42) {
    const w = generateWeapon();
    const old = p.weapon;
    p.weapon = w;
    lines.push(`${w.fullName}を手に入れた。`);
    if (old) {
      lines.push(`以前の武器は置いていった。`);
    }
  }

  if (Math.random() < 0.35) {
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

  if (Math.random() < 0.4) {
    p = addLootItem(p, {
      name: ITEM_HERB,
      kind: "restoreHp",
      power: 10,
      count: 1,
    });
    lines.push(`薬草を拾った。苦い。`);
  }

  if (Math.random() < 0.22) {
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

function withBossTurnIncrement(state: GameState): GameState {
  if (!state.enemy?.isBoss) return state;
  return { ...state, bossCombatTurns: state.bossCombatTurns + 1 };
}

export function explore(state: GameState): GameState {
  if (state.phase !== "explore") return state;
  if (state.stairsVisible) return state;

  const lines: string[] = [];
  const f = state.floor;

  if (f === 10 && state.bossDefeated) {
    lines.push(
      pick([
        "静かだ。",
        "風が止んでいる。",
        "もう敵はいない。",
        "底に着いた気がする。",
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

  if (r < 0.63) {
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

  return {
    ...state,
    floor: nf,
    stairsVisible: false,
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
    player = rollDrops(player, lines);
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

  if (Math.random() < PLAYER_ATTACK_MISS_CHANCE) {
    lines.push("ミスした。");
    const next: GameState = { ...s, enemy, log: [...s.log, ...lines] };
    return enemyTurn(next, []);
  }

  let dmg = rollPhysicalDamage(s.player, enemy.def);
  if (Math.random() < PLAYER_CRIT_CHANCE) {
    dmg = Math.max(1, Math.floor(dmg * 2));
    lines.push("会心の一撃。");
  }
  enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
  lines.push(`${dmg}のダメージを与えた。`);
  if (enemy.hp <= 0) {
    return endCombatVictory({ ...s, enemy }, lines);
  }
  const next: GameState = { ...s, enemy, log: [...s.log, ...lines] };
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

  if (spell === "ember") {
    const dmg = 4 + Math.floor(Math.random() * 4) + Math.floor(player.level / 2);
    enemy.hp = clamp(enemy.hp - dmg, 0, enemy.maxHp);
    lines.push(`小火を放った。${dmg}のダメージ。`);
  } else {
    const heal = 8 + Math.floor(Math.random() * 5) + Math.floor(player.level / 2);
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

export function useItemExplore(state: GameState, itemIndex: number): GameState {
  if (state.phase !== "explore") return state;
  const item = state.player.inventory[itemIndex];
  if (!item) return state;

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
    return {
      ...s,
      phase: "explore",
      enemy: null,
      combatMenu: "main",
      bossCombatTurns: 0,
      log: [...s.log, ...lines],
    };
  }
  lines.push("逃げられなかった。");
  const next: GameState = { ...s, log: [...s.log, ...lines] };
  return enemyTurn(next, []);
}
