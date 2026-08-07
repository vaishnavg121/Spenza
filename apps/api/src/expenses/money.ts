const CURRENCY_EXPONENTS = {
  AUD: 2,
  CAD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  SGD: 2,
  USD: 2,
} as const;

export type SupportedCurrency = keyof typeof CURRENCY_EXPONENTS;

export function currencyExponent(currency: string): number {
  if (!(currency in CURRENCY_EXPONENTS)) {
    throw new Error("Unsupported currency");
  }
  return CURRENCY_EXPONENTS[currency as SupportedCurrency];
}

export function parseMajorAmount(value: string, currency: string): bigint {
  const exponent = currencyExponent(currency);
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match || (match[2]?.length ?? 0) > exponent) {
    throw new Error("Invalid currency amount");
  }
  const fraction = (match[2] ?? "").padEnd(exponent, "0");
  return BigInt(match[1]) * (10n ** BigInt(exponent)) + BigInt(fraction || "0");
}

/**
 * Transitional projection for the required legacy Float columns only.
 * BIGINT minor-unit fields remain authoritative and are never reconstructed
 * from this value.
 */
export function projectMinorToLegacyMajor(totalMinor: bigint, currency: string): number {
  const exponent = currencyExponent(currency);
  const scale = 10n ** BigInt(exponent);
  const major = totalMinor / scale;
  const fraction = (totalMinor % scale).toString().padStart(exponent, "0");
  const projected = Number(`${major.toString()}.${fraction}`);
  if (!Number.isFinite(projected)) {
    throw new Error("Amount cannot be projected to the legacy column");
  }
  return projected;
}
