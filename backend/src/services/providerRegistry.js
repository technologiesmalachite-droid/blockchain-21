import {
  MockCustodyProvider,
  MockDigiLockerProvider,
  MockIdentityVerificationProvider,
  MockPaymentRailProvider,
  MockSanctionsScreeningProvider,
} from "../providers/mockProviders.js";

const providerRegistry = {
  identity: new MockIdentityVerificationProvider(),
  digilocker: new MockDigiLockerProvider(),
  sanctions: new MockSanctionsScreeningProvider(),
  custody: new MockCustodyProvider(),
  payments: new MockPaymentRailProvider(),
};

export const providers = providerRegistry;
