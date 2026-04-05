# テキストハクスラ

ブラウザで遊べる、テキストログ主体のハクスラ風 RPG です（Next.js 15 + Tailwind CSS v4）。

## 遊ぶ

| 環境 | やり方 |
|------|--------|
| **公開サイト** | [Vercel でデプロイ](#vercelで公開する初回のみ)すると `https://xxxx.vercel.app` が発行されます。ソース: [GitHub / tabisurushosai/text-hacks-rpg](https://github.com/tabisurushosai/text-hacks-rpg) |
| **自分の PC** | 下の [ローカル開発](#ローカル開発) を参照 |

## ざっくり内容

- ダンジョンを **探索** し、敵と **戦闘**（物理・魔法・道具・逃走）
- **階段** で下り、**10 階のボス** を目指す
- **クラフト**: 草から初級ポーション、初級 5 つを **中級** に精製（一気に回復しやすい）
- 探索画面から **アイテムを使う** で、クラフトを開かずに回復アイテムを使用可能
- 右上 **BGM** でループ再生（任意。音源は自分で配置）

主要ロジックは `lib/game/core.ts`、定数・敵名などは `lib/game/data.ts`、UI は `components/HackAndSlashGame.tsx` です。

## BGM（任意）

1. プロジェクト内の **`public/bgm/theme.mp3`** にファイルを置く（このパスが実体）。
2. ゲームの **BGM** ボタンで再生（ブラウザの仕様で、最初の再生はボタン操作が必要）。

**Finder での場所の目安:** このリポジトリのフォルダ → `public` → `bgm` → `theme.mp3`  
詳細は同梱の **`public/bgm/BGMの置き方.txt`** を参照。

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

## Vercel で公開する（初回のみ）

1. [Vercel](https://vercel.com/) に GitHub でログインする。
2. **Add New → Project** で `tabisurushosai/text-hacks-rpg` をインポート（見つからなければ GitHub の権限を確認）。
3. **Framework Preset** が **Next.js** であることを確認して **Deploy**。
4. 表示された **`https://xxxx.vercel.app`** がプレイ用 URL。以降 `main` へ `git push` するたびに自動再デプロイ。

## ライセンス

リポジトリに LICENSE が無い場合は、利用条件はリポジトリ所有者に従ってください。
