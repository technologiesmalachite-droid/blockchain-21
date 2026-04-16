import { LoginPageClient } from "@/components/auth/LoginPageClient";

type LoginPageProps = {
  searchParams?: {
    next?: string | string[];
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const nextParam = searchParams?.next;
  const rawNextPath = Array.isArray(nextParam) ? nextParam[0] || null : typeof nextParam === "string" ? nextParam : null;
  return <LoginPageClient rawNextPath={rawNextPath} />;
}
