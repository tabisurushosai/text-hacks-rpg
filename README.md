# 層底譚（Text Descent）

**ブラウザを開けばそのまま遊べる**テキストログ主体のハクスラ風 RPG（Next.js 15 + Tailwind CSS v4）。  
インストール不要で URL にアクセスするだけが主な入り口です。

| 優先度 | 環境 | 理由 |
|--------|------|------|
| **推奨** | PC のブラウザ | 操作・表示・BGM の再現性が高い |
| **推奨** | スマホでホーム画面に追加 | スタンドアロン表示でタップや音が安定しやすい（`manifest.webmanifest` あり） |
| 共有用 | LINE 等の in-app | 一時的な閲覧向け。長期的な最適化の主対象ではない |

制作の方針・世界観の軸は **[docs/VISION.md](docs/VISION.md)** にまとめています。

---

## 即プレイ

| 方法 | URL / 手順 |
|------|------------|
| **公開サイト** | [Vercel でデプロイ](#vercelで公開する初回のみ) すると `https://xxxx.vercel.app` が発行されます。ソース: [GitHub / tabisurushosai/text-hacks-rpg](https://github.com/tabisurushosai/text-hacks-rpg) |
| **ローカル** | 下の [ローカル開発](#ローカル開発) → [http://localhost:3000](http://localhost:3000) |

---

## ざっくり内容

- ダンジョンを **探索** し、敵と **戦闘**（物理・魔法・道具・逃走）
- **階段** で下り、**10 階のボス（層底の主）** を目指す
- **調合アイテム** でクラフトと所持品の使用、**魔法（回復）** は探索中も使用可
- **魔法**は炎・氷・雷・回復（弱／強）。綴りを拾って習得。一部の敵には **弱点属性**
- **武器**はドロップで所持品へ。装備時は以前の武器が戻る。特殊効果は括弧で目安表示
- 戦闘勝利後はログに **戦闘後の HP/MP** を淡々と一行表示
- 右上 **BGM** でループ再生（探索用・戦闘用で切替）

**セーブ**: ブラウザを閉じると進行はリセット（周回型の 1 プレイ想定）。

主要ロジックは `lib/game/core.ts`、データは `lib/game/data.ts`・`lib/game/lore.ts`、UI は `components/HackAndSlashGame.tsx` です。

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
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー（`build` 後） |
| `npm run lint` | Lint |

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

## ライセンス

リポジトリに LICENSE が無い場合は、利用条件はリポジトリ所有者に従ってください。
