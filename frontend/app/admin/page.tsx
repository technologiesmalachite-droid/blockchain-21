"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  fetchAdminAnalytics,
  fetchAdminAuditLogs,
  fetchComplianceCases,
  fetchComplianceOverview,
  fetchAdminKycDocumentBlob,
  fetchKycQueue,
  postKycReview,
  resolveComplianceCase,
  type AdminCase,
  type KycQueueItem,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

type ReviewDraft = {
  decision: "approved" | "rejected" | "under_review" | "request_resubmission";
  note: string;
  rejectionReason: string;
};

const initialDraft: ReviewDraft = {
  decision: "under_review",
  note: "",
  rejectionReason: "",
};

export default function AdminPage() {
  const { user } = useAuth();
  const { submitToast } = useDemo();
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [overview, setOverview] = useState<{
    openCases: number;
    highRiskCases: number;
    pendingKyc: number;
    restrictedAccounts: number;
    avgRiskScore: number;
  } | null>(null);
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [kycQueue, setKycQueue] = useState<KycQueueItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});

  const groupedQueue = useMemo(() => {
    const groups = {
      under_review: [] as KycQueueItem[],
      needs_resubmission: [] as KycQueueItem[],
      rejected: [] as KycQueueItem[],
      approved: [] as KycQueueItem[],
    };

    kycQueue.forEach((item) => {
      if (item.status === "under_review" || item.status === "documents_submitted") {
        groups.under_review.push(item);
        return;
      }

      if (item.status === "needs_resubmission") {
        groups.needs_resubmission.push(item);
        return;
      }

      if (item.status === "rejected") {
        groups.rejected.push(item);
        return;
      }

      if (item.status === "approved") {
        groups.approved.push(item);
      }
    });

    return groups;
  }, [kycQueue]);

  const loadAdminData = async () => {
    setLoading(true);

    try {
      const [analytics, complianceOverview, complianceCases, queue, logs] = await Promise.all([
        fetchAdminAnalytics(),
        fetchComplianceOverview(),
        fetchComplianceCases(),
        fetchKycQueue(),
        fetchAdminAuditLogs(),
      ]);

      setMetrics(analytics.metrics || {});
      setOverview(complianceOverview.overview);
      setCases(complianceCases.items || []);
      setKycQueue(queue.items || []);
      setAuditLogs(logs.items || []);
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

  const getDraft = (caseId: string) => drafts[caseId] || initialDraft;

  const setDraft = (caseId: string, patch: Partial<ReviewDraft>) => {
    setDrafts((current) => ({
      ...current,
      [caseId]: {
        ...getDraft(caseId),
        ...patch,
      },
    }));
  };

  const handleResolveCase = async (caseId: string) => {
    try {
      await resolveComplianceCase(caseId, "resolved_by_admin");
      submitToast("Case resolved", "Compliance case has been marked as resolved.");
      await loadAdminData();
    } catch {
      submitToast("Action failed", "Unable to resolve this compliance case right now.");
    }
  };

  const submitReview = async (item: KycQueueItem) => {
    const draft = getDraft(item.id);

    if ((draft.decision === "rejected" || draft.decision === "request_resubmission") && !draft.rejectionReason.trim()) {
      submitToast("Reason required", "Enter rejection/resubmission reason before submitting the decision.");
      return;
    }

    setReviewingId(item.id);
    try {
      await postKycReview({
        submissionId: item.id,
        decision: draft.decision,
        note: draft.note.trim() || undefined,
        rejectionReason: draft.rejectionReason.trim() || undefined,
      });
      submitToast("Review updated", "KYC decision saved successfully.");
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await loadAdminData();
    } catch {
      submitToast("Review failed", "Unable to save KYC review decision.");
    } finally {
      setReviewingId(null);
    }
  };

  const previewDocument = async (documentId: string) => {
    try {
      const blob = await fetchAdminKycDocumentBlob(documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch {
      submitToast("Preview unavailable", "Unable to open secure document preview.");
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Admin Dashboard"
        title="Compliance, KYC review, and risk controls"
        description="Review verification submissions, inspect secure document previews, and make explicit approve/reject/resubmission decisions with audit traceability."
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
                    <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                      <p>Under review: {groupedQueue.under_review.length}</p>
                      <p>Needs resubmission: {groupedQueue.needs_resubmission.length}</p>
                      <p>Rejected: {groupedQueue.rejected.length}</p>
                      <p>Approved: {groupedQueue.approved.length}</p>
                    </div>
                    {!kycQueue.length ? (
                      <p className="mt-3 text-sm text-muted">No submissions waiting for manual review.</p>
                    ) : (
                      <div className="mt-4 space-y-4 text-sm text-muted">
                        {kycQueue.slice(0, 8).map((item) => {
                          const draft = getDraft(item.id);
                          return (
                            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <p className="text-white">{item.user?.fullName || item.user?.email || "User"}</p>
                              <p>Status: {item.status}</p>
                              <p>Method: {item.selectedMethod || "--"}</p>
                              <p>Risk score: {item.riskScore || 0}</p>
                              {item.rejectionReason ? <p className="text-rose-200">Last reason: {item.rejectionReason}</p> : null}
                              <div className="mt-2 space-y-2">
                                {item.documents.map((document) => (
                                  <div key={document.id} className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs">
                                    <p>{document.documentGroup} ({document.documentSide}) - {document.status}</p>
                                    <p>{document.mimeType} - {(document.fileSizeBytes / 1024).toFixed(1)} KB</p>
                                    {document.maskedIdentifier ? <p>Masked: {document.maskedIdentifier}</p> : null}
                                    <Button className="mt-2" variant="ghost" onClick={() => previewDocument(document.id)}>
                                      Preview document
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 grid gap-2">
                                <select
                                  value={draft.decision}
                                  onChange={(event) =>
                                    setDraft(item.id, {
                                      decision: event.target.value as ReviewDraft["decision"],
                                    })
                                  }
                                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
                                >
                                  <option value="under_review">Keep under review</option>
                                  <option value="approved">Approve</option>
                                  <option value="rejected">Reject</option>
                                  <option value="request_resubmission">Request resubmission</option>
                                </select>
                                <textarea
                                  value={draft.note}
                                  onChange={(event) => setDraft(item.id, { note: event.target.value })}
                                  placeholder="Review note (optional)"
                                  className="h-20 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white"
                                />
                                {(draft.decision === "rejected" || draft.decision === "request_resubmission") ? (
                                  <textarea
                                    value={draft.rejectionReason}
                                    onChange={(event) => setDraft(item.id, { rejectionReason: event.target.value })}
                                    placeholder="Required rejection/resubmission reason"
                                    className="h-20 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-rose-100"
                                  />
                                ) : null}
                                <Button onClick={() => submitReview(item)} disabled={reviewingId === item.id}>
                                  {reviewingId === item.id ? "Saving..." : "Submit review decision"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
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

                  <Card>
                    <p className="text-lg font-semibold text-white">Recent audit log</p>
                    {!auditLogs.length ? (
                      <p className="mt-3 text-sm text-muted">No audit entries available.</p>
                    ) : (
                      <div className="mt-3 space-y-2 text-xs text-muted">
                        {auditLogs.slice(0, 8).map((entry, index) => (
                          <p key={`${String(entry.id || "audit")}-${index}`}>
                            {String(entry.action || "audit_event")} - {String(entry.createdAt || "recent")}
                          </p>
                        ))}
                      </div>
                    )}
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
