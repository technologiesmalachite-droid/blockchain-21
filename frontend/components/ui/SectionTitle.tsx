import { ReactNode } from "react";

export function SectionTitle({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="mb-2 text-sm uppercase tracking-[0.28em] text-accent">{eyebrow}</p>
        <h2 className="text-3xl font-semibold text-white md:text-4xl">{title}</h2>
        {copy ? <p className="mt-3 text-sm leading-7 text-muted">{copy}</p> : null}
      </div>
      {action}
    </div>
  );
}

