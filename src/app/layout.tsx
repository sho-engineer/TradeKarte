import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ポジミル｜そのポジは、エッジか衝動か。",
  description:
    "チャート画像と一言メモから、AIが売買の意思決定の質を批評するFXトレーダー向け振り返りツール。売買シグナルは出しません。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${jetbrainsMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
