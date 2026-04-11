"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { fetchProfile } from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";

type ProfileState = {
  loading: boolean;
  failed: boolean;
  user: {
    fullName: string;
    email: string;
    phone?: string;
    countryCode?: string;
    role: string;
    antiPhishingCode?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    twoFactorEnabled?: boolean;
    kycStatus?: string;
    kycTier?: string;
  } | null;
};

const initialState: ProfileState = {
  loading: false,
  failed: false,
  user: null,
};

export default function ProfilePage() {
  const { status } = useAuth();
  const [state, setState] = useState<ProfileState>(initialState);

  useEffect(() => {
    let active = true;

    if (status !== "authenticated") {
      setState(initialState);
      return () => {
        active = false;
      };
    }

    setState({ loading: true, failed: false, user: null });

    fetchProfile()
      .then((payload) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          failed: false,
          user: payload.user,
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          failed: true,
          user: null,
        });
      });

    return () => {
      active = false;
    };
  }, [status]);

  return (
    <>
      <PageHero
        eyebrow="Profile"
        title="Account profile and security settings"
        description="Review your profile details, security setup, and verification status from one protected account center."
        badge="Private page"
      />
      <ContentSection>
        <ProtectedRoute>
          {state.loading ? (
            <Card className="border-white/15 bg-black/25">
              <p className="text-xl font-semibold text-white">Loading profile</p>
              <p className="mt-2 text-sm text-muted">Retrieving your account details securely.</p>
            </Card>
          ) : state.failed ? (
            <Card className="border-white/15 bg-black/25">
              <p className="text-xl font-semibold text-white">Unable to load profile</p>
              <p className="mt-2 text-sm text-muted">Please refresh the page or sign in again.</p>
            </Card>
          ) : !state.user ? (
            <Card className="border-white/15 bg-black/25">
              <p className="text-xl font-semibold text-white">Profile not available</p>
              <p className="mt-2 text-sm text-muted">Your account profile is currently unavailable.</p>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <p className="text-lg font-semibold text-white">Identity</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-muted">Full name</p>
                    <p className="mt-1 text-white">{state.user.fullName}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-muted">Email</p>
                    <p className="mt-1 text-white">{state.user.email}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-muted">Phone</p>
                    <p className="mt-1 text-white">{state.user.phone || "Not set"}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <p className="text-lg font-semibold text-white">Security and compliance</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-muted">Country</p>
                    <p className="mt-1 text-white">{state.user.countryCode || "Not set"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-muted">Role</p>
                    <p className="mt-1 text-white">{state.user.role}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-muted">Anti-phishing code</p>
                    <p className="mt-1 text-white">{state.user.antiPhishingCode || "Not configured"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-muted">KYC status</p>
                    <p className="mt-1 text-white">{state.user.kycStatus || "Pending"} ({state.user.kycTier || "none"})</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-muted">Security checks</p>
                    <p className="mt-1 text-white">
                      Email {state.user.emailVerified ? "verified" : "pending"} | Phone {state.user.phoneVerified ? "verified" : "pending"} | 2FA {state.user.twoFactorEnabled ? "enabled" : "disabled"}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
