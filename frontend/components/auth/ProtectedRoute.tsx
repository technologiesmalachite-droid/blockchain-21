"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth-provider";

type ProtectedRouteProps = {
  children: ReactNode;
  redirectOnFail?: boolean;
  fallback?: ReactNode;
};

export function ProtectedRoute({ children, redirectOnFail = true, fallback }: ProtectedRouteProps) {
  const { authState } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!redirectOnFail || (authState !== "logged_out" && authState !== "two_factor_pending" && authState !== "email_otp_pending")) {
      return;
    }

    const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${nextParam}`);
  }, [authState, pathname, redirectOnFail, router]);

  if (authState === "loading") {
    return (
      <Card className="border-white/15 bg-black/25">
        <p className="text-lg font-semibold text-white">Checking your session</p>
        <p className="mt-2 text-sm text-muted">Please wait while we verify your account access.</p>
      </Card>
    );
  }

  if (authState === "two_factor_pending") {
    return (
      <Card className="border-white/15 bg-black/25">
        <p className="text-lg font-semibold text-white">Two-factor verification required</p>
        <p className="mt-2 text-sm text-muted">Complete two-factor verification from the login page to access this route.</p>
      </Card>
    );
  }

  if (authState === "email_otp_pending") {
    return (
      <Card className="border-white/15 bg-black/25">
        <p className="text-lg font-semibold text-white">Email OTP verification required</p>
        <p className="mt-2 text-sm text-muted">Complete email OTP verification from the login page to access this route.</p>
      </Card>
    );
  }

  if (authState === "logged_out") {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className="border-white/15 bg-black/25">
        <p className="text-lg font-semibold text-white">Redirecting to sign in</p>
        <p className="mt-2 text-sm text-muted">You need an authenticated session to access this page.</p>
      </Card>
    );
  }

  return <>{children}</>;
}
