"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Markets" },
  { href: "/portfolios", label: "Portfolios" },
  { href: "/questions", label: "Closing Questions" },
];

/**
 * A stock page belongs to the books, so it lights the Portfolios tab; an ETF
 * chart opens from the tape, so it lights Markets.
 */
function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/etf/");
  if (href === "/questions") return pathname.startsWith(href);
  return pathname.startsWith(href) || pathname.startsWith("/stock/");
}

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="mx-auto flex max-w-[1180px] gap-x-8 border-b border-[var(--line)] px-5 pt-6 sm:px-8"
    >
      {TABS.map((t) => {
        const active = isActive(t.href, pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`eyebrow -mb-px border-b-2 pb-3 transition-colors ${
              active
                ? "border-[var(--accent)] !text-[var(--paper)]"
                : "border-transparent hover:text-[var(--paper)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
