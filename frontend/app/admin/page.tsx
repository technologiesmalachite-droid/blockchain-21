"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  fetchAdminAnalytics,
  fetchComplianceCases,
  fetchComplianceOverview,
  fetchKycQueue,
  resolveComplianceCase,
  type AdminCase,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

export default function AdminPage() {
  const { user } = useAuth();
  const { submitToast } = useDemo();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [overview, setOverview] = useState<{
    openCases: number;
    highRiskCases: number;
    pendingKyc: number;
    restrictedAccounts: number;
    avgRiskScore: number;
  } | null>(null);
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [kycQueue, setKycQueue] = useState<Array<Record<string, unknown>>>([]);

  const loadAdminData = async () => {
    setLoading(true);

    try {
      const [analytics, complianceOverview, complianceCases, queue] = await Promise.all([
        fetchAdminAnalytics(),
        fetchComplianceOverview(),
        fetchComplianceCases(),
        fetchKycQueue(),
      ]);

      setMetrics(analytics.metrics || {});
      setOverview(complianceOverview.overview);
      setCases(complianceCases.items || []);
      setKycQueue(queue.items || []);
    } catch {
      submitToast("Admin data unavailable", "Unable to load compliance dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleResolveCase = async (caseId: string) => {
    try {
      await resolveComplianceCase(caseId, "resolved_by_admin");
      submitToast("Case resolved", "Compliance case has been marked as resolved.");
      await loadAdminData();
    } catch {
      submitToast("Action failed", "Unable to resolve this compliance case right now.");
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Admin Dashboard"
        title="Compliance, risk, and operations control center"
        description="Monitor KYC queues, sanctions exposure, transaction risks, and manual review actions from one protected workspace."
        badge="Admin role required"
      />
      <ContentSection>
        <ProtectedRoute>
          {user?.role !== "admin" ? (
            <Card>
              <p className="text-lg font-semibold text-white">Admin access required</p>
              <p className="mt-2 text-sm text-muted">This dashboard is restricted to compliance and operations administrators.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                <Card><p className="text-xs uppercase tracking-[0.14em] text-muted">Open cases</p><p className="mt-3 text-2xl font-semibold text-white">{overview?.openCases ?? 0}</p></Card>
                <Card><p className="text-xs uppercase tracking-[0.14em] text-muted">High risk</p><p className="mt-3 text-2xl font-semibold text-white">{overview?.highRiskCases ?? 0}</p></Card>
                <Card><p className="text-xs uppercase tracking-[0.14em] text-muted">Pending KYC</p><p className="mt-3 text-2xl font-semibold text-white">{overview?.pendingKyc ?? 0}</p></Card>
                <Card><p className="text-xs uppercase tracking-[0.14em] text-muted">Restricted accts</p><p className="mt-3 text-2xl font-semibold text-white">{overview?.restrictedAccounts ?? 0}</p></Card>
                <Card><p className="text-xs uppercase tracking-[0.14em] text-muted">Avg risk</p><p className="mt-3 text-2xl font-semibold text-white">{overview?.avgRiskScore ?? 0}</p></Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <Card>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-lg font-semibold text-white">Compliance cases</p>
                    {loading ? <p className="text-xs text-muted">Refreshing...</p> : null}
                  </div>
                  {!cases.length ? (
                    <p className="text-sm text-muted">No compliance cases currently open.</p>
                  ) : (
                    <div className="space-y-3">
                      {cases.slice(0, 8).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-medium text-white">{item.title}</p>
                            <span className="text-xs uppercase tracking-[0.12em] text-muted">{item.severity} risk {item.riskScore}</span>
                          </div>
                          <p className="mt-2 text-muted">{item.description}</p>
                          <p className="mt-2 text-xs text-muted">User: {item.user?.email || "Unknown"} | Status: {item.status}</p>
                          {item.status === "open" ? (
                            <Button className="mt-3" variant="secondary" onClick={() => handleResolveCase(item.id)}>
                              Resolve case
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <div className="space-y-6">
                  <Card>
                    <p className="text-lg font-semibold text-white">KYC review queue</p>
                    {!kycQueue.length ? (
                      <p className="mt-3 text-sm text-muted">No submissions waiting for manual review.</p>
                    ) : (
                      <div className="mt-3 space-y-3 text-sm text-muted">
                        {kycQueue.slice(0, 6).map((item, index) => (
                          <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p>Status: {String(item.status || "under_review")}</p>
                            <p>Method: {String(item.selectedMethod || "--")}</p>
                            <p>Risk score: {String(item.riskScore || "--")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                  <Card>
                    <p className="text-lg font-semibold text-white">Operations metrics</p>
                    <div className="mt-3 space-y-2 text-sm text-muted">
                      <p>Active users (24h): {metrics.activeUsers24h ?? 0}</p>
                      <p>Trading volume (24h): {metrics.tradingVolume24h ?? 0}</p>
                      <p>Platform fees (24h): {metrics.platformFees24h ?? 0}</p>
                      <p>Flagged accounts: {metrics.flaggedAccounts ?? 0}</p>
                      <p>Open support tickets: {metrics.ticketsOpen ?? 0}</p>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
