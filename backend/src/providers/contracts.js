export class IdentityVerificationProvider {
  async verifyKycSubmission(_payload) {
    throw new Error("verifyKycSubmission must be implemented by the identity provider adapter.");
  }
}

export class DigiLockerProvider {
  async fetchDocument(_payload) {
    throw new Error("fetchDocument must be implemented by the DigiLocker adapter.");
  }
}

export class SanctionsScreeningProvider {
  async screenEntity(_payload) {
    throw new Error("screenEntity must be implemented by the sanctions adapter.");
  }
}

export class CustodyProvider {
  async createWallet(_payload) {
    throw new Error("createWallet must be implemented by the custody adapter.");
  }

  async createDepositAddress(_payload) {
    throw new Error("createDepositAddress must be implemented by the custody adapter.");
  }

  async requestWithdrawal(_payload) {
    throw new Error("requestWithdrawal must be implemented by the custody adapter.");
  }
}

export class PaymentRailProvider {
  async createOnRampIntent(_payload) {
    throw new Error("createOnRampIntent must be implemented by the payment adapter.");
  }

  async createOffRampIntent(_payload) {
    throw new Error("createOffRampIntent must be implemented by the payment adapter.");
  }

  async processWebhook(_payload) {
    throw new Error("processWebhook must be implemented by the payment adapter.");
  }
}
