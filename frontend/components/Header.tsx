"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-provider";
import { BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useDemo } from "@/lib/demo-provider";
import { fetchNotifications } from "@/lib/api/private-data";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/trade", label: "Trade" },
  { href: "/earn", label: "Earn" },
  { href: "/wallet", label: "Wallet" },
  { href: "/p2p", label: "P2P" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { submitToast } = useDemo();
  const { isAuthenticated, signOut, user, status } = useAuth();

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setUnreadNotifications(0);
      return () => {
        active = false;
      };
    }

    const loadUnreadCount = async () => {
      try {
        const payload = await fetchNotifications({ page: 1, pageSize: 1, unreadOnly: true });
        if (!active) {
          return;
        }
        setUnreadNotifications(payload.unreadCount || 0);
      } catch {
        if (!active) {
          return;
        }
        setUnreadNotifications(0);
      }
    };

    loadUnreadCount();
    const interval = window.setInterval(loadUnreadCount, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [status]);

  const handleSignOut = async () => {
    await signOut();
    submitToast("Signed out", "Your session has been closed safely.");
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <BrandLogo compact />
          <p className="hidden text-[10px] uppercase tracking-[0.22em] text-muted xl:block">{BRAND_TAGLINE}</p>
        </Link>

        <nav className="hidden items-center lg:flex">
          <div className="flex items-center gap-6">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-muted transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="ml-6 flex items-center gap-3">
            <div className="rounded-full border border-white/10 px-3 py-2 text-xs text-muted">EN / USD</div>
            {isAuthenticated ? (
              <>
                <div className="rounded-full border border-white/10 px-3 py-2 text-xs text-muted">{user?.fullName || "Account"}</div>
                <Link href="/notifications" className="relative text-sm text-white" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-2 -top-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-black">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </Link>
                <Link href="/profile" className="text-sm text-white">
                  Profile
                </Link>
                <Button variant="secondary" onClick={handleSignOut}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-white">
                  Sign in
                </Link>
                <Link href="/signup">
                  <Button>Sign up</Button>
                </Link>
              </>
            )}
          </div>
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
            {isAuthenticated ? (
              <>
                <Link href="/notifications" className="flex-1">
                  <Button className="w-full" variant="secondary">
                    Alerts {unreadNotifications > 0 ? `(${unreadNotifications > 99 ? "99+" : unreadNotifications})` : ""}
                  </Button>
                </Link>
                <Link href="/profile" className="flex-1">
                  <Button className="w-full" variant="secondary">
                    Profile
                  </Button>
                </Link>
                <Button className="flex-1" onClick={handleSignOut}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="flex-1">
                  <Button className="w-full" variant="secondary">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup" className="flex-1">
                  <Button className="w-full">Sign up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
