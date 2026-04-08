import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition",
        variant === "primary" && "bg-accent text-slate-950 hover:bg-emerald-300",
        variant === "secondary" && "border border-white/10 bg-white/5 text-white hover:bg-white/10",
        variant === "ghost" && "text-muted hover:text-white",
        className,
      )}
      {...props}
    />
  );
}

