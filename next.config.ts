import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** タイトル画面の二重マウントによるちらつきを抑える（開発時） */
  reactStrictMode: false,
};

export default nextConfig;
