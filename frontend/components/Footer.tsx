import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/markets", label: "Markets" },
      { href: "/trade", label: "Spot Trading" },
      { href: "/futures", label: "Futures" },
      { href: "/earn", label: "Earn" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/careers", label: "Careers" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/support", label: "Support" },
      { href: "/help-center", label: "Help Center" },
      { href: "/faqs", label: "FAQs" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/about", label: "Learn" },
      { href: "/blog", label: "Blog" },
      { href: "/guides", label: "Guides" },
      { href: "/tutorials", label: "Tutorials" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] lg:px-8">
        <div>
          <BrandLogo className="w-fit" />
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">{BRAND_TAGLINE}</p>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted">
            {BRAND_NAME} delivers a premium crypto exchange experience for spot trading, wallet operations, staking, and operational admin tooling.
          </p>
          <p className="mt-4 text-xs leading-6 text-muted">
            Crypto assets are volatile and involve risk. Access to regulated services depends on jurisdiction, provider integration, and compliance approval.
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
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted lg:px-8">
          <p>(c) {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/risk-disclosure" className="transition hover:text-white">
              Risk Disclosure
            </Link>
            <Link href="/fees" className="transition hover:text-white">
              Fees
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

