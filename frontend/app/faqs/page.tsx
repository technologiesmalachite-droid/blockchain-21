import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

const faqs = [
  "How do I secure my account with 2FA?",
  "How long do deposits and withdrawals take?",
  "Where can I review open orders and position history?",
  "What fees apply for spot, futures, and wallet transfers?",
];

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQs"
        title="Frequently asked questions"
        description="Quick answers to the most common account, trading, and wallet questions."
        badge="Knowledge base"
      />
      <ContentSection>
        <div className="space-y-4">
          {faqs.map((item) => (
            <Card key={item}>
              <p className="text-base font-medium text-white">{item}</p>
              <p className="mt-2 text-sm text-muted">Detailed answer content is structured as a support-ready placeholder for production documentation.</p>
            </Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}
