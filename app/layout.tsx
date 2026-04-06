import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "層底譚 — Text Descent",
  description:
    "一行ずつ選び階を下りる、ブラウザで遊べるテキスト主体のハクスラRPG",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1419",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preload" href="/bgm/title.mp3" as="audio" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
