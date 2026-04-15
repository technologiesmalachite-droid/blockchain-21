import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const parsePrivateKey = (privateKey) => {
  if (!privateKey || typeof privateKey !== "string") {
    return "";
  }

  return privateKey.replace(/\\n/g, "\n");
};

const readServiceAccountFromJson = () => {
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      projectId: parsed.project_id || parsed.projectId || "",
      clientEmail: parsed.client_email || parsed.clientEmail || "",
      privateKey: parsePrivateKey(parsed.private_key || parsed.privateKey || ""),
      storageBucket: parsed.storage_bucket || parsed.storageBucket || process.env.FIREBASE_ADMIN_STORAGE_BUCKET || "",
    };
  } catch {
    const error = new Error("FIREBASE_ADMIN_CREDENTIALS_JSON is invalid JSON.");
    error.code = "CONFIG_FIREBASE_ADMIN_INVALID";
    throw error;
  }
};

const readServiceAccountFromEnv = () => ({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "",
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "",
  privateKey: parsePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY || ""),
  storageBucket: process.env.FIREBASE_ADMIN_STORAGE_BUCKET || "",
});

const resolveServiceAccountConfig = () => {
  const fromJson = readServiceAccountFromJson();
  const config = fromJson || readServiceAccountFromEnv();

  if (!config.projectId || !config.clientEmail || !config.privateKey) {
    const error = new Error("Firebase Admin credentials are missing. Configure FIREBASE_ADMIN_* env vars.");
    error.code = "CONFIG_FIREBASE_ADMIN_MISSING";
    throw error;
  }

  return config;
};

const getFirebaseAdminApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = resolveServiceAccountConfig();

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
    projectId: serviceAccount.projectId,
    storageBucket: serviceAccount.storageBucket || undefined,
  });
};

const shouldVerifyRevokedTokens = () => {
  const raw = process.env.FIREBASE_VERIFY_REVOKED_TOKENS;
  if (typeof raw === "string") {
    return raw.trim().toLowerCase() === "true";
  }

  return process.env.NODE_ENV === "production";
};

export const verifyFirebaseIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== "string") {
    const error = new Error("Firebase ID token is required.");
    error.code = "auth/invalid-id-token";
    throw error;
  }

  const app = getFirebaseAdminApp();
  const auth = getAuth(app);
  const decoded = await auth.verifyIdToken(idToken, shouldVerifyRevokedTokens());

  if (!decoded?.uid || !decoded?.email) {
    const error = new Error("Firebase token is missing required claims.");
    error.code = "auth/invalid-id-token";
    throw error;
  }

  return decoded;
};
