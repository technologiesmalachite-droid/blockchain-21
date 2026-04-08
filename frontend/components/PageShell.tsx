import { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";

export function PageHero({ eyebrow, title, description, badge }: { eyebrow: string; title: string; description: string; badge?: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
      <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/8 to-transparent p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold text-white">{title}</h1>
            <p className="mt-4 text-sm leading-7 text-muted">{description}</p>
          </div>
          {badge ? <Badge>{badge}</Badge> : null}
        </div>
      </div>
    </section>
  );
}

export function ContentSection({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">{children}</section>;
}

