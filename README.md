# テキストハクスラ

ブラウザで遊べるテキスト主体のハクスラRPG（Next.js + Tailwind CSS）。

## みんなが遊べるURLを出す（Vercel・無料枠で可）

ソースは [GitHub リポジトリ](https://github.com/tabisurushosai/text-hacks-rpg) にあります。**公開URLはデプロイすると発行されます**（リポジトリだけではURLは付きません）。

### 手順（初回だけ・数分）

1. [Vercel](https://vercel.com/) にアクセスし、**GitHub アカウントでログイン**する。
2. **Add New… → Project**（またはダッシュボードの **Add New Project**）。
3. **Import Git Repository** で `tabisurushosai/text-hacks-rpg` を選ぶ（見つからなければ **Adjust GitHub App Permissions** でリポジトリを許可）。
4. **Framework Preset** が **Next.js** になっていることを確認する（ほぼ自動）。
5. **Deploy** を押す。
6. 完了後に表示される **`https://xxxx.vercel.app`** が **PC・スマホ共通のプレイ用URL** になる。

以降、`main` ブランチへ `git push` するたびに自動で再デプロイされます。

### ローカルでだけ遊ぶ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開く。

## ライセンス

リポジトリに LICENSE が無い場合は、利用条件はリポジトリ所有者に従ってください。
