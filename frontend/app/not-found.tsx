import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BRAND_NAME } from "@/lib/brand";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm uppercase tracking-[0.24em] text-accent">404</p>
      <h1 className="mt-4 text-5xl font-semibold text-white">Market route not found</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-muted">The page you requested does not exist in this {BRAND_NAME} build. Return to the homepage or continue browsing supported product areas.</p>
      <Link href="/" className="mt-8"><Button>Back to homepage</Button></Link>
    </div>
  );
}
