import Link from "next/link";
import Mark from "@/components/brand/Mark";
import Wordmark from "@/components/brand/Wordmark";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシー" },
  { href: "/legal/tokushoho", label: "特定商取引法" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Mark size={28} />
          <span className="font-mono text-lg font-bold text-ink">
            <Wordmark />
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <nav className="mt-10 flex flex-wrap gap-4 border-b border-line pb-4 font-mono text-xs">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="text-muted hover:text-accent">
            {n.label}
          </Link>
        ))}
      </nav>

      <article className="tk-legal mt-10">{children}</article>

      <footer className="mt-16 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        <p>
          本サービスは投資助言・代理業ではありません。将来の値動きの予測、売買の推奨・助言は一切行いません。投資判断はご自身の責任で行ってください。
        </p>
      </footer>
    </main>
  );
}
