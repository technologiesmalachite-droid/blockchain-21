import {
  MockCustodyProvider,
  MockDocumentVerificationProvider,
  MockDigiLockerProvider,
  MockEmailOtpProvider,
  MockIdentityVerificationProvider,
  MockPanVerificationProvider,
  MockPaymentRailProvider,
  MockSmsOtpProvider,
  MockSanctionsScreeningProvider,
} from "../providers/mockProviders.js";

const providerRegistry = {
  identity: new MockIdentityVerificationProvider(),
  digilocker: new MockDigiLockerProvider(),
  sanctions: new MockSanctionsScreeningProvider(),
  custody: new MockCustodyProvider(),
  payments: new MockPaymentRailProvider(),
  emailOtp: new MockEmailOtpProvider(),
  smsOtp: new MockSmsOtpProvider(),
  panVerification: new MockPanVerificationProvider(),
  documentVerification: new MockDocumentVerificationProvider(),
};

export const providers = providerRegistry;
