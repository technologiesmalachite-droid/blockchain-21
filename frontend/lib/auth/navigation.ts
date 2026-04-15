const AUTH_PAGE_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"] as const;

const normalizePathname = (path: string) => path.split("?")[0]?.split("#")[0]?.toLowerCase() || "/";

const isAuthPagePath = (path: string) => {
  const normalized = normalizePathname(path);
  return AUTH_PAGE_PATHS.some((authPath) => normalized === authPath || normalized.startsWith(`${authPath}/`));
};

const isSafeRelativePath = (path: string) => path.startsWith("/") && !path.startsWith("//");

export const sanitizePostAuthPath = (rawPath: string | null | undefined, fallback = "/wallet") => {
  const safeFallback = isAuthPagePath(fallback) ? "/wallet" : fallback;

  if (!rawPath) {
    return safeFallback;
  }

  const candidate = rawPath.trim();

  if (!candidate || !isSafeRelativePath(candidate) || isAuthPagePath(candidate)) {
    return safeFallback;
  }

  return candidate;
};
