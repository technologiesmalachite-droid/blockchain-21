"use client";

import { clearSession, emitAuthRequired, getAccessToken, getRefreshToken, updateAccessToken } from "@/lib/auth/session-store";

type AuthMode = "none" | "required";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  auth?: AuthMode;
  body?: unknown;
};

export class ApiRequestError extends Error {
  status: number;
  code: "unauthorized" | "forbidden" | "network_error" | "request_failed";

  constructor(message: string, status = 0, code: ApiRequestError["code"] = "request_failed") {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
const DEFAULT_API_REQUEST_TIMEOUT_MS = 15000;
const parsedTimeoutMs = Number(process.env.NEXT_PUBLIC_API_REQUEST_TIMEOUT_MS || DEFAULT_API_REQUEST_TIMEOUT_MS);
const API_REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs >= 1000 ? parsedTimeoutMs : DEFAULT_API_REQUEST_TIMEOUT_MS;

let refreshPromise: Promise<string | null> | null = null;

const ensureApiBaseUrl = () => {
  if (!API_BASE_URL) {
    throw new ApiRequestError(
      "Service configuration is incomplete. Please refresh the page or contact support.",
      0,
      "network_error",
    );
  }

  return API_BASE_URL;
};

const buildUrl = (path: string) => {
  const baseUrl = ensureApiBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};

const toPublicErrorMessage = (status: number) => {
  if (status === 401 || status === 403) {
    return "Your session is not authorized. Please sign in again.";
  }

  if (status >= 500) {
    return "The service is temporarily unavailable. Please try again shortly.";
  }

  return "We couldn't complete this request right now. Please try again.";
};

const getApiErrorMessage = async (response: Response) => {
  const fallback = toPublicErrorMessage(response.status);
  const payload = await parseJson<{ message?: string }>(response);
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  return message || fallback;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();

  if (!text) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError";

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      const message = externalSignal?.aborted
        ? "Request was canceled."
        : "Request timed out. Please try again.";
      throw new ApiRequestError(message, 0, "network_error");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternalSignal);
    }
  }
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetchWithTimeout(buildUrl("/auth/refresh"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          return null;
        }

        const payload = await parseJson<{ accessToken: string }>(response);

        if (!payload?.accessToken) {
          return null;
        }

        updateAccessToken(payload.accessToken);
        return payload.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

const handleAuthFailure = () => {
  clearSession();
  emitAuthRequired("Your session expired. Please sign in to continue.");
};

const requestOnce = async <T>(path: string, options: ApiRequestOptions, accessToken: string | null): Promise<Response> => {
  const headers = new Headers(options.headers || {});

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetchWithTimeout(buildUrl(path), {
    ...options,
    credentials: "include",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
};

export const apiRequest = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const authMode = options.auth ?? "none";
  let accessToken = authMode === "required" ? getAccessToken() : null;

  if (authMode === "required" && !accessToken) {
    emitAuthRequired();
    throw new ApiRequestError("Authentication required.", 401, "unauthorized");
  }

  let response: Response;

  try {
    response = await requestOnce<T>(path, options, accessToken);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }

    throw new ApiRequestError("Network request failed. Check your connection and retry.", 0, "network_error");
  }

  if ((response.status === 401 || response.status === 403) && authMode === "required") {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      accessToken = refreshedToken;
      try {
        response = await requestOnce<T>(path, options, accessToken);
      } catch (error) {
        if (error instanceof ApiRequestError) {
          throw error;
        }

        throw new ApiRequestError("Network request failed. Check your connection and retry.", 0, "network_error");
      }
    }
  }

  if (response.status === 401 || response.status === 403) {
    const message = await getApiErrorMessage(response);

    if (authMode === "required") {
      handleAuthFailure();
      throw new ApiRequestError(message || "Authentication required.", response.status, response.status === 403 ? "forbidden" : "unauthorized");
    }

    throw new ApiRequestError(message || "You are not authorized to access this resource.", response.status, response.status === 403 ? "forbidden" : "unauthorized");
  }

  if (!response.ok) {
    throw new ApiRequestError(await getApiErrorMessage(response), response.status, "request_failed");
  }

  return parseJson<T>(response);
};
