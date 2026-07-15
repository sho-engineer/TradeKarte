"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "新規", exact: true },
  { href: "/app/history", label: "履歴", exact: false },
  { href: "/upgrade", label: "プラン", exact: true },
] as const;

export default function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="tk-topbar__nav">
      {LINKS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={
              "tk-topbar__link" + (active ? " tk-topbar__link--active" : "")
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
