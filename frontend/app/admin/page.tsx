import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function AdminPage() {
  return (
    <>
      <PageHero eyebrow="Admin Dashboard" title="Operations, compliance, support, and risk oversight" description="Role-based admin placeholders for user management, KYC review, transaction monitoring, analytics, fraud signals, and configuration." badge="Admin role required" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-4">
          {[
            "User management",
            "KYC review queue",
            "Deposits and withdrawals",
            "Support ticket queue",
            "Trading summaries",
            "Revenue analytics",
            "Fraud and risk flags",
            "Platform settings",
          ].map((item) => (
            <Card key={item}><p className="text-lg font-semibold text-white">{item}</p><p className="mt-3 text-sm text-muted">Operational component prepared for RBAC and protected endpoints.</p></Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}

