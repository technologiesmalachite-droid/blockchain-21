import { ContentSection, PageHero } from "@/components/PageShell";
import { Card } from "@/components/ui/Card";
import { jobs } from "@/data/demo";

export default function CareersPage() {
  return (
    <>
      <PageHero eyebrow="Careers" title="Join the team building trusted Web3 financial products" description="Open roles across design, exchange engineering, risk, and operations for a globally distributed fintech organization." />
      <ContentSection>
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.title} className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">{job.title}</p>
                <p className="text-sm text-muted">{job.team} | {job.location}</p>
              </div>
              <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-muted">Apply</div>
            </Card>
          ))}
        </div>
      </ContentSection>
    </>
  );
}
