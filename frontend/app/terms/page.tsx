import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of service" description="Core platform usage terms, eligibility clauses, prohibited behaviors, and service limitations for a crypto exchange product." />
      <ContentSection>
        <Card>
          <div className="space-y-6 text-sm leading-8 text-muted">
            <p>
              By using MalachiteX, you confirm that you are legally eligible to access digital asset services in your jurisdiction and agree to follow applicable sanctions, AML, and tax rules.
            </p>
            <p>
              Account access depends on identity verification, risk controls, and platform policies. MalachiteX may delay, restrict, or cancel transactions when required by compliance, fraud prevention, security, or legal obligations.
            </p>
            <p>
              You are responsible for safeguarding credentials, authenticator codes, backup codes, and approved withdrawal addresses. Any action signed with your account session may be treated as authorized unless reported promptly.
            </p>
            <p>
              Trading and wallet services may be interrupted by volatility, liquidity constraints, blockchain congestion, provider outages, or maintenance windows. MalachiteX does not guarantee execution timing, price, or uninterrupted service.
            </p>
            <p>
              Fees, limits, and supported assets may change with notice. Continued usage after policy updates constitutes acceptance of the revised terms.
            </p>
          </div>
        </Card>
      </ContentSection>
    </>
  );
}
