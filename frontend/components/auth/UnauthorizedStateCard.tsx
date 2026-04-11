"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type UnauthorizedStateCardProps = {
  title: string;
  subtitle: string;
  className?: string;
};

export function UnauthorizedStateCard({ title, subtitle, className }: UnauthorizedStateCardProps) {
  const pathname = usePathname();
  const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";

  return (
    <Card className={cn("border-white/15 bg-black/25", className)}>
      <h3 className="text-2xl font-semibold text-white">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{subtitle}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/login${nextParam}`}>
          <Button>Sign In</Button>
        </Link>
        <Link href={`/signup${nextParam}`}>
          <Button variant="secondary">Sign Up</Button>
        </Link>
      </div>
    </Card>
  );
}
