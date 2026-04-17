"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  changePasswordRequest,
  disableTwoFactorRequest,
  fetchSessionHistoryRequest,
  regenerateTwoFactorBackupCodesRequest,
  revokeOtherSessionsRequest,
  revokeSessionRequest,
  setupTwoFactorRequest,
  verifyEnableTwoFactorRequest,
  type SessionHistoryItem,
} from "@/lib/api/auth";
import { fetchProfile, updateProfile } from "@/lib/api/private-data";
import { extractBackendErrorMessage } from "@/lib/auth/error-messages";
import { getRefreshToken } from "@/lib/auth/session-store";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

type ProfileState = {
  loading: boolean;
  failed: boolean;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    countryCode?: string;
    role: string;
    antiPhishingCode?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    twoFactorEnabled?: boolean;
    twoFactorEnabledAt?: string;
    twoFactorRecoveryCodesRemaining?: number;
    kycStatus?: string;
    kycTier?: string;
  } | null;
};

const initialState: ProfileState = {
  loading: false,
  failed: false,
  user: null,
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
};

export default function ProfilePage() {
  const { status } = useAuth();
  const { submitToast } = useDemo();
  const [state, setState] = useState<ProfileState>(initialState);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [antiPhishingCode, setAntiPhishingCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [setupChallengeId, setSetupChallengeId] = useState("");
  const [setupQrCodeDataUrl, setSetupQrCodeDataUrl] = useState("");
  const [setupManualKey, setSetupManualKey] = useState("");
  const [enableCode, setEnableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodesPassword, setBackupCodesPassword] = useState("");
  const [backupCodesCode, setBackupCodesCode] = useState("");
  const [latestBackupCodes, setLatestBackupCodes] = useState<string[]>([]);
  const [twoFactorError, setTwoFactorError] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [enableBusy, setEnableBusy] = useState(false);
  const [disableBusy, setDisableBusy] = useState(false);
  const [backupCodesBusy, setBackupCodesBusy] = useState(false);

  const kycBadge = useMemo(() => {
    const statusValue = String(state.user?.kycStatus || "unverified");
    const tierValue = String(state.user?.kycTier || "none");
    return `${statusValue} (${tierValue})`;
  }, [state.user?.kycStatus, state.user?.kycTier]);

  const loadProfile = async () => {
    setState({ loading: true, failed: false, user: null });

    try {
      const payload = await fetchProfile();
      setState({
        loading: false,
        failed: false,
        user: payload.user,
      });
      setFullName(payload.user.fullName || "");
      setCountryCode(payload.user.countryCode || "US");
      setAntiPhishingCode(payload.user.antiPhishingCode || "");
    } catch {
      setState({
        loading: false,
        failed: true,
        user: null,
      });
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const payload = await fetchSessionHistoryRequest();
      setSessions(payload.items || []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") {
      setState(initialState);
      setSessions([]);
      return;
    }

    Promise.all([loadProfile(), loadSessions()]).catch(() => undefined);
  }, [status]);

  const saveProfile = async () => {
    if (!state.user) {
      return;
    }

    setProfileBusy(true);
    try {
      const payload = await updateProfile({
        fullName: fullName.trim(),
        countryCode: countryCode.trim().toUpperCase(),
        antiPhishingCode: antiPhishingCode.trim() || undefined,
      });
      setState((current) => ({ ...current, user: payload.user }));
      setFullName(payload.user.fullName || "");
      setCountryCode(payload.user.countryCode || "US");
      setAntiPhishingCode(payload.user.antiPhishingCode || "");
      submitToast("Profile updated", payload.message || "Profile information has been updated.");
      await loadProfile();
    } catch (error) {
      submitToast("Update failed", extractBackendErrorMessage(error) || "Unable to update profile.");
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      submitToast("Missing fields", "Enter current and new password.");
      return;
    }
    if (newPassword.length < 10) {
      submitToast("Weak password", "New password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      submitToast("Mismatch", "Password confirmation does not match.");
      return;
    }

    setPasswordBusy(true);
    try {
      const response = await changePasswordRequest({
        currentPassword,
        newPassword,
        currentRefreshToken: getRefreshToken() || undefined,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      submitToast("Password updated", response.message);
      await loadSessions();
    } catch (error) {
      submitToast("Password update failed", extractBackendErrorMessage(error) || "Unable to change password.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setSessionBusy(true);
    try {
      const response = await revokeSessionRequest({ sessionId });
      submitToast("Session revoked", response.message);
      await loadSessions();
    } catch (error) {
      submitToast("Revoke failed", extractBackendErrorMessage(error) || "Unable to revoke session.");
    } finally {
      setSessionBusy(false);
    }
  };

  const revokeOtherSessions = async () => {
    setSessionBusy(true);
    try {
      const response = await revokeOtherSessionsRequest({
        currentRefreshToken: getRefreshToken() || undefined,
      });
      submitToast("Other sessions revoked", response.message);
      await loadSessions();
    } catch (error) {
      submitToast("Revoke failed", extractBackendErrorMessage(error) || "Unable to revoke other sessions.");
    } finally {
      setSessionBusy(false);
    }
  };

  const startTwoFactorSetup = async () => {
    setSetupBusy(true);
    setTwoFactorError("");

    try {
      const setup = await setupTwoFactorRequest();
      setSetupChallengeId(setup.challengeId);
      setSetupQrCodeDataUrl(setup.qrCodeDataUrl);
      setSetupManualKey(setup.manualEntryKey);
      setEnableCode("");
      submitToast("2FA setup ready", "Scan the QR code and enter the authenticator code.");
    } catch (error) {
      setTwoFactorError(extractBackendErrorMessage(error) || "Unable to start two-factor setup.");
    } finally {
      setSetupBusy(false);
    }
  };

  const confirmEnableTwoFactor = async () => {
    if (!setupChallengeId || !enableCode.trim()) {
      setTwoFactorError("Enter the authenticator code to enable two-factor authentication.");
      return;
    }

    setEnableBusy(true);
    setTwoFactorError("");

    try {
      const response = await verifyEnableTwoFactorRequest({
        challengeId: setupChallengeId,
        code: enableCode.trim(),
      });
      setLatestBackupCodes(response.recoveryCodes || []);
      setSetupChallengeId("");
      setSetupQrCodeDataUrl("");
      setSetupManualKey("");
      setEnableCode("");
      submitToast("2FA enabled", "Two-factor authentication is now active.");
      await loadProfile();
    } catch (error) {
      setTwoFactorError(extractBackendErrorMessage(error) || "Unable to enable two-factor authentication.");
    } finally {
      setEnableBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!disablePassword.trim() && !disableCode.trim()) {
      setTwoFactorError("Provide your password or current two-factor code to disable 2FA.");
      return;
    }

    setDisableBusy(true);
    setTwoFactorError("");

    try {
      await disableTwoFactorRequest({
        password: disablePassword.trim() || undefined,
        code: disableCode.trim() || undefined,
      });
      setDisablePassword("");
      setDisableCode("");
      setLatestBackupCodes([]);
      submitToast("2FA disabled", "Two-factor authentication has been turned off.");
      await loadProfile();
    } catch (error) {
      setTwoFactorError(extractBackendErrorMessage(error) || "Unable to disable two-factor authentication.");
    } finally {
      setDisableBusy(false);
    }
  };

  const regenerateBackupCodes = async () => {
    if (!backupCodesPassword.trim() && !backupCodesCode.trim()) {
      setTwoFactorError("Provide your password or current 2FA code to regenerate backup codes.");
      return;
    }

    setBackupCodesBusy(true);
    setTwoFactorError("");

    try {
      const response = await regenerateTwoFactorBackupCodesRequest({
        password: backupCodesPassword.trim() || undefined,
        code: backupCodesCode.trim() || undefined,
      });
      setLatestBackupCodes(response.recoveryCodes || []);
      setBackupCodesPassword("");
      setBackupCodesCode("");
      submitToast("Backup codes ready", response.message);
      await loadProfile();
    } catch (error) {
      setTwoFactorError(extractBackendErrorMessage(error) || "Unable to regenerate backup codes.");
    } finally {
      setBackupCodesBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Profile"
        title="Account profile and security center"
        description="Manage your account identity, sign-in security, sessions, and verification posture from one secure workspace."
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
              <p className="text-xl font-semibold text-white">Profile unavailable</p>
              <p className="mt-2 text-sm text-muted">Your account profile is currently unavailable.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <p className="text-lg font-semibold text-white">Identity and preferences</p>
                  <div className="mt-4 grid gap-3">
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Full name"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    />
                    <input
                      value={state.user.email || ""}
                      disabled
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white/80"
                    />
                    <input
                      value={state.user.phone || ""}
                      disabled
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white/80"
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={countryCode}
                        onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
                        maxLength={2}
                        placeholder="Country code (US)"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      />
                      <input
                        value={antiPhishingCode}
                        onChange={(event) => setAntiPhishingCode(event.target.value)}
                        maxLength={20}
                        placeholder="Anti-phishing code"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      />
                    </div>
                    <Button type="button" className="w-full" onClick={saveProfile} disabled={profileBusy}>
                      {profileBusy ? "Saving profile..." : "Save profile settings"}
                    </Button>
                  </div>
                </Card>

                <Card>
                  <p className="text-lg font-semibold text-white">Security and compliance</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-muted">Security checks</p>
                      <p className="mt-1 text-white">
                        Email {state.user.emailVerified ? "verified" : "pending"} | Phone{" "}
                        {state.user.phoneVerified ? "verified" : "pending"} | 2FA{" "}
                        {state.user.twoFactorEnabled ? "enabled" : "disabled"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-muted">KYC</p>
                      <p className="mt-1 text-white">{kycBadge}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-muted">2FA enabled at</p>
                      <p className="mt-1 text-white">{formatDateTime(state.user.twoFactorEnabledAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-muted">Recovery codes remaining</p>
                      <p className="mt-1 text-white">{state.user.twoFactorRecoveryCodesRemaining ?? 0}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <p className="text-lg font-semibold text-white">Change password</p>
                  <div className="mt-4 grid gap-3">
                    <input
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      type="password"
                      placeholder="Current password"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    />
                    <input
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      type="password"
                      placeholder="New password (min 10 characters)"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    />
                    <input
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                      type="password"
                      placeholder="Confirm new password"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    />
                    <Button type="button" className="w-full" onClick={changePassword} disabled={passwordBusy}>
                      {passwordBusy ? "Updating password..." : "Update password"}
                    </Button>
                  </div>
                </Card>

                <Card>
                  <p className="text-lg font-semibold text-white">Authenticator app (2FA)</p>
                  {state.user.twoFactorEnabled ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-muted">2FA is active. Use password or code to disable or regenerate recovery codes.</p>
                      <input
                        value={disablePassword}
                        onChange={(event) => setDisablePassword(event.target.value)}
                        type="password"
                        placeholder="Password (optional)"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      />
                      <input
                        value={disableCode}
                        onChange={(event) => setDisableCode(event.target.value)}
                        type="text"
                        inputMode="numeric"
                        placeholder="Authenticator code (optional)"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <Button type="button" variant="secondary" onClick={disableTwoFactor} disabled={disableBusy}>
                          {disableBusy ? "Disabling..." : "Disable 2FA"}
                        </Button>
                        <Button type="button" onClick={regenerateBackupCodes} disabled={backupCodesBusy}>
                          {backupCodesBusy ? "Generating..." : "Regenerate backup codes"}
                        </Button>
                      </div>
                      <input
                        value={backupCodesPassword}
                        onChange={(event) => setBackupCodesPassword(event.target.value)}
                        type="password"
                        placeholder="Password for backup code regeneration"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      />
                      <input
                        value={backupCodesCode}
                        onChange={(event) => setBackupCodesCode(event.target.value)}
                        type="text"
                        inputMode="numeric"
                        placeholder="Current 2FA code for backup regeneration"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      />
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <Button className="w-full" type="button" onClick={startTwoFactorSetup} disabled={setupBusy}>
                        {setupBusy ? "Preparing setup..." : "Enable 2FA"}
                      </Button>
                      {setupQrCodeDataUrl ? (
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                          <img src={setupQrCodeDataUrl} alt="Two-factor QR code" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
                          <p className="text-xs text-muted">
                            Manual key: <span className="break-all text-white">{setupManualKey}</span>
                          </p>
                          <input
                            value={enableCode}
                            onChange={(event) => setEnableCode(event.target.value)}
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter authenticator code"
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                          />
                          <Button className="w-full" type="button" onClick={confirmEnableTwoFactor} disabled={enableBusy}>
                            {enableBusy ? "Enabling..." : "Verify and enable 2FA"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {latestBackupCodes.length ? (
                    <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                      <p className="text-sm font-semibold text-emerald-100">Store these backup codes securely</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {latestBackupCodes.map((code) => (
                          <p key={code} className="rounded-xl border border-emerald-300/20 bg-black/20 px-3 py-2 text-sm text-emerald-100">
                            {code}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {twoFactorError ? <p className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-200">{twoFactorError}</p> : null}
                </Card>
              </div>

              <Card>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-white">Active sessions</p>
                  <Button type="button" variant="secondary" onClick={revokeOtherSessions} disabled={sessionBusy}>
                    {sessionBusy ? "Updating..." : "Revoke other sessions"}
                  </Button>
                </div>
                {sessionsLoading ? (
                  <p className="mt-4 text-sm text-muted">Loading session activity...</p>
                ) : !sessions.length ? (
                  <p className="mt-4 text-sm text-muted">No active sessions available.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {sessions.map((session) => (
                      <div key={session.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
                        <p className="text-white">{session.userAgent || "Unknown device"}</p>
                        <p className="text-muted">IP: {session.ipAddress || "Unknown"}</p>
                        <p className="text-muted">Created: {formatDateTime(session.createdAt)}</p>
                        <p className="text-muted">Expires: {formatDateTime(session.expiresAt)}</p>
                        <Button type="button" variant="ghost" className="mt-2" onClick={() => revokeSession(session.id)} disabled={sessionBusy}>
                          Revoke session
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
