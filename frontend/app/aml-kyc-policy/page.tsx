import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function AmlKycPolicyPage() {
  return (
    <>
      <PageHero
        eyebrow="Compliance"
        title="AML / KYC policy"
        description="Identity verification, sanctions screening, transaction monitoring, and account controls for regulatory compliance."
      />
      <ContentSection>
        <Card>
          <div className="space-y-6 text-sm leading-8 text-muted">
            <p>
              MalachiteX applies a risk-based AML and KYC framework to verify customer identity, assess transaction behavior, and prevent misuse of the platform.
            </p>
            <p>
              Users are required to provide accurate identity and contact data, complete document verification when requested, and respond to resubmission requirements during ongoing reviews.
            </p>
            <p>
              The platform performs sanctions screening and may restrict or freeze accounts where screening, fraud analysis, or regulatory obligations indicate elevated risk.
            </p>
            <p>
              Suspicious activity is escalated to internal compliance review and may be reported to competent authorities according to applicable law.
            </p>
            <p>
              Withdrawals, transfers, or trading privileges can be limited until verification obligations are completed and risk checks pass.
            </p>
          </div>
        </Card>
      </ContentSection>
    </>
  );
}

