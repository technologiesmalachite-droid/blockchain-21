"use client";

import { FirebaseError } from "firebase/app";
import {
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase";

export type GoogleSignInResult =
  | {
      redirected: false;
      credential: UserCredential;
    }
  | {
      redirected: true;
      credential: null;
    };

const popupFallbackCodes = new Set(["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

const isFirebaseError = (error: unknown): error is FirebaseError =>
  error instanceof FirebaseError || (typeof error === "object" && error !== null && "code" in error);

export const getFirebaseErrorCode = (error: unknown): string => {
  if (!isFirebaseError(error)) {
    return "unknown";
  }

  return typeof error.code === "string" ? error.code : "unknown";
};

export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName?.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }

  return credential;
};

export const signInWithEmail = (email: string, password: string) => signInWithEmailAndPassword(getFirebaseAuth(), email, password);

export const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const credential = await signInWithPopup(auth, provider);
    return {
      redirected: false,
      credential,
    };
  } catch (error) {
    const code = getFirebaseErrorCode(error);
    if (!popupFallbackCodes.has(code)) {
      throw error;
    }

    await signInWithRedirect(auth, provider);
    return {
      redirected: true,
      credential: null,
    };
  }
};

export const signOutUser = () => signOut(getFirebaseAuth());

export const getCurrentUser = (): User | null => {
  if (!isFirebaseClientConfigured || typeof window === "undefined") {
    return null;
  }

  return getFirebaseAuth().currentUser;
};

export const observeAuthState = (callback: (user: User | null) => void) => {
  if (!isFirebaseClientConfigured || typeof window === "undefined") {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(getFirebaseAuth(), callback);
};

export const getCurrentIdToken = async (forceRefresh = false) => {
  const user = getCurrentUser();
  if (!user) {
    return null;
  }

  return user.getIdToken(forceRefresh);
};

export const deleteCurrentUserSafe = async () => {
  const user = getCurrentUser();
  if (!user) {
    return;
  }

  try {
    await deleteUser(user);
  } catch {
    // Keep client session clean even if user deletion fails.
  }
};

export const resendCurrentUserVerificationEmail = async () => {
  const user = getCurrentUser();
  if (!user) {
    const error = new Error("No authenticated Firebase user session found.") as Error & { code: string };
    error.code = "auth/no-current-user";
    throw error;
  }

  if (user.emailVerified) {
    return false;
  }

  await sendEmailVerification(user);
  return true;
};

export const getFriendlyFirebaseAuthError = (error: unknown): string | null => {
  const code = getFirebaseErrorCode(error);

  switch (code) {
    case "auth/configuration-not-found":
      return "Authentication is not configured yet. Please contact support.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/missing-password":
    case "auth/weak-password":
      return "Password is too weak. Please use a stronger password.";
    case "auth/email-already-in-use":
      return "This email is already registered. Try signing in instead.";
    case "auth/user-not-found":
      return "No account found for this email.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled before completion.";
    case "auth/popup-blocked":
      return "Popup was blocked. Allow popups or try again.";
    case "auth/network-request-failed":
      return "Network issue while contacting Firebase. Please try again.";
    case "auth/too-many-requests":
      return "Too many requests. Please wait and try again.";
    case "auth/no-current-user":
      return "Please sign in first to resend verification email.";
    default:
      return null;
  }
};
