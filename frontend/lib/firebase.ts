"use client";

import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredFirebaseClientConfigKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const missingClientConfig = requiredFirebaseClientConfigKeys.filter((key) => {
  const value = process.env[key as keyof NodeJS.ProcessEnv];
  return !value || !value.trim();
});

export const isFirebaseClientConfigured = missingClientConfig.length === 0;

if (!isFirebaseClientConfigured && typeof window !== "undefined") {
  console.warn(`Firebase client config is incomplete. Missing: ${missingClientConfig.join(", ")}`);
}

const createFirebaseConfigError = () => {
  const error = new Error(
    `Firebase client configuration is incomplete. Missing: ${missingClientConfig.join(", ") || "unknown fields"}`,
  ) as Error & { code: string };
  error.code = "auth/configuration-not-found";
  return error;
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let persistenceInitialized = false;

export const getFirebaseApp = () => {
  if (!isFirebaseClientConfigured) {
    throw createFirebaseConfigError();
  }

  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  return app;
};

export const getFirebaseAuth = () => {
  if (typeof window === "undefined") {
    throw createFirebaseConfigError();
  }

  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }

  if (!persistenceInitialized) {
    persistenceInitialized = true;
    setPersistence(auth, browserLocalPersistence).catch(() => {
      console.warn("Firebase auth persistence fallback: browser local persistence is unavailable.");
    });
  }

  return auth;
};

export { app, auth };
