/** `public/bgm/` に置いたファイルがそのまま URL になる（Next.js の静的配信） */
export const BGM_PATHS = {
  /** タイトル画面（無いときは theme → explore の順で別要素と同様にフォールバック） */
  title: "/bgm/title.mp3",
  explore: "/bgm/explore.mp3",
  combat: "/bgm/combat.mp3",
  /** 互換用。各トラックが無いときのフォールバックの最後に使う */
  theme: "/bgm/theme.mp3",
} as const;

export const BGM_DEFAULT_VOLUME = 0.32;
