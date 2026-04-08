"use client";

import { useDemo } from "@/lib/demo-provider";

export function ToastViewport() {
  const { toasts } = useDemo();

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-80 flex-col gap-3">
      {toasts.map((toast) => (
        <div key={toast.id} className="rounded-2xl border border-white/10 bg-slate-900/95 p-4 text-sm text-white shadow-panel">
          <p className="font-medium">{toast.title}</p>
          <p className="mt-1 text-muted">{toast.description}</p>
        </div>
      ))}
    </div>
  );
}

