# 層底譚（Text Descent）

**ブラウザを開けばそのまま遊べる**テキストログ主体のハクスラ風 RPG（Next.js 15 + Tailwind CSS v4）。  
インストール不要で URL にアクセスするだけが主な入り口です。

| 優先度 | 環境 | 理由 |
|--------|------|------|
| **推奨** | PC のブラウザ | 操作・表示・BGM の再現性が高い |
| **推奨** | スマホでホーム画面に追加 | スタンドアロン表示でタップや音が安定しやすい（`manifest.webmanifest` あり） |
| 共有用 | LINE 等の in-app | 一時的な閲覧向け。長期的な最適化の主対象ではない |

制作の方針・世界観の軸は **[docs/VISION.md](docs/VISION.md)** にまとめています。  
**開発引き継ぎ（新しいチャット用）** は **[docs/HANDOFF.md](docs/HANDOFF.md)** を参照してください。

---

## 即プレイ

| 方法 | URL / 手順 |
|------|------------|
| **公開サイト** | [Vercel でデプロイ](#vercelで公開する初回のみ) すると `https://xxxx.vercel.app` が発行されます。ソース: [GitHub / tabisurushosai/text-hacks-rpg](https://github.com/tabisurushosai/text-hacks-rpg) |
| **ローカル** | 下の [ローカル開発](#ローカル開発) → [http://localhost:3000](http://localhost:3000) |

---

## ざっくり内容

- **探索** と **戦闘**（物理／スキル・魔法／道具／逃走）。戦闘メイン操作は **2×2 の 4 ボタン** 固定
- **階段** で下り、**10 階のボス（層底の主）** を目指す周回型
- **職業**（戦士／魔法使い／農民）。職ごとに **固有スキル 2 つ** と、物理・攻撃魔法の **倍率** が異なる
- **武器・防具** をドロップ・装備（攻撃／防御と特殊効果。装備値はだいたい **最大 15 帯**）。拾ったあとに **品質フレーバー** が続くことがある
- 敵の **種類（テンプレ key）** によって **ドロップ補正** が少し変わる（狩りの差）
- **綴り**で炎・氷・雷・回復を習得。**1〜5 階**は基本形中心、**6 階以降**から上位が混ざる
- **弱点属性** がある敵もいる（ログに「弱点を突いた」）
- **調合アイテム** でポーション類クラフト・所持品使用。**最強装備**でかばんのうち数値最大の武器・防具を装備、**分解**でかばんの武器・防具を砕いて **経験値** にする
- 探索に **宝箱**（道具・装備・経験値・罠）や **ミミック風の箱** など
- クリア時に **今回の称号** がログとクリア画面に出る（タイトルには出さない）
- 戦闘勝利後、ログに **戦闘後の HP/MP** を一行
- **セーブ**は `localStorage`（版付き JSON、古い版は読込時に正規化）。**続きから**／**タイトルへ**／**新しく冒険する** の挙動はゲーム内ヘルプ（？）参照
- **記録（メタ）** は別キー（最深階・踏破回数など）。**タイトル画面には表示しない**
- ログは **［傷］［癒］** 等の行頭印と色分け、`aria-live`、戦闘時は **HP/MP バー** と弱点表示

主要コード: `lib/game/core.ts`（進行）、`gameConfig.ts`（数値）、`data.ts`（敵・装備・`ENEMY_EXTRA_LOOT` 等）、`persistence.ts`、`runEpithet.ts`（称号）、`spellEffects.ts`、UI は `components/HackAndSlashGame.tsx`・`buildGameActions.tsx`。作者連絡先の定数は `lib/siteMeta.ts`。

**テスト**: `npm test`（Vitest）。**CI（任意）**: [docs/github-actions-ci.example.yml](docs/github-actions-ci.example.yml) を `.github/workflows/ci.yml` にコピーすると、`main` の push / PR で `lint`・`build`・`test` が回ります（権限のあるトークンで workflow を push する必要があります）。

---

## 操作（キーボード）

| キー | 動作 |
|------|------|
| **矢印**（上下左右） | 行動メニューで選択を移動 |
| **Enter** または **Space** | 決定 |

スマホ・タブレットは画面のボタン操作のみでプレイできます。

---

## BGM（任意）

`public/bgm/` に置いたファイルがそのまま URL で配信されます。

| ファイル | 用途 |
|----------|------|
| **explore.mp3** | 探索中（推奨） |
| **combat.mp3** | 戦闘中（推奨） |
| **title.mp3** | タイトル（任意） |
| **theme.mp3** | 互換用フォールバック |

詳細は **`public/bgm/BGMの置き方.txt`** を参照。

---

## ローカル開発

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く。

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー |
| `npm run dev:turbo` | Turbopack 版（必要なら） |
| `npm test` | ユニットテスト（Vitest） |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー（`build` 後） |
| `npm run lint` | Lint |

---

## フィードバック

プレイの感想・不具合の報告は **X の [@tabisurushosai](https://x.com/tabisurushosai)** までお願いします（ポスト・リプライなど。アプリ内のリンクと同じ先です）。

---

## トラブルのとき

- **画面が真っ黒・ビルドエラー**: `npm install` のあと `npm run build` でエラー内容を確認
- **BGM が鳴らない**: ファイル名・配置（`public/bgm/`）と **BGM ボタン**、または **BGMリセット**
- **Vercel で古いまま**: `main` へ push 後、デプロイ完了まで数分待つ

---

## Vercel で公開する（初回のみ）

1. [Vercel](https://vercel.com/) に GitHub でログインする。
2. **Add New → Project** で `tabisurushosai/text-hacks-rpg` をインポート（見つからなければ GitHub の権限を確認）。
3. **Framework Preset** が **Next.js** であることを確認して **Deploy**。
4. 表示された **`https://xxxx.vercel.app`** がプレイ用 URL。以降 `main` へ `git push` するたびに自動再デプロイ。

---

## ライセンス・利用

このリポジトリに LICENSE ファイルが無い場合、利用・二次利用の条件はリポジトリ所有者の方針に従ってください。
