import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted", className)} {...props} />;
}

