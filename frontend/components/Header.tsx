"use client";

import Link from "next/link";
import { Menu, MoonStar, SunMedium } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useDemo } from "@/lib/demo-provider";

const links = [
  { href: "/markets", label: "Markets" },
  { href: "/trade", label: "Trade" },
  { href: "/futures", label: "Futures" },
  { href: "/earn", label: "Earn" },
  { href: "/wallet", label: "Wallet" },
  { href: "/about", label: "Learn" },
  { href: "/support", label: "Support" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { toggleTheme, theme } = useDemo();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <BrandLogo compact />
          <p className="hidden text-[10px] uppercase tracking-[0.22em] text-muted xl:block">{BRAND_TAGLINE}</p>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-muted transition hover:text-white">
              {link.label}
            </Link>
          ))}
          <button onClick={toggleTheme} className="rounded-full border border-white/10 p-2 text-muted hover:text-white" aria-label="Toggle theme">
            {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          </button>
          <div className="rounded-full border border-white/10 px-3 py-2 text-xs text-muted">EN / USD</div>
          <Link href="/login" className="text-sm text-white">Sign in</Link>
          <Link href="/signup"><Button>Sign up</Button></Link>
        </nav>

        <button onClick={() => setOpen((value) => !value)} className="rounded-xl border border-white/10 p-2 text-white lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className={cn("border-t border-white/10 bg-slate-950/90 px-4 py-4 lg:hidden", !open && "hidden")}>
        <div className="flex flex-col gap-4">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-muted transition hover:text-white" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="flex gap-3">
            <Link href="/login" className="flex-1"><Button className="w-full" variant="secondary">Sign in</Button></Link>
            <Link href="/signup" className="flex-1"><Button className="w-full">Sign up</Button></Link>
          </div>
        </div>
      </div>
    </header>
  );
}
