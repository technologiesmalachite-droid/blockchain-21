export default function CoinDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-12 lg:px-8">
      <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
    </div>
  );
}

