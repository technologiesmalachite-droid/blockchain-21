import { SignupPageClient } from "@/components/auth/SignupPageClient";

type SignupPageProps = {
  searchParams?: {
    next?: string | string[];
  };
};

export default function SignupPage({ searchParams }: SignupPageProps) {
  const nextParam = searchParams?.next;
  const rawNextPath = Array.isArray(nextParam) ? nextParam[0] || null : typeof nextParam === "string" ? nextParam : null;
  return <SignupPageClient rawNextPath={rawNextPath} />;
}
