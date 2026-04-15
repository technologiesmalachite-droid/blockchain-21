import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" description="Data handling, retention, account protection, and compliance disclosure for platform users and support processes." />
      <ContentSection>
        <Card>
          <div className="space-y-6 text-sm leading-8 text-muted">
            <p>
              MalachiteX processes personal and transaction data to provide account authentication, wallet operations, KYC onboarding, fraud controls, customer support, and regulatory reporting.
            </p>
            <p>
              We collect account identity details, device/session metadata, verification submissions, and transaction records. Sensitive security material is protected using encryption and role-based access controls.
            </p>
            <p>
              We share data only with authorized processors and infrastructure providers needed to operate the service, and with regulators or law enforcement when required by law.
            </p>
            <p>
              Data retention periods depend on legal and compliance obligations. Certain records may be retained after account closure to satisfy AML, audit, dispute, and tax requirements.
            </p>
            <p>
              You may request profile updates and account support actions from the authenticated support center. Some deletion requests may be limited where retention is legally required.
            </p>
          </div>
        </Card>
      </ContentSection>
    </>
  );
}
