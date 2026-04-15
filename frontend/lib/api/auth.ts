"use client";

import type { AuthSession, AuthUser } from "@/lib/auth/session-store";
import { apiRequest } from "@/lib/api/client";

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  countryCode: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export type FirebaseSessionPayload = {
  idToken: string;
  countryCode?: string;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
};

export type TwoFactorLoginChallenge = {
  requiresTwoFactor: true;
  loginToken: string;
  message: string;
};

export type AuthStepResult = AuthSession | TwoFactorLoginChallenge;

export type TwoFactorSetupResponse = {
  message: string;
  challengeId: string;
  expiresAt: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
};

export type SessionHistoryItem = {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string;
  ipAddress: string;
};

export const loginRequest = (payload: LoginPayload) =>
  apiRequest<AuthStepResult>("/auth/login", {
    method: "POST",
    body: payload,
  });

export const verifyTwoFactorLoginRequest = (payload: { loginToken: string; code: string }) =>
  apiRequest<AuthSession>("/auth/2fa/login-verify", {
    method: "POST",
    body: payload,
  });

export const registerRequest = (payload: RegisterPayload) =>
  apiRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: payload,
  });

export const firebaseSessionRequest = (payload: FirebaseSessionPayload) =>
  apiRequest<AuthStepResult>("/auth/firebase/session", {
    method: "POST",
    body: payload,
  });

export const logoutRequest = (refreshToken: string) =>
  apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    body: { refreshToken },
  });

export const getProfileRequest = () =>
  apiRequest<{ user: AuthUser }>("/user/profile", {
    auth: "required",
  });

export const sendVerificationCodeRequest = (channel: "email" | "phone") =>
  apiRequest<{ message: string; challengeId: string; expiresAt: string }>("/auth/verification/send", {
    auth: "required",
    method: "POST",
    body: { channel },
  });

export const confirmVerificationCodeRequest = (payload: { channel: "email" | "phone"; code: string }) =>
  apiRequest<{ message: string; user: AuthUser }>("/auth/verification/confirm", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const setupTwoFactorRequest = () =>
  apiRequest<TwoFactorSetupResponse>("/auth/2fa/setup", {
    auth: "required",
    method: "POST",
    body: {},
  });

export const verifyEnableTwoFactorRequest = (payload: { challengeId: string; code: string }) =>
  apiRequest<{ message: string; user: AuthUser; recoveryCodes?: string[] }>("/auth/2fa/verify-enable", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const disableTwoFactorRequest = (payload: { password?: string; code?: string }) =>
  apiRequest<{ message: string; user: AuthUser }>("/auth/2fa/disable", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchSessionHistoryRequest = () =>
  apiRequest<{ items: SessionHistoryItem[] }>("/auth/sessions", {
    auth: "required",
  });

export const forgotPasswordRequest = (payload: { email: string }) =>
  apiRequest<{ message: string; resetToken?: string }>("/auth/forgot-password", {
    method: "POST",
    body: payload,
  });

export const resetPasswordRequest = (payload: { token: string; password: string }) =>
  apiRequest<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: payload,
  });

export const changePasswordRequest = (payload: {
  currentPassword: string;
  newPassword: string;
  currentRefreshToken?: string;
}) =>
  apiRequest<{ message: string }>("/auth/change-password", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const revokeSessionRequest = (payload: { sessionId: string }) =>
  apiRequest<{ message: string }>("/auth/sessions/revoke", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const revokeOtherSessionsRequest = (payload?: { currentRefreshToken?: string }) =>
  apiRequest<{ message: string }>("/auth/sessions/revoke-others", {
    auth: "required",
    method: "POST",
    body: payload || {},
  });

export const regenerateTwoFactorBackupCodesRequest = (payload: { password?: string; code?: string }) =>
  apiRequest<{ message: string; recoveryCodes: string[]; user: AuthUser }>("/auth/2fa/backup-codes/regenerate", {
    auth: "required",
    method: "POST",
    body: payload,
  });
