"use client";

import { ApiRequestError } from "@/lib/api/client";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const parseJsonMessageString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (isRecord(parsed) && typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    return "";
  }

  return "";
};

const readNestedMessage = (value: unknown): string => {
  if (!isRecord(value)) {
    return "";
  }

  if (typeof value.message === "string" && value.message.trim()) {
    return value.message.trim();
  }

  if (isRecord(value.data) && typeof value.data.message === "string" && value.data.message.trim()) {
    return value.data.message.trim();
  }

  return "";
};

const readValidationIssueMessage = (value: unknown): string => {
  if (!isRecord(value) || !Array.isArray(value.issues) || value.issues.length === 0) {
    return "";
  }

  const firstIssue = value.issues[0];
  if (!isRecord(firstIssue) || typeof firstIssue.message !== "string") {
    return "";
  }

  return firstIssue.message.trim();
};

export const extractBackendErrorMessage = (requestError: unknown): string => {
  const fromApiRequestError = requestError instanceof ApiRequestError ? requestError.message?.trim() || "" : "";
  const fromResponse = isRecord(requestError) ? readNestedMessage(requestError.response) : "";
  const fromResponseData =
    isRecord(requestError) && "response" in requestError && isRecord(requestError.response)
      ? readNestedMessage(requestError.response.data)
      : "";
  const fromResponseValidationIssue =
    isRecord(requestError) && "response" in requestError && isRecord(requestError.response)
      ? readValidationIssueMessage(requestError.response.data)
      : "";
  const fromDirectValidationIssue = readValidationIssueMessage(requestError);
  const fromDirect = readNestedMessage(requestError);
  const fromTopMessage = isRecord(requestError) && typeof requestError.message === "string" ? requestError.message.trim() : "";
  const parsedFromTopMessage = parseJsonMessageString(fromTopMessage);

  const candidates = [
    fromResponseData,
    fromResponseValidationIssue,
    fromResponse,
    fromDirectValidationIssue,
    fromDirect,
    parsedFromTopMessage,
    fromApiRequestError,
    fromTopMessage,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return "";
};
