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
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f1419",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full touch-manipulation">
      <head>
        <link rel="preload" href="/bgm/title.mp3" as="audio" />
      </head>
      <body className="min-h-full min-h-[100dvh] overflow-x-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
