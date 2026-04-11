"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type AuthRequiredModalProps = {
  open: boolean;
  message: string;
  onClose: () => void;
};

export function AuthRequiredModal({ open, message, onClose }: AuthRequiredModalProps) {
  const pathname = usePathname();

  if (!open) {
    return null;
  }

  const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <Card className="w-full max-w-md border-white/20 bg-[#0D1420]">
        <h2 className="text-xl font-semibold text-white">Sign in required</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/login${nextParam}`} onClick={onClose}>
            <Button>Sign In</Button>
          </Link>
          <Link href={`/signup${nextParam}`} onClick={onClose}>
            <Button variant="secondary">Sign Up</Button>
          </Link>
        </div>
        <button className="mt-4 text-sm text-muted hover:text-white" onClick={onClose}>
          Not now
        </button>
      </Card>
    </div>
  );
}
