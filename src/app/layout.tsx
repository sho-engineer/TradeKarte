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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ポジミル｜そのポジは、エッジか衝動か。",
  description:
    "チャート画像と一言メモから、AIが売買の意思決定の質を批評するFXトレーダー向け振り返りツール。売買シグナルは出しません。",
};

// ペイント前にテーマを確定し、切替時のちらつきを防ぐ。
// 既定はダーク。保存値 'light' か、保存がなく OS がライト設定なら light を付与。
const THEME_BOOT = `(function(){try{var e=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: light)').matches;if(e==='light'||(e!=='dark'&&m)){document.documentElement.classList.add('light');}}catch(_){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${notoSansJp.variable} ${jetbrainsMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {children}
      </body>
    </html>
  );
}
