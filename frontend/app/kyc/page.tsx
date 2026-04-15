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
  sendKycEmailOtp,
  sendKycMobileOtp,
  submitKycProfileDetails,
  uploadKycDocuments,
  verifyKycEmailOtp,
  verifyKycMobileOtp,
  type KycOptionsResponse,
  type KycStatusResponse,
} from "@/lib/api/private-data";
import { useAuth } from "@/lib/auth-provider";
import { useDemo } from "@/lib/demo-provider";

type VerificationStep = 1 | 2 | 3 | 4 | 5;

const isResubmissionState = (status: string | undefined) =>
  status === "needs_resubmission" || status === "rejected";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function KycPage() {
  const { status: authStatus } = useAuth();
  const { submitToast } = useDemo();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const [countryCode, setCountryCode] = useState("US");
  const [options, setOptions] = useState<KycOptionsResponse["options"] | null>(null);
  const [status, setStatus] = useState<KycStatusResponse | null>(null);

  const [fullLegalName, setFullLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [governmentIdType, setGovernmentIdType] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [addressProofProvided, setAddressProofProvided] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [documentConsentAccepted, setDocumentConsentAccepted] = useState(false);

  const [emailCode, setEmailCode] = useState("");
  const [mobileCode, setMobileCode] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingMobileOtp, setSendingMobileOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [verifyingMobileOtp, setVerifyingMobileOtp] = useState(false);

  const [govIdFront, setGovIdFront] = useState<File | null>(null);
  const [govIdBack, setGovIdBack] = useState<File | null>(null);
  const [panCard, setPanCard] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  const refreshData = async (nextCountryCode?: string) => {
    const currentCountry = nextCountryCode || countryCode;
    setLoading(true);

    try {
      const [profile, kycStatus, kycOptions] = await Promise.all([
        fetchProfile(),
        fetchKycStatus(),
        fetchKycOptions(currentCountry),
      ]);

      setStatus(kycStatus);
      setOptions(kycOptions.options);
      setCountryCode(profile.user.countryCode || currentCountry);
      setEmail((previous) => previous || profile.user.email || "");
      setFullLegalName((previous) => previous || profile.user.fullName || "");
      setMobile((previous) => previous || profile.user.phone || "");

      const profileData = kycStatus.profile;
      if (profileData) {
        setDob((previous) => previous || profileData.dob || "");
        setAddress((previous) => previous || profileData.residentialAddress || "");
        setGovernmentIdType((previous) => previous || profileData.idDocumentType || profileData.verificationMethod || "");
      } else if (kycOptions.options.methods.length > 0) {
        setGovernmentIdType((previous) => previous || kycOptions.options.methods[0].key);
      }
    } catch {
      submitToast("Verification unavailable", "Unable to load verification center right now.");
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
    () => options?.methods.find((method) => method.key === governmentIdType),
    [governmentIdType, options?.methods],
  );

  const step = useMemo<VerificationStep>(() => {
    if (!status?.contacts?.emailVerified) {
      return 1;
    }
    if (!status?.contacts?.mobileVerified) {
      return 2;
    }
    if (!status?.profile || !status?.profile.panLast4) {
      return 3;
    }

    if (status.status === "under_review" || status.status === "approved") {
      return 5;
    }

    return 4;
  }, [status]);

  const sendEmailOtp = async () => {
    setSendingEmailOtp(true);
    try {
      await sendKycEmailOtp();
      submitToast("OTP sent", "Email OTP sent. Check your inbox and enter the code.");
    } catch {
      submitToast("Unable to send OTP", "Please wait and try again.");
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const confirmEmailOtp = async () => {
    if (emailCode.trim().length !== 6) {
      submitToast("Invalid code", "Enter the 6-digit email OTP.");
      return;
    }

    setVerifyingEmailOtp(true);
    try {
      await verifyKycEmailOtp(emailCode.trim());
      submitToast("Email verified", "Email verification completed.");
      setEmailCode("");
      await refreshData(countryCode);
    } catch {
      submitToast("Verification failed", "Email OTP is invalid or expired.");
    } finally {
      setVerifyingEmailOtp(false);
    }
  };

  const sendMobileOtp = async () => {
    setSendingMobileOtp(true);
    try {
      await sendKycMobileOtp();
      submitToast("OTP sent", "Mobile OTP sent successfully.");
    } catch {
      submitToast("Unable to send OTP", "Please wait and try again.");
    } finally {
      setSendingMobileOtp(false);
    }
  };

  const confirmMobileOtp = async () => {
    if (mobileCode.trim().length !== 6) {
      submitToast("Invalid code", "Enter the 6-digit mobile OTP.");
      return;
    }

    setVerifyingMobileOtp(true);
    try {
      await verifyKycMobileOtp(mobileCode.trim());
      submitToast("Mobile verified", "Mobile verification completed.");
      setMobileCode("");
      await refreshData(countryCode);
    } catch {
      submitToast("Verification failed", "Mobile OTP is invalid or expired.");
    } finally {
      setVerifyingMobileOtp(false);
    }
  };

  const submitProfile = async () => {
    if (!consentAccepted) {
      submitToast("Consent required", "Accept consent to continue.");
      return;
    }

    setSavingProfile(true);
    try {
      await submitKycProfileDetails({
        countryCode,
        fullLegalName,
        dob,
        mobile,
        email,
        address,
        governmentIdType,
        panNumber,
        addressProofProvided,
        consentAccepted,
      });
      submitToast("Profile saved", "Identity profile submitted. Upload documents next.");
      setPanNumber("");
      await refreshData(countryCode);
    } catch {
      submitToast("Profile submission failed", "Please verify your PAN, mobile, and address details.");
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadDocuments = async () => {
    if (!documentConsentAccepted) {
      submitToast("Consent required", "Accept document consent before upload.");
      return;
    }

    if (!govIdFront || !panCard || !selfie) {
      submitToast("Missing files", "Government ID front, PAN card, and selfie are required.");
      return;
    }

    if (selectedMethod?.requiresBack && !govIdBack) {
      submitToast("Back side required", "Selected ID type requires front and back uploads.");
      return;
    }

    setUploadingDocs(true);
    try {
      await uploadKycDocuments({
        consentAccepted: documentConsentAccepted,
        governmentIdType,
        govIdFront,
        govIdBack,
        panCard,
        selfie,
      });
      submitToast("Documents submitted", "Your documents are encrypted and routed for review.");
      setGovIdFront(null);
      setGovIdBack(null);
      setPanCard(null);
      setSelfie(null);
      await refreshData(countryCode);
    } catch {
      submitToast("Upload failed", "Please check file type/size and try again.");
    } finally {
      setUploadingDocs(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Verification Center"
        title="Complete account verification securely"
        description="Verify email, mobile, PAN, and identity documents with backend-driven KYC status updates and manual compliance review."
        badge="KYC + Compliance"
      />
      <ContentSection>
        <ProtectedRoute>
          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <Card>
              {loading ? (
                <p className="text-sm text-muted">Loading verification center...</p>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                    <p className="font-medium text-white">Privacy notice</p>
                    <p className="mt-2">
                      Identity documents are collected only for legal onboarding, anti-fraud, and compliance obligations. Files are encrypted at rest, access is restricted, and retained only for the configured compliance period.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div
                        key={item}
                        className={`rounded-xl border px-3 py-2 text-center text-xs ${
                          step >= item ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-black/20 text-muted"
                        }`}
                      >
                        Step {item}
                      </div>
                    ))}
                  </div>

                  {step === 1 ? (
                    <div className="space-y-3">
                      <p className="text-lg font-semibold text-white">Step 1: Email verification</p>
                      <p className="text-sm text-muted">Send OTP to your registered email and verify before continuing.</p>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={sendEmailOtp} disabled={sendingEmailOtp}>
                          {sendingEmailOtp ? "Sending..." : "Send Email OTP"}
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          value={emailCode}
                          onChange={(event) => setEmailCode(event.target.value)}
                          placeholder="Enter 6-digit email OTP"
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                        />
                        <Button onClick={confirmEmailOtp} disabled={verifyingEmailOtp}>
                          {verifyingEmailOtp ? "Verifying..." : "Verify Email"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-3">
                      <p className="text-lg font-semibold text-white">Step 2: Mobile verification</p>
                      <p className="text-sm text-muted">Verify your mobile number with OTP and attempt protection enabled.</p>
                      <Button onClick={sendMobileOtp} disabled={sendingMobileOtp}>
                        {sendingMobileOtp ? "Sending..." : "Send Mobile OTP"}
                      </Button>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          value={mobileCode}
                          onChange={(event) => setMobileCode(event.target.value)}
                          placeholder="Enter 6-digit mobile OTP"
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                        />
                        <Button onClick={confirmMobileOtp} disabled={verifyingMobileOtp}>
                          {verifyingMobileOtp ? "Verifying..." : "Verify Mobile"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-4">
                      <p className="text-lg font-semibold text-white">Step 3: Identity profile + PAN</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <select
                          value={countryCode}
                          onChange={(event) => {
                            const next = event.target.value;
                            setCountryCode(next);
                            setGovernmentIdType("");
                            refreshData(next);
                          }}
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                        >
                          <option value="US">United States</option>
                          <option value="IN">India</option>
                        </select>
                        <input value={fullLegalName} onChange={(event) => setFullLegalName(event.target.value)} placeholder="Full legal name" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                        <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                        <input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile number" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                        <input value={panNumber} onChange={(event) => setPanNumber(event.target.value.toUpperCase())} placeholder="PAN (ABCDE1234F)" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                      </div>
                      <textarea
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        placeholder="Residential address"
                        className="h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"
                      />
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-sm text-muted">Government ID type</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {options?.methods.map((method) => (
                            <label key={method.key} className="flex items-center gap-2 text-sm text-white">
                              <input
                                type="radio"
                                name="government-id-type"
                                checked={governmentIdType === method.key}
                                onChange={() => setGovernmentIdType(method.key)}
                              />
                              {method.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input type="checkbox" checked={addressProofProvided} onChange={(event) => setAddressProofProvided(event.target.checked)} />
                        Address proof will be provided where required
                      </label>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />
                        I consent to KYC processing, sanctions screening, and privacy-safe handling of my data.
                      </label>
                      <Button onClick={submitProfile} disabled={savingProfile}>
                        {savingProfile ? "Submitting..." : "Submit Profile Details"}
                      </Button>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <div className="space-y-4">
                      <p className="text-lg font-semibold text-white">
                        Step 4: Upload encrypted documents {isResubmissionState(status?.status) ? "(Resubmission)" : ""}
                      </p>
                      <p className="text-sm text-muted">
                        Upload government ID, PAN card, and selfie. Files are encrypted at rest and visible only through authenticated review access.
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted">
                          Government ID front
                          <input className="mt-2 block w-full text-white" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setGovIdFront(event.target.files?.[0] || null)} />
                        </label>
                        <label className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted">
                          Government ID back {selectedMethod?.requiresBack ? "(required)" : "(optional)"}
                          <input className="mt-2 block w-full text-white" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setGovIdBack(event.target.files?.[0] || null)} />
                        </label>
                        <label className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted">
                          PAN card
                          <input className="mt-2 block w-full text-white" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setPanCard(event.target.files?.[0] || null)} />
                        </label>
                        <label className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-muted">
                          Selfie / face photo
                          <input className="mt-2 block w-full text-white" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => setSelfie(event.target.files?.[0] || null)} />
                        </label>
                      </div>
                      <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
                        <p>Gov ID front: {govIdFront ? `${govIdFront.name} (${formatBytes(govIdFront.size)})` : "Not selected"}</p>
                        <p>PAN: {panCard ? `${panCard.name} (${formatBytes(panCard.size)})` : "Not selected"}</p>
                        <p>Selfie: {selfie ? `${selfie.name} (${formatBytes(selfie.size)})` : "Not selected"}</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input type="checkbox" checked={documentConsentAccepted} onChange={(event) => setDocumentConsentAccepted(event.target.checked)} />
                        I consent to secure storage and manual review of uploaded identity documents as required by compliance policy.
                      </label>
                      <Button onClick={uploadDocuments} disabled={uploadingDocs}>
                        {uploadingDocs ? "Uploading..." : "Upload Documents"}
                      </Button>
                    </div>
                  ) : null}

                  {step === 5 ? (
                    <div className="space-y-3">
                      <p className="text-lg font-semibold text-white">Step 5: Review status</p>
                      <p className="text-sm text-muted">
                        Your documents are currently {status?.status === "approved" ? "approved" : "under compliance review"}.
                      </p>
                      {status?.latestReview?.rejectionReason ? (
                        <p className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                          Review note: {status.latestReview.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <Card>
                <p className="text-lg font-semibold text-white">Verification status</p>
                <div className="mt-3 space-y-2 text-sm text-muted">
                  <p>Status: <span className="text-white">{status?.status || "unverified"}</span></p>
                  <p>Email: <span className="text-white">{status?.contacts.emailVerified ? "verified" : "pending"}</span></p>
                  <p>Mobile: <span className="text-white">{status?.contacts.mobileVerified ? "verified" : "pending"}</span></p>
                  <p>PAN: <span className="text-white">{status?.profile?.panLast4 ? `******${status.profile.panLast4}` : "pending"}</span></p>
                  <p>Tier: <span className="text-white">{status?.tier || "none"}</span></p>
                </div>
                {status?.latestSubmission?.rejectionReason ? (
                  <p className="mt-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                    Rejection reason: {status.latestSubmission.rejectionReason}
                  </p>
                ) : null}
              </Card>

              <Card>
                <p className="text-lg font-semibold text-white">Documents</p>
                {!status?.documents?.length ? (
                  <p className="mt-3 text-sm text-muted">No uploaded documents yet.</p>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    {status.documents.map((document) => (
                      <div key={document.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-white">{document.documentGroup.replace(/_/g, " ")} ({document.documentSide})</p>
                        <p>Status: {document.status}</p>
                        <p>MIME: {document.mimeType}</p>
                        <p>Size: {formatBytes(document.fileSizeBytes)}</p>
                        {document.maskedIdentifier ? <p>Masked: {document.maskedIdentifier}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <p className="text-lg font-semibold text-white">Audit trail</p>
                {status?.auditTrail?.length ? (
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    {status.auditTrail.slice(0, 6).map((entry, index) => (
                      <p key={`${String(entry.createdAt || "event")}-${index}`}>
                        {String(entry.action || "kyc_event")} - {String(entry.createdAt || "recent")}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">No audit events yet.</p>
                )}
              </Card>
            </div>
          </div>
        </ProtectedRoute>
      </ContentSection>
    </>
  );
}
