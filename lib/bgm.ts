/** `public/bgm/` に置いたファイルがそのまま URL になる（Next.js の静的配信） */
export const BGM_PATHS = {
  explore: "/bgm/explore.mp3",
  combat: "/bgm/combat.mp3",
  /** 片方だけ置いていた頃の互換用。explore / combat が無いときのフォールバック */
  theme: "/bgm/theme.mp3",
} as const;

export const BGM_DEFAULT_VOLUME = 0.32;
