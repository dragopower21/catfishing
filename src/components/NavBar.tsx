"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, HelpCircle, House } from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";
import SoundToggle from "@/components/SoundToggle";

const LINKS = [
  { href: "/", label: "Home", icon: House },
  { href: "/how-to-play", label: "How to play", icon: HelpCircle },
  { href: "/about", label: "About", icon: BookOpen },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b-[3px] border-slate-900 bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
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
          );
        })}
        <SoundToggle />
        <ProfileMenu />
      </div>
    </nav>
  );
}
