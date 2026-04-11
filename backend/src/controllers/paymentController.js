import { auditLogsRepository } from "../repositories/auditLogsRepository.js";
import { paymentIntentsRepository } from "../repositories/paymentIntentsRepository.js";
import { providers } from "../services/providerRegistry.js";

export const createPaymentIntent = async (req, res) => {
  try {
    const payload = req.validated.body;

    const providerResult = payload.direction === "onramp"
      ? await providers.payments.createOnRampIntent(payload)
      : await providers.payments.createOffRampIntent(payload);

    const intent = await paymentIntentsRepository.create({
      userId: req.user.id,
      direction: payload.direction,
      amount: payload.amount,
      fiatCurrency: payload.fiatCurrency,
      asset: payload.asset,
      paymentMethod: payload.paymentMethod,
      status: providerResult.status,
      providerName: providerResult.provider,
      providerIntentId: providerResult.intentId,
      idempotencyKey: `payment_${req.user.id}_${Date.now()}`,
      metadata: providerResult,
    });

    await auditLogsRepository.create({
      action: "payment_intent_created",
      actorId: req.user.id,
      actorRole: req.user.role,
      resourceType: "payment_intent",
      resourceId: intent.id,
      metadata: {
        direction: intent.direction,
        amount: Number(intent.amount),
        fiatCurrency: intent.fiatCurrency,
      },
    });

    return res.status(201).json({ intent });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const getPaymentIntents = async (req, res) => {
  const items = await paymentIntentsRepository.listByUser(req.user.id, req.user.role === "admin");
  return res.json({ items });
};

export const processPaymentWebhook = async (req, res) => {
  try {
    const result = await providers.payments.processWebhook(req.validated.body);

    if (req.validated.body.providerReference) {
      await paymentIntentsRepository.updateByProviderReference(req.validated.body.providerReference, {
        status: req.validated.body.status,
      });
    }

    await auditLogsRepository.create({
      action: "payment_webhook_received",
      actorId: "payment_provider",
      actorRole: "system",
      resourceType: "payment_webhook",
      resourceId: result.eventId,
      metadata: {
        eventType: result.eventType,
        status: req.validated.body.status,
      },
    });

    return res.json({ received: true, result });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
