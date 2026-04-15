"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createSupportTicket, fetchSupportTickets, type SupportTicket } from "@/lib/api/private-data";
import { extractBackendErrorMessage } from "@/lib/auth/error-messages";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

const categories = ["Wallet", "Security", "Trading", "KYC", "Payments", "Other"];
const priorities = ["normal", "high", "urgent"] as const;

export default function SupportPage() {
  const { status } = useAuth();
  const { submitToast } = useDemo();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Wallet");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("normal");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadTickets = async () => {
    setLoading(true);
    try {
      const payload = await fetchSupportTickets();
      setTickets(payload.items || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") {
      setTickets([]);
      return;
    }
    loadTickets();
  }, [status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await createSupportTicket({
        subject: subject.trim(),
        category: category.toLowerCase(),
        priority,
        message: message.trim(),
      });
      setSubject("");
      setCategory("Wallet");
      setPriority("normal");
      setMessage("");
      submitToast("Ticket created", response.message);
      await loadTickets();
    } catch (requestError) {
      const messageText = extractBackendErrorMessage(requestError) || "Unable to create support ticket right now.";
      setError(messageText);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Support"
        title="Help center, issue reporting, and contact options"
        description="Search help content, submit tickets, and track support updates from your account workspace."
        badge="24/7 help desk"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <input placeholder="Search help center" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
              <div className="mt-6 space-y-3 text-sm text-muted">
                <p>Deposit delays</p>
                <p>Withdrawal review</p>
                <p>2FA reset</p>
                <p>KYC troubleshooting</p>
              </div>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="text-sm font-semibold text-white">Recent tickets</p>
                {loading ? (
                  <p className="mt-3 text-sm text-muted">Loading tickets...</p>
                ) : !tickets.length ? (
                  <p className="mt-3 text-sm text-muted">No support tickets yet.</p>
                ) : (
                  <div className="mt-3 space-y-2 text-xs">
                    {tickets.slice(0, 8).map((ticket) => (
                      <div key={ticket.id} className="rounded-xl border border-white/10 bg-white/5 p-2 text-muted">
                        <p className="text-white">{ticket.subject}</p>
                        <p>
                          {ticket.category} | {ticket.priority} | {ticket.status}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <form onSubmit={onSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    placeholder="Subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                  />
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as (typeof priorities)[number])}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                  >
                    {priorities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">
                    Response target: within 24 hours
                  </div>
                </div>
                <textarea
                  placeholder="Describe your issue"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="mt-4 h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                />
                {error ? <p className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
                <Button className="mt-4 w-full" type="submit" disabled={busy}>
                  {busy ? "Submitting..." : "Submit support ticket"}
                </Button>
              </form>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {["Live chat", "Email support", "Priority queue"].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}

