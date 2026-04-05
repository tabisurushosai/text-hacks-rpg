import type { EnemyTemplate, SpellId } from "./types";

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

export const WEAPON_BASES: { name: string; atk: number }[] = [
  { name: "短剣", atk: 2 },
  { name: "棍棒", atk: 1 },
  { name: "長槍", atk: 3 },
];

export const WEAPON_PREFIXES: { label: string; atk: number }[] = [
  { label: "錆びた", atk: -2 },
  { label: "古い", atk: -1 },
  { label: "普通の", atk: 0 },
  { label: "鋭い", atk: 2 },
  { label: "洗練された", atk: 4 },
];

export const SPELLS: Record<
  SpellId,
  { label: string; mpCost: number; description: string }
> = {
  ember: { label: "小火", mpCost: 5, description: "小さな火で攻撃する。" },
  mend: { label: "癒し", mpCost: 6, description: "体力を少し回復する。" },
};

export const SPELL_BOOKS: { name: string; spell: SpellId }[] = [
  { name: "火の綴り", spell: "ember" },
  { name: "祈りの綴り", spell: "mend" },
];

/** クラフト: 5個で1つ */
export const CRAFT_COST = 5;
export const ITEM_HERB = "薬草";
export const ITEM_MANA_HERB = "魔力草";
export const ITEM_POTION_MINOR = "初級ポーション";
export const ITEM_MANA_POTION_MINOR = "初級魔力ポーション";

let itemSeq = 0;
export function nextItemId(): string {
  itemSeq += 1;
  return `itm-${itemSeq}`;
}

export function resetItemIdCounter(): void {
  itemSeq = 0;
}
