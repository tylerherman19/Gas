"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Index" },
  { href: "/about", label: "Method" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 font-mono text-[11px]">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-ink underline decoration-1 underline-offset-4"
                : "text-ink-faint transition-colors hover:text-ink"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
