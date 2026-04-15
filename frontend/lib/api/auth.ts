"use client";

import type { AuthSession, AuthUser } from "@/lib/auth/session-store";
import { apiRequest } from "@/lib/api/client";

export type LoginPayload = {
  email: string;
  password: string;
  twoFactorCode?: string;
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

type AuthResponse = AuthSession;

export const loginRequest = (payload: LoginPayload) =>
  apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });

export const registerRequest = (payload: RegisterPayload) =>
  apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: payload,
  });

export const firebaseSessionRequest = (payload: FirebaseSessionPayload) =>
  apiRequest<AuthResponse>("/auth/firebase/session", {
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

export const setupTwoFactorRequest = (payload: { enable: boolean; backupCode?: string }) =>
  apiRequest<{ message: string; user: AuthUser; secret?: string }>("/auth/2fa/setup", {
    auth: "required",
    method: "POST",
    body: payload,
  });

export const fetchSessionHistoryRequest = () =>
  apiRequest<{ items: Array<{ id: string; createdAt: string; expiresAt: string; userAgent: string; ipAddress: string }> }>(
    "/auth/sessions",
    {
      auth: "required",
    },
  );
