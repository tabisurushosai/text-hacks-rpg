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
| フィードバック窓口 | X **[@tabisurushosai](https://x.com/tabisurushosai)**（コード上は `lib/siteMeta.ts` に定数） |

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
| `next.config.ts` | `output: 'export'`（ZIP 配布・静的ホスト用） |
| `scripts/pack-zip.cjs` | `pack:full` / `pack:demo` で ZIP 化 |
| `docs/BUYER_README.txt` | ZIP 同梱の購入者向け起動手順 |
| `docs/SALES_BOOTH.md` | BOOTH・100円・チェックリスト |
| `docs/DISTRIBUTION_UX.md` | 購入者の手間・URL 併記・exe のコスパ（作者向け） |
| `docs/START_windows.bat` | ZIP 同梱時 `START.bat` の元ファイル（Windows + Node） |
| `app/page.tsx` | タイトル ↔ ゲーム切替、続きから、セーブ読み込み失敗時のメッセージ |
| `components/HackAndSlashGame.tsx` | メイン UI（ログ、戦闘 HUD、ヘルプ、キーボード、aria-live、クリア画面） |
| `components/buildGameActions.tsx` | 探索・戦闘の行動ボタン一覧（`smith` 分解含む） |
| `components/TitleScreen.tsx` | タイトル・職選択 |
| `components/CombatHud.tsx` | 戦闘中の敵 HP バー・弱点・自分 HP/MP |
| `lib/siteMeta.ts` | 作者 X URL・@ ハンドル（フィードバック用の単一ソース） |
| `lib/game/core.ts` | ゲーム進行の中心（探索・戦闘・宝箱・分解・クラフト等） |
| `lib/game/types.ts` | `GameState`、`CombatMenu`、`ExploreMenu`（`smith` 含む）、`SpellId` 等 |
| `lib/game/data.ts` | 敵テンプレ、武器・防具、呪文、`ENEMY_EXTRA_LOOT`、`rollLootQualityFlairLine` 等 |
| `lib/game/runEpithet.ts` | クリア時の称号一行 |
| `lib/game/balance.ts` | 職倍率、敵・ボス補正、`JOB_META` |
| `lib/game/edition.ts` | `NEXT_PUBLIC_GAME_EDITION` による **体験版 demo / 有料版 full**（未設定＝有料版） |
| `lib/game/editionLimits.ts` | 体験版の最深階など |
| `lib/game/gameConfig.ts` | ドロップ率・装備上限、`getPersistenceKeys()`（エディション別 localStorage）、セーブ版定数 |
| `lib/game/combatMath.ts` | 物理/敵ダメ・防具軽減・レベルアップ処理 |
| `lib/game/persistence.ts` | セーブ JSON、メタ記録、`normalizeExploreMenu`（`smith`） |
| `lib/game/spellEffects.ts` | 戦闘・探索での呪文効果 |
| `lib/game/logLineTone.ts` | ログ行のトーン・行頭印（［傷］等） |
| `lib/game/lore.ts` / `exploreFlavor.ts` | フレーバーテキスト |
| `lib/bgm.ts` + `components/GameBgmContext.tsx` | BGM |
| `docs/github-actions-ci.example.yml` | GitHub Actions 用 CI 定義のサンプル（`.github/workflows/ci.yml` にコピーして有効化） |

---

## 戦闘 UI の現状（重要）

- **`CombatMenu`**: `"main" | "abilities" | "item"` のみ。
- **メイン 2×2**: `戦う` | `スキル・魔法` | `道具` | `逃げる`。
- **`abilities`**: 職スキル（【職】）→【攻撃魔法】→【回復魔法】の順で1リスト。
- 古いセーブで `misc` / `skills` / `magic` が入っていても、`normalizeCombatMenu` で **`main` に落とす**。

---

## 探索 UI

- **`ExploreMenu`**: `"main" | "items" | "magic" | "smith"`。
- **main**: 2×2（探索／調合アイテム／魔法／階段）。
- **items**: 調合・所持品使用・分解へ・一括捨て。
- **smith**: 武器・防具を砕いて経験値化。
- 古いセーブは `normalizeExploreMenu` で未知の値を **`main` に落とす**。

---

## セーブ・メタ

- キー名は **`lib/game/gameConfig.ts`** の **`getPersistenceKeys()`**（体験版は `text-hacks-rpg-demo-*`、有料版は従来の `text-hacks-rpg-*`）。
- セーブは **v2** で書き出し、**v1 も読込時に正規化**。破損時は削除＋タイトルでエラー表示（`app/page.tsx`）。
- メタ（最深階・踏破回数・冒険開始回数）は **別キー**。タイトルには表示しないが、`HackAndSlashGame` の `pendingClientEvent` 経由で死亡・クリア時に更新。
- **`pendingClientEvent`**: `GameState` に一時載せ、UI が処理後に `null` に。二重処理防止に `metaHandledRef`（トークン）あり。

---

## 品質・テスト

- `npm run build` — **静的書き出し**（`output: 'export'`）で `out/`。Vercel もこれ。
- `npm run preview` — `out/` を `serve` で確認（`next start` は使わない）。
- `npm run pack:full` / `pack:demo` — 販売用 ZIP を `dist/` に生成（中身は `docs/BUYER_README.txt` を `README.txt` として同梱）。
- `npm run lint` — ESLint。
- `npm test` — Vitest（`lib/**/*.test.ts`）。`vitest.config.ts` で `@/` エイリアスあり。
- **GitHub Actions**（任意）: サンプルを `.github/workflows/ci.yml` に置くとリモートで同等チェック。

---

## 既知の注意

- `clearMetaFromLocalStorage` は **エクスポートのみ**（タイトルからのリセット UI は削除済み）。必要ならタイトルに戻す。
- 難易の細かい調整は **プレイフィードバック待ち**の部分あり。

---

## 新チャット用・短い貼り付け文（コピペ用）

```
プロジェクト: 層底譚（text-hacks-rpg）。Next.js 15 + React 19 + Tailwind v4。
詳細はリポジトリの docs/HANDOFF.md を読んでから作業して。
ゲームロジックは lib/game/、UI は components/ と app/page.tsx。
戦闘メインは 2×2（戦う／スキル・魔法／道具／逃げる）。CombatMenu は main | abilities | item。
ExploreMenu は main | items | magic | smith（分解）。
返答は日本語。変更後は build と test を回して問題なければ commit & push。
GitHub Actions を使う場合は docs/github-actions-ci.example.yml を参照。
```

---

*最終更新: README・HANDOFF・CI・フィードバック窓口の整理に合わせて更新。*
