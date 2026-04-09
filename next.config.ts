import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** タイトル画面の二重マウントによるちらつきを抑える（開発時） */
  reactStrictMode: false,
  /** ZIP 配布・静的ホスティング用（`out/` に書き出し）。Vercel もこのビルドで配信可能。 */
  output: "export",
};

export default nextConfig;
