const snakeToCamel = (value) =>
  value.replace(/_([a-z])/g, (_match, group) => group.toUpperCase());

export const toCamelObject = (row) => {
  if (!row || typeof row !== "object") {
    return row;
  }

  return Object.entries(row).reduce((accumulator, [key, value]) => {
    accumulator[snakeToCamel(key)] = value;
    return accumulator;
  }, {});
};

export const toCamelRows = (rows = []) => rows.map(toCamelObject);

export const normalizeMetadata = (metadata) => {
  if (!metadata) {
    return {};
  }

  if (typeof metadata === "object") {
    return metadata;
  }

  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
};

export const parseRestrictions = (row) => ({
  frozen: row.frozen,
  withdrawalsLocked: row.withdrawals_locked,
  tradingLocked: row.trading_locked,
  reason: row.reason,
  metadata: normalizeMetadata(row.metadata),
  updatedAt: row.updated_at,
});

export const asJson = (value) => JSON.stringify(value || {});
