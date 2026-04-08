export default function MarketsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-12 lg:px-8">
      <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      <div className="h-[560px] animate-pulse rounded-3xl border border-white/10 bg-white/5" />
    </div>
  );
}

