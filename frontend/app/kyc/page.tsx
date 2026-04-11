"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContentSection, PageHero } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  fetchKycOptions,
  fetchKycStatus,
  fetchProfile,
  submitKycApplication,
  type KycOptionsResponse,
  type KycStatusResponse,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

export default function KycPage() {
  const { status: authStatus } = useAuth();
  const { submitToast } = useDemo();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countryCode, setCountryCode] = useState("US");
  const [options, setOptions] = useState<KycOptionsResponse["options"] | null>(null);
  const [status, setStatus] = useState<KycStatusResponse | null>(null);

  const [fullLegalName, setFullLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [verificationMethod, setVerificationMethod] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [useDigiLocker, setUseDigiLocker] = useState(false);
  const [selfieProvided, setSelfieProvided] = useState(false);
  const [documentProvided, setDocumentProvided] = useState(false);
  const [addressProofProvided, setAddressProofProvided] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  const refreshData = async (selectedCountryCode?: string) => {
    const country = selectedCountryCode || countryCode;

    setLoading(true);

    try {
      const [profile, kycOptions, kycStatus] = await Promise.all([
        fetchProfile(),
        fetchKycOptions(country),
        fetchKycStatus(),
      ]);

      setCountryCode(profile.user.countryCode || country);
      setEmail(profile.user.email || "");
      setFullLegalName(profile.user.fullName || "");
      setMobile(profile.user.phone || "");

      setOptions(kycOptions.options);
      setStatus(kycStatus);

      if (kycOptions.options.methods.length) {
        setVerificationMethod((current) => current || kycOptions.options.methods[0].key);
      }
    } catch {
      submitToast("KYC unavailable", "Unable to load verification options right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setLoading(false);
      return;
    }

    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  const selectedMethod = useMemo(
    () => options?.methods.find((method) => method.key === verificationMethod),
    [options, verificationMethod],
  );

  const submitKyc = async () => {
    if (!consentAccepted) {
      submitToast("Consent required", "Accept consent terms to continue with identity verification.");
      return;
    }

    setSaving(true);

    try {
      await submitKycApplication({
        countryCode,
        fullLegalName,
        dob,
        mobile,
        email,
        address,
        verificationMethod,
        idNumber,
        selfieProvided,
        documentProvided,
        addressProofProvided,
        useDigiLocker,
        consentAccepted,
      });

      submitToast("KYC submitted", "Your verification package has been submitted for automated and manual checks.");
      await refreshData(countryCode);
    } catch {
      submitToast("Submission failed", "Please review your details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="KYC"
        title="Jurisdiction-aware identity verification"
        description="Complete country-specific onboarding with document checks, liveness verification, sanctions screening, and review tracking."
        badge="Compliance onboarding"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card>
              {loading ? (
                <p className="text-sm text-muted">Loading verification requirements...</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <select
                      value={countryCode}
                      onChange={(event) => {
                        const next = event.target.value;
                        setCountryCode(next);
                        setVerificationMethod("");
                        refreshData(next);
                      }}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                    >
                      <option value="US">United States</option>
                      <option value="IN">India</option>
                    </select>
                    <input value={fullLegalName} onChange={(event) => setFullLegalName(event.target.value)} placeholder="Full legal name" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                    <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                    <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                    <input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                    <input value={idNumber} onChange={(event) => setIdNumber(event.target.value)} placeholder="ID number / PAN / SSN (as applicable)" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                  </div>

                  <textarea
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Residential address"
                    className="mt-4 h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                  />

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-muted">Verification method</p>
                    <div className="mt-3 grid gap-2">
                      {options?.methods.map((method) => (
                        <label key={method.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
                          <input
                            type="radio"
                            name="kyc-method"
                            checked={verificationMethod === method.key}
                            onChange={() => setVerificationMethod(method.key)}
                          />
                          {method.label}
                        </label>
                      ))}
                    </div>
                    {selectedMethod?.digilockerSupported ? (
                      <label className="mt-3 flex items-center gap-3 text-sm text-muted">
                        <input type="checkbox" checked={useDigiLocker} onChange={(event) => setUseDigiLocker(event.target.checked)} />
                        Retrieve document via DigiLocker (where legally appropriate)
                      </label>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-muted">
                    <label className="flex items-center gap-3"><input type="checkbox" checked={documentProvided} onChange={(event) => setDocumentProvided(event.target.checked)} />Document uploaded or connected</label>
                    <label className="flex items-center gap-3"><input type="checkbox" checked={selfieProvided} onChange={(event) => setSelfieProvided(event.target.checked)} />Selfie/liveness evidence provided</label>
                    <label className="flex items-center gap-3"><input type="checkbox" checked={addressProofProvided} onChange={(event) => setAddressProofProvided(event.target.checked)} />Address proof provided (if required)</label>
                    <label className="flex items-center gap-3"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />I consent to identity, sanctions, and fraud screening checks</label>
                  </div>

                  <Button className="mt-6 w-full" onClick={submitKyc} disabled={saving || loading}>
                    {saving ? "Submitting KYC..." : "Submit verification"}
                  </Button>
                </>
              )}
            </Card>

            <div className="space-y-6">
              <Card>
                <p className="text-lg font-semibold text-white">Current status</p>
                <div className="mt-4 space-y-2 text-sm text-muted">
                  <p>KYC status: <span className="text-white">{status?.status || "pending"}</span></p>
                  <p>KYC tier: <span className="text-white">{status?.tier || "none"}</span></p>
                  <p>Jurisdiction: <span className="text-white">{options?.jurisdiction || "--"}</span></p>
                  <p>Sanctions screening: <span className="text-white">{options?.sanctionsScreening ? "Enabled" : "Not configured"}</span></p>
                </div>
              </Card>
              <Card>
                <p className="text-lg font-semibold text-white">Review workflow</p>
                <div className="mt-4 space-y-3 text-sm text-muted">
                  <p>1. Submission intake and field completeness validation</p>
                  <p>2. Documentary/non-documentary verification execution</p>
                  <p>3. Sanctions/watchlist screening and risk scoring</p>
                  <p>4. Manual compliance review for flagged cases</p>
                  <p>5. Decision logs and audit retention</p>
                </div>
              </Card>
              <Card>
                <p className="text-lg font-semibold text-white">Latest audit events</p>
                {status?.auditTrail?.length ? (
                  <div className="mt-4 space-y-2 text-sm text-muted">
                    {status.auditTrail.slice(0, 4).map((entry, index) => (
                      <p key={index}>{String(entry.action || "kyc_event")} - {String(entry.createdAt || "recent")}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted">No KYC audit events yet.</p>
                )}
              </Card>
            </div>
          </div>
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
