# 引き継ぎメモ（新しいチャット・担当者向け）

**新しい会話を始めるとき**: まずこのファイルを読み、必要なら `README.md` と `docs/VISION.md` を続けて読んでください。

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| 名前 | **層底譚**（Text Descent） |
| スタック | Next.js 15、React 19、Tailwind CSS v4、TypeScript |
| リポジトリ | `https://github.com/tabisurushosai/text-hacks-rpg` |
| ゲーム性 | テキストログ主体ハクスラ。探索・戦闘・10階ボス。周回型、**localStorage セーブ**あり |

---

## ユーザー（作者）の希望（会話履歴から）

- 返答は **日本語**。
- 可能なら **自分でコマンド実行**（ユーザーに「実行してください」だけ渡さない）。
- 変更がまとまったら **コミット＆プッシュ**しがち（依頼があれば従う）。
- **戦闘メインは厳密に 2×2 の 4 ボタン**（5枠で空きが出るレイアウトは NG だった経緯あり）。
- タイトルに **記録（メタ）の表示は出さない**（内部では記録は更新される）。

---

## ディレクトリマップ（触ることが多い場所）

| パス | 役割 |
|------|------|
| `app/page.tsx` | タイトル ↔ ゲーム切替、続きから、セーブ読み込み失敗時のメッセージ |
| `components/HackAndSlashGame.tsx` | メイン UI（ログ、戦闘 HUD、ヘルプ、キーボード操作、aria-live） |
| `components/buildGameActions.tsx` | 探索・戦闘の行動ボタン一覧を組み立て |
| `components/TitleScreen.tsx` | タイトル・職選択（記録テキストは削除済み） |
| `components/CombatHud.tsx` | 戦闘中の敵 HP バー・弱点・自分 HP/MP |
| `lib/game/core.ts` | ゲーム進行の中心（探索・戦闘・死亡・勝利・クラフト等） |
| `lib/game/types.ts` | `GameState`、`CombatMenu`、`SpellId` 等 |
| `lib/game/data.ts` | 敵テンプレ、武器、呪文定義、`sortCombatAbilitiesForMenu` 等 |
| `lib/game/balance.ts` | 職倍率、敵・ボス補正、`JOB_META` |
| `lib/game/gameConfig.ts` | ドロップ率・武器 ATK 上限、`PERSISTENCE_KEYS`、セーブ版定数 |
| `lib/game/combatMath.ts` | 物理/敵ダメ・レベルアップ処理（`core` とテストで共有） |
| `lib/game/persistence.ts` | セーブ JSON、メタ記録、`tryLoadGameFromJson`、`clearMetaFromLocalStorage`（UI からは未使用） |
| `lib/game/spellEffects.ts` | 戦闘・探索での呪文効果 |
| `lib/game/logLineTone.ts` | ログ行のトーン・行頭印（［傷］等） |
| `lib/game/lore.ts` / `exploreFlavor.ts` | フレーバーテキスト |
| `lib/bgm.ts` + `components/GameBgmContext.tsx` | BGM |

---

## 戦闘 UI の現状（重要）

- **`CombatMenu`**: `"main" | "abilities" | "item"` のみ。
- **メイン 2×2**: `戦う` | `スキル・魔法` | `道具` | `逃げる`（「その他」サブメニューは廃止済み）。
- **`abilities`**: 職スキル（【職】）→【攻撃魔法】→【回復魔法】の順で1リスト。
- 古いセーブで `misc` / `skills` / `magic` が入っていても、`persistence` の `normalizeCombatMenu` で **`main` に落とす**。

---

## セーブ・メタ

- キー名は **`lib/game/gameConfig.ts`** の `PERSISTENCE_KEYS`。
- セーブは **v2** で書き出し、**v1 も読込時に正規化**。破損時は削除＋タイトルでエラー表示（`app/page.tsx`）。
- メタ（最深階・踏破回数・冒険開始回数）は **別キー**。タイトルには表示しないが、`HackAndSlashGame` の `pendingClientEvent` 経由で死亡・クリア時に更新。
- **`pendingClientEvent`**: `GameState` に一時載せ、UI が処理後に `null` に。二重処理防止に `metaHandledRef`（トークン）あり。

---

## 品質・テスト

- `npm run build` — 本番ビルド＋型＋ ESLint（Next 組み込み）。
- `npm test` — Vitest（`lib/**/*.test.ts`）。`vitest.config.ts` で `@/` エイリアスあり。

---

## 既知の注意

- `clearMetaFromLocalStorage` は **エクスポートのみ**（タイトルからのリセット UI は削除済み）。必要ならタイトルに戻す。
- ユーザーは以前「1 回でクリアまで」の難易調整に言及あり、**未着手の可能性**あり。

---

## 新チャット用・短い貼り付け文（コピペ用）

以下を新しい AI 会話の最初に貼ると続きやすいです。

```
プロジェクト: 層底譚（text-hacks-rpg）。Next.js 15 + React 19 + Tailwind v4。
詳細はリポジトリの docs/HANDOFF.md を読んでから作業して。
ゲームロジックは lib/game/、UI は components/ と app/page.tsx。
戦闘メインは 2×2（戦う／スキル・魔法／道具／逃げる）。CombatMenu は main | abilities | item。
返答は日本語。変更後は build と test を回して問題なければ commit & push。
```

---

*最終更新: 会話内の実装に基づくメモ。大きな変更後はこのファイルも更新推奨。*
