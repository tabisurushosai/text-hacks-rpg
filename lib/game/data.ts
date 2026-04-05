import type {
  EnemyTemplate,
  InventoryItem,
  SpellId,
  Weapon,
  WeaponCategory,
  WeaponSpecial,
} from "./types";

/** 階ごとに5種。下の階ほど数値が上がる。 */
export const FLOOR_NAMES: Record<number, string[]> = {
  1: ["苔スライム", "小蝙蝠", "湿った鼠", "地衣虫", "薄い菌"],
  2: ["穴コウモリ", "粘性スライム", "欠けた骨", "塵の塊", "小蜈蚣"],
  3: ["洞蜘蛛", "泥蛙", "硬い鼠", "腐葉虫", "胞子の膜"],
  4: ["影蝙蝠", "石コウモリ", "沼の蛙", "枝角虫", "蔦に覆われた虫"],
  5: ["深穴鼠", "灰スライム", "土の塊", "刃の虫", "枯れ木の手"],
  6: ["濁った鬼火", "甲殻虫", "穴蛇", "苔むした小者", "泥の腕"],
  7: ["塔の鼠", "岩牙虫", "黒コウモリ", "瘴り菌", "錆びた骨"],
  8: ["深層蝙蝠", "重いスライム", "骨の束", "地底蛙", "茨虫"],
  9: ["歪んだ虫", "寄り添う鬼火", "老いた野犬", "厚皮の鼠", "狭間の塊"],
};

export function templatesForFloor(floor: number): EnemyTemplate[] {
  const names = FLOOR_NAMES[floor];
  if (!names) return [];
  return names.map((name, i) => {
    if (floor === 1) {
      return {
        key: `f${floor}_e${i}`,
        name,
        maxHp: 5 + i * 2,
        atk: 1 + (i % 2),
        def: 0,
        expReward: 2 + i,
      };
    }
    if (floor === 2) {
      return {
        key: `f${floor}_e${i}`,
        name,
        maxHp: 9 + i * 2,
        atk: 1 + (i % 3),
        def: i === 2 ? 1 : 0,
        expReward: 3 + i,
      };
    }
    return {
      key: `f${floor}_e${i}`,
      name,
      maxHp: 12 + floor * 6 + i * 3,
      atk: 2 + Math.floor(floor * 1.7) + (i % 3),
      def: Math.min(6, Math.floor((floor + i) / 3)),
      expReward: 4 + floor * 2 + i,
    };
  });
}

export const BOSS_TEMPLATE: EnemyTemplate = {
  key: "boss_depth",
  name: "深層の主",
  maxHp: 240,
  atk: 24,
  def: 9,
  expReward: 100,
};

export const WEAPON_CATEGORY_LABEL: Record<WeaponCategory, string> = {
  sword: "剣",
  axe: "斧",
  spear: "槍",
  mace: "打",
  dagger: "短刀",
  wand: "魔刃",
};

export const WEAPON_SPECIAL_LABEL: Record<WeaponSpecial, string> = {
  none: "",
  vampiric: "吸命",
  keen: "心眼",
  piercing: "貫通",
  twin: "連閃",
};

export const WEAPON_BASES: { name: string; atk: number; category: WeaponCategory }[] =
  [
    { name: "短剣", atk: 2, category: "sword" },
    { name: "長剣", atk: 3, category: "sword" },
    { name: "手斧", atk: 3, category: "axe" },
    { name: "双刃斧", atk: 4, category: "axe" },
    { name: "長槍", atk: 3, category: "spear" },
    { name: "三叉槍", atk: 2, category: "spear" },
    { name: "棍棒", atk: 2, category: "mace" },
    { name: "戦槌", atk: 3, category: "mace" },
    { name: "匕首", atk: 1, category: "dagger" },
    { name: "投げ刃", atk: 1, category: "dagger" },
    { name: "魔導片刃", atk: 2, category: "wand" },
  ];

