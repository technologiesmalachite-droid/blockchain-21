import {
  cancelOrder,
  createOffer,
  createOrderFromOffer,
  createPaymentMethod,
  deletePaymentMethod,
  getOfferDetails,
  getOrderById,
  getP2pConfig,
  listMarketplaceOffers,
  listMyOffers,
  listMyOrders,
  listMyPaymentMethods,
  listOrderMessages,
  markOrderPaid,
  openDispute,
  postOrderMessage,
  releaseOrder,
  updateOfferStatus,
  updatePaymentMethod,
} from "../services/p2pService.js";

const sendError = (res, error, fallbackMessage, fallbackStatus = 400) => {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : fallbackStatus;
  const message = typeof error?.message === "string" && error.message.trim() ? error.message : fallbackMessage;
  const code = typeof error?.code === "string" ? error.code : undefined;
  return res.status(statusCode).json(code ? { message, code } : { message });
};

export const getP2pConfigController = async (_req, res) => {
  try {
    const config = await getP2pConfig();
    return res.json({ config });
  } catch (error) {
    return sendError(res, error, "Unable to load P2P configuration.", 503);
  }
};

export const getMarketplaceOffersController = async (req, res) => {
  try {
    const payload = await listMarketplaceOffers({
      user: req.user,
      side: req.validated.query?.side,
      assetCode: req.validated.query?.assetCode,
      fiatCurrency: req.validated.query?.fiatCurrency,
      paymentMethodType: req.validated.query?.paymentMethodType,
      page: req.validated.query?.page,
      pageSize: req.validated.query?.pageSize,
    });

    return res.json(payload);
  } catch (error) {
    return sendError(res, error, "Unable to load marketplace offers.");
  }
};

export const listMyOffersController = async (req, res) => {
  try {
    const items = await listMyOffers({ user: req.user });
    return res.json({ items });
  } catch (error) {
    return sendError(res, error, "Unable to load your offers.");
  }
};

export const createOfferController = async (req, res) => {
  try {
    const offer = await createOffer({
      user: req.user,
      payload: req.validated.body,
    });

    return res.status(201).json({ message: "Offer created successfully.", offer });
  } catch (error) {
    return sendError(res, error, "Unable to create offer.");
  }
};

export const getOfferController = async (req, res) => {
  try {
    const offer = await getOfferDetails({
      user: req.user,
      offerId: req.validated.params.offerId,
    });

    return res.json({ offer });
  } catch (error) {
    return sendError(res, error, "Unable to load offer details.", 404);
  }
};

export const updateOfferStatusController = async (req, res) => {
  try {
    const offer = await updateOfferStatus({
      user: req.user,
      offerId: req.validated.params.offerId,
      status: req.validated.body.status,
    });

    return res.json({ message: "Offer status updated.", offer });
  } catch (error) {
    return sendError(res, error, "Unable to update offer status.");
  }
};

export const listPaymentMethodsController = async (req, res) => {
  try {
    const items = await listMyPaymentMethods({
      user: req.user,
      includeInactive: Boolean(req.validated.query?.includeInactive),
    });

    return res.json({ items });
  } catch (error) {
    return sendError(res, error, "Unable to load payment methods.");
  }
};

export const createPaymentMethodController = async (req, res) => {
  try {
    const method = await createPaymentMethod({
      user: req.user,
      payload: req.validated.body,
    });

    return res.status(201).json({ message: "Payment method added.", method });
  } catch (error) {
    return sendError(res, error, "Unable to add payment method.");
  }
};

export const updatePaymentMethodController = async (req, res) => {
  try {
    const method = await updatePaymentMethod({
      user: req.user,
      methodId: req.validated.params.methodId,
      payload: req.validated.body,
    });

    return res.json({ message: "Payment method updated.", method });
  } catch (error) {
    return sendError(res, error, "Unable to update payment method.");
  }
};

export const deletePaymentMethodController = async (req, res) => {
  try {
    const method = await deletePaymentMethod({
      user: req.user,
      methodId: req.validated.params.methodId,
    });

    return res.json({ message: "Payment method removed.", method });
  } catch (error) {
    return sendError(res, error, "Unable to remove payment method.", 404);
  }
};

export const createOrderController = async (req, res) => {
  try {
    const order = await createOrderFromOffer({
      user: req.user,
      offerId: req.validated.params.offerId,
      payload: req.validated.body,
    });

    return res.status(201).json({ message: "P2P order created.", order });
  } catch (error) {
    return sendError(res, error, "Unable to create P2P order.");
  }
};

export const listOrdersController = async (req, res) => {
  try {
    const payload = await listMyOrders({
      user: req.user,
      status: req.validated.query?.status,
      page: req.validated.query?.page,
      pageSize: req.validated.query?.pageSize,
    });

    return res.json(payload);
  } catch (error) {
    return sendError(res, error, "Unable to load your P2P orders.");
  }
};

export const getOrderController = async (req, res) => {
  try {
    const order = await getOrderById({
      user: req.user,
      orderId: req.validated.params.orderId,
    });

    return res.json({ order });
  } catch (error) {
    return sendError(res, error, "Unable to load P2P order.", 404);
  }
};

export const markOrderPaidController = async (req, res) => {
  try {
    const order = await markOrderPaid({
      user: req.user,
      orderId: req.validated.params.orderId,
    });

    return res.json({ message: "Order marked as paid.", order });
  } catch (error) {
    return sendError(res, error, "Unable to mark order as paid.");
  }
};

export const releaseOrderController = async (req, res) => {
  try {
    const order = await releaseOrder({
      user: req.user,
      orderId: req.validated.params.orderId,
    });

    return res.json({ message: "Escrow released successfully.", order });
  } catch (error) {
    return sendError(res, error, "Unable to release escrow.");
  }
};

export const cancelOrderController = async (req, res) => {
  try {
    const order = await cancelOrder({
      user: req.user,
      orderId: req.validated.params.orderId,
      reason: req.validated.body?.reason,
    });

    return res.json({ message: "Order cancelled.", order });
  } catch (error) {
    return sendError(res, error, "Unable to cancel order.");
  }
};

export const openDisputeController = async (req, res) => {
  try {
    const order = await openDispute({
      user: req.user,
      orderId: req.validated.params.orderId,
      reason: req.validated.body.reason,
    });

    return res.json({ message: "Dispute opened.", order });
  } catch (error) {
    return sendError(res, error, "Unable to open dispute.");
  }
};

export const listOrderMessagesController = async (req, res) => {
  try {
    const items = await listOrderMessages({
      user: req.user,
      orderId: req.validated.params.orderId,
    });

    return res.json({ items });
  } catch (error) {
    return sendError(res, error, "Unable to load order messages.", 404);
  }
};

export const postOrderMessageController = async (req, res) => {
  try {
    const message = await postOrderMessage({
      user: req.user,
      orderId: req.validated.params.orderId,
      body: req.validated.body.body,
    });

    return res.status(201).json({ message: "Message sent.", item: message });
  } catch (error) {
    return sendError(res, error, "Unable to send order message.");
  }
};
