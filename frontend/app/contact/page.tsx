import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        title="Reach the support team"
        description="Submit account or trading-related issues and receive assistance through standard support channels."
        badge="24/7 support preview"
      />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="text-lg font-semibold text-white">Support channels</p>
            <p className="mt-3 text-sm text-muted">Email: support@malachitex.com</p>
            <p className="mt-1 text-sm text-muted">Priority desk: +1 (415) 555-0199</p>
            <p className="mt-1 text-sm text-muted">Ticketing and live chat are represented as placeholders for live integration.</p>
          </Card>
          <Card>
            <p className="text-lg font-semibold text-white">Response times</p>
            <p className="mt-3 text-sm text-muted">General inquiries: within 24 hours</p>
            <p className="mt-1 text-sm text-muted">Account access issues: within 4 hours</p>
            <p className="mt-1 text-sm text-muted">Critical security reports: immediate priority triage</p>
          </Card>
        </div>
      </ContentSection>
    </>
  );
}
