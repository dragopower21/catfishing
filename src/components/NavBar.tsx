"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Fish, HelpCircle, House } from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";

const LINKS = [
  { href: "/", label: "Home", icon: House },
  { href: "/how-to-play", label: "How to play", icon: HelpCircle },
  { href: "/about", label: "About", icon: BookOpen },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b-[3px] border-slate-900 bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="group inline-flex items-center gap-2"
          aria-label="Catfishing home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border-[3px] border-slate-900 bg-accent-yellow brut-shadow-sm font-display text-base text-slate-900">
            C
          </span>
          <span className="hidden font-display text-lg leading-none text-slate-900 sm:inline">
            Catfishing{" "}
            <Fish
              className="ml-0.5 inline h-4 w-4 -translate-y-px text-accent-sky"
              strokeWidth={2.5}
              fill="currentColor"
            />
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <ul className="flex flex-wrap items-center gap-2">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`brut-btn brut-btn-sm ${
                      active
                        ? "bg-accent-yellow text-slate-900"
                        : "bg-white text-slate-900"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.5} />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <ProfileMenu />
        </div>
      </div>
    </nav>
  );
}
