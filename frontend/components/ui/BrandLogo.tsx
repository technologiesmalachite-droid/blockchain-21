import Image from "next/image";
import { BRAND_LOGO_PATH, BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/90 px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.35)]",
        compact && "px-2.5 py-1.5",
        className,
      )}
    >
      <div className={cn("flex items-center whitespace-nowrap", compact ? "gap-2" : "gap-2.5")}>
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-accent/35 bg-black/70",
            compact ? "h-8 w-8" : "h-9 w-9",
          )}
        >
          <Image
            src={BRAND_LOGO_PATH}
            alt={`${BRAND_NAME} icon`}
            width={2825}
            height={642}
            priority={compact}
            className={cn(
              "h-full w-auto max-w-none object-left object-cover",
              compact ? "min-w-[136px]" : "min-w-[154px]",
            )}
          />
        </div>
        <span
          className={cn(
            "whitespace-nowrap font-extrabold leading-none tracking-[-0.03em] text-[#25df16]",
            compact ? "text-[22px]" : "text-[28px]",
          )}
        >
          {BRAND_NAME}
        </span>
      </div>
    </div>
  );
}
