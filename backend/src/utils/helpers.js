export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value > 1000 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

export const randomBetween = (min, max) => Number((Math.random() * (max - min) + min).toFixed(2));

export const calcPercent = (current, previous) => Number((((current - previous) / previous) * 100).toFixed(2));

