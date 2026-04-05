import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "テキストハクスラ",
  description: "ブラウザで遊べるテキスト主体のハクスラRPG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
