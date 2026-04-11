import { getKycStatusForUser, listJurisdictionOptions, submitKycApplication } from "../services/kycService.js";

export const getKycOptions = (req, res) => {
  const { countryCode } = req.validated.params;
  return res.json({ options: listJurisdictionOptions(countryCode) });
};

export const submitKyc = async (req, res) => {
  try {
    if (!req.validated.body.consentAccepted) {
      return res.status(400).json({ message: "Consent is required to submit identity verification." });
    }

    const result = await submitKycApplication({
      user: req.user,
      payload: req.validated.body,
    });

    return res.status(201).json({
      submission: result.submission,
      identityVerification: result.identityVerification,
      sanctions: result.sanctions,
      message: result.submission.status === "approved"
        ? "KYC approved successfully."
        : "KYC submitted and queued for compliance review.",
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const getKycStatus = async (req, res) => res.json(await getKycStatusForUser(req.user));