export const WEAPON_PREFIXES: { label: string; atk: number }[] = [
  { label: "錆びた", atk: -2 },
  { label: "古い", atk: -1 },
  { label: "普通の", atk: 0 },
  { label: "鋭い", atk: 2 },
  { label: "洗練された", atk: 4 },
  { label: "呪われた", atk: -1 },
  { label: "祝福された", atk: 3 },
];

/** 生成時に付与（none 以外は名前に付記） */
export const WEAPON_SPECIAL_POOL: { id: WeaponSpecial; weight: number }[] = [
  { id: "none", weight: 52 },
  { id: "vampiric", weight: 12 },
  { id: "keen", weight: 12 },
  { id: "piercing", weight: 12 },
  { id: "twin", weight: 12 },
];

export const SPELLS: Record<
  SpellId,
  { label: string; mpCost: number; description: string }
> = {
  ember: {
    label: "小火",
    mpCost: 4,
    description: "魔力の火。防の一部を無視する。",
  },
  fireball: {
    label: "火球",
    mpCost: 7,
    description: "防具を通さない純粋な爆炎。高威力。",
  },
  spark: {
    label: "雷線",
    mpCost: 3,
    description: "素早い雷。MP が少なくて済む。",
  },
  thunder: {
    label: "落雷",
    mpCost: 10,
    description: "大電流。防を無視した一撃。",
  },
  frost: {
    label: "凍霧",
    mpCost: 5,
    description: "威力は控えめ。凍結で数ターン行動を封じることがある（ボスには効きにくい）。",
  },
  mend: {
    label: "癒し",
    mpCost: 5,
    description: "体力をしっかり回復する。",
  },
};

export const SPELL_BOOKS: { name: string; spell: SpellId }[] = [
  { name: "火の綴り", spell: "ember" },
  { name: "爆炎の綴り", spell: "fireball" },
  { name: "雷の綴り", spell: "spark" },
  { name: "大雷の綴り", spell: "thunder" },
  { name: "氷の綴り", spell: "frost" },
  { name: "祈りの綴り", spell: "mend" },
];

/** クラフト: 5個で1つ */
export const CRAFT_COST = 5;
export const ITEM_HERB = "薬草";
export const ITEM_MANA_HERB = "魔力草";
export const ITEM_POTION_MINOR = "初級ポーション";
export const ITEM_MANA_POTION_MINOR = "初級魔力ポーション";
export const ITEM_POTION_MEDIUM = "中級ポーション";
export const ITEM_MANA_POTION_MEDIUM = "中級魔力ポーション";

/** 初級ポーション5つを1つの中級にまとめたときの回復量（max までクリップ） */
export const POTION_MEDIUM_HP_POWER = 120;
export const POTION_MEDIUM_MP_POWER = 95;

let itemSeq = 0;
export function nextItemId(): string {
  itemSeq += 1;
  return `itm-${itemSeq}`;
}

export function resetItemIdCounter(): void {
  itemSeq = 0;
}

export function rollWeaponSpecial(): WeaponSpecial {
  const pool = WEAPON_SPECIAL_POOL;
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e.id;
  }
  return "none";
}

export function formatWeaponEquipLine(w: Weapon): string {
  const cat = WEAPON_CATEGORY_LABEL[w.category];
  const sp =
    w.special !== "none" ? `・${WEAPON_SPECIAL_LABEL[w.special]}` : "";
  return `${w.fullName}（+${w.atk} ${cat}${sp}）`;
}

export function inventoryWeaponTitle(it: InventoryItem): string | undefined {
  if (it.kind !== "weapon") return undefined;
  const cat = WEAPON_CATEGORY_LABEL[it.weaponCategory ?? "sword"];
  const sp = it.weaponSpecial ?? "none";
  const tag = sp !== "none" ? ` ${WEAPON_SPECIAL_LABEL[sp]}` : "";
  return `攻撃+${it.power} ${cat}${tag}`;
}
