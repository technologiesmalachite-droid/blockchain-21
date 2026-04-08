import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/markets", label: "Markets" },
      { href: "/trade", label: "Spot Trading" },
      { href: "/earn", label: "Earn" },
      { href: "/wallet", label: "Wallet" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/careers", label: "Careers" },
      { href: "/support", label: "Support" },
      { href: "/api-docs", label: "API Docs" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/risk-disclosure", label: "Risk Disclosure" },
      { href: "/fees", label: "Fees" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <BrandLogo className="w-fit" />
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">{BRAND_TAGLINE}</p>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted">
            {BRAND_NAME} is a premium crypto exchange demo for spot trading, wallet operations, staking, and operational admin tooling.
          </p>
          <p className="mt-4 text-xs leading-6 text-muted">
            Crypto assets are volatile and involve risk. This website uses simulated balances, prices, and operational flows unless real services are integrated.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="mb-4 text-sm font-medium text-white">{column.title}</p>
            <div className="space-y-3">
              {column.links.map((link) => (
                <Link key={link.href} href={link.href} className="block text-sm text-muted transition hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
