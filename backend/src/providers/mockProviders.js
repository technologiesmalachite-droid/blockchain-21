import { v4 as uuid } from "uuid";
import {
  CustodyProvider,
  DocumentVerificationProvider,
  DigiLockerProvider,
  EmailOtpProvider,
  IdentityVerificationProvider,
  PanVerificationProvider,
  PaymentRailProvider,
  SmsOtpProvider,
  SanctionsScreeningProvider,
} from "./contracts.js";

const nowIso = () => new Date().toISOString();

export class MockIdentityVerificationProvider extends IdentityVerificationProvider {
  async verifyKycSubmission(payload) {
    const highRiskWords = ["sanction", "blocked", "fraud"];
    const hasRiskIndicator = highRiskWords.some((word) => JSON.stringify(payload).toLowerCase().includes(word));

    return {
      provider: "mock_identity_provider",
      referenceId: `idv_${uuid()}`,
      documentaryStatus: "passed",
      nonDocumentaryStatus: payload.jurisdiction === "US" ? "passed" : "not_required",
      livenessStatus: payload.selfieProvided ? "passed" : "failed",
      requiresManualReview: hasRiskIndicator || !payload.selfieProvided,
      score: hasRiskIndicator ? 62 : 18,
      checkedAt: nowIso(),
    };
  }
}

export class MockDigiLockerProvider extends DigiLockerProvider {
  async fetchDocument(payload) {
    return {
      provider: "mock_digilocker",
      requestId: `digilocker_${uuid()}`,
      documentType: payload.documentType,
      status: payload.countryCode === "IN" ? "retrieved" : "unsupported_country",
      metadata: {
        issuedBy: payload.countryCode === "IN" ? "Govt Digital Locker" : "n/a",
      },
      fetchedAt: nowIso(),
    };
  }
}

export class MockSanctionsScreeningProvider extends SanctionsScreeningProvider {
  async screenEntity(payload) {
    const name = (payload.fullName || "").toLowerCase();
    const isPotentialHit = name.includes("test-hit") || name.includes("watchlist");

    return {
      provider: "mock_sanctions_provider",
      caseReference: `san_${uuid()}`,
      status: isPotentialHit ? "possible_match" : "clear",
      matchScore: isPotentialHit ? 91 : 7,
      watchlists: isPotentialHit ? ["OFAC_SIMULATED", "UN_SIMULATED"] : [],
      screenedAt: nowIso(),
    };
  }
}

export class MockCustodyProvider extends CustodyProvider {
  async createWallet(payload) {
    return {
      provider: "mock_custody",
      custodyWalletId: `cw_${uuid()}`,
      asset: payload.asset,
      walletType: payload.walletType,
      createdAt: nowIso(),
    };
  }

  async createDepositAddress(payload) {
    const prefix = payload.network?.toUpperCase().slice(0, 4) || "ADDR";
    return {
      provider: "mock_custody",
      requestId: `addr_${uuid()}`,
      address: `MX${prefix}${uuid().replace(/-/g, "").slice(0, 24)}`,
      memo: payload.asset === "XRP" ? "123456" : null,
      network: payload.network,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso(),
    };
  }

  async requestWithdrawal(payload) {
    return {
      provider: "mock_custody",
      withdrawalId: `wd_${uuid()}`,
      status: "queued",
      asset: payload.asset,
      amount: payload.amount,
      destinationAddress: payload.address,
      network: payload.network,
      createdAt: nowIso(),
    };
  }
}

export class MockPaymentRailProvider extends PaymentRailProvider {
  async createOnRampIntent(payload) {
    return {
      provider: "mock_payment_rail",
      intentId: `onramp_${uuid()}`,
      amount: payload.amount,
      fiatCurrency: payload.fiatCurrency,
      asset: payload.asset,
      status: "pending",
      redirectUrl: "https://payments.example.com/onramp",
      createdAt: nowIso(),
    };
  }

  async createOffRampIntent(payload) {
    return {
      provider: "mock_payment_rail",
      intentId: `offramp_${uuid()}`,
      amount: payload.amount,
      fiatCurrency: payload.fiatCurrency,
      asset: payload.asset,
      status: "pending_review",
      createdAt: nowIso(),
    };
  }

  async processWebhook(payload) {
    return {
      provider: "mock_payment_rail",
      eventId: payload.eventId || `evt_${uuid()}`,
      status: "accepted",
      receivedAt: nowIso(),
      eventType: payload.eventType || "payment.updated",
    };
  }
}

export class MockEmailOtpProvider extends EmailOtpProvider {
  async sendVerification(payload) {
    return {
      provider: "mock_email_otp",
      messageId: `mail_${uuid()}`,
      destinationMasked: payload.destination?.replace(/(.{2}).+(@.*)/, "$1***$2") || "hidden",
      sentAt: nowIso(),
    };
  }
}

export class MockSmsOtpProvider extends SmsOtpProvider {
  async sendVerification(payload) {
    const destination = payload.destination || "";
    const masked = destination.length > 4 ? `${destination.slice(0, 2)}******${destination.slice(-2)}` : "hidden";

    return {
      provider: "mock_sms_otp",
      messageId: `sms_${uuid()}`,
      destinationMasked: masked,
      sentAt: nowIso(),
    };
  }
}

export class MockPanVerificationProvider extends PanVerificationProvider {
  async verifyPan(payload) {
    const normalized = (payload.panNumber || "").toUpperCase();
    const valid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized);

    return {
      provider: "mock_pan_provider",
      referenceId: `pan_${uuid()}`,
      status: valid ? "verified" : "invalid",
      requiresManualReview: !valid,
      checkedAt: nowIso(),
    };
  }
}

export class MockDocumentVerificationProvider extends DocumentVerificationProvider {
  async verifyDocuments(payload) {
    const documentCount = Number(payload.documentCount || 0);
    const status = documentCount >= 2 ? "under_review" : "needs_resubmission";

    return {
      provider: "mock_document_provider",
      referenceId: `doc_${uuid()}`,
      status,
      requiresManualReview: true,
      checkedAt: nowIso(),
    };
  }
}
