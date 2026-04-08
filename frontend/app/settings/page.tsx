import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <>
      <PageHero eyebrow="Profile & Settings" title="Personal info, security controls, and device management" description="Manage profile details, 2FA, anti-phishing code, device sessions, notification preferences, and verification status." badge="Account center" />
      <ContentSection>
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            "Personal information and regional preferences",
            "Security settings with 2FA and anti-phishing code",
            "Notification settings and payment method placeholders",
            "Linked devices, session management, and verification state",
          ].map((item) => (
            <Card key={item}><p className="text-lg font-semibold text-white">{item}</p><p className="mt-3 text-sm text-muted">Structured UI section ready for protected API integration.</p></Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}

