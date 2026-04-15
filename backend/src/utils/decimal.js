import Decimal from "decimal.js";

Decimal.set({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
});

export const toDecimal = (value) => {
  if (value instanceof Decimal) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }

  return new Decimal(value);
};

export const roundDecimal = (value, precision = 10) =>
  toDecimal(value).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);

export const floorDecimal = (value, precision = 10) =>
  toDecimal(value).toDecimalPlaces(precision, Decimal.ROUND_DOWN);

export const toNumber = (value, precision = 10) =>
  Number(roundDecimal(value, precision).toString());

export const toDbNumeric = (value, precision = 10) =>
  roundDecimal(value, precision).toFixed(precision);
