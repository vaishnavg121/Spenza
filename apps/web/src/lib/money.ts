export function parseAmountToMinorUnit(amountStr: string, exponent: number = 2): string | null {
  amountStr = amountStr.trim();
  if (!amountStr) return null;
  // Reject negatives and non-decimals
  if (!/^\d+(\.\d+)?$/.test(amountStr)) return null;

  const parts = amountStr.split(".");
  const integerPart = parts[0];
  const fractionalPart = parts[1] || "";

  if (fractionalPart.length > exponent) {
    return null; // Excess fractional digits
  }

  // Pad fractional part to exactly `exponent` length
  const paddedFractional = fractionalPart.padEnd(exponent, "0");
  
  // Combine integer and padded fractional part
  let minorUnitStr = integerPart + paddedFractional;
  
  // Remove leading zeros
  minorUnitStr = minorUnitStr.replace(/^0+/, "");
  
  if (minorUnitStr === "") {
    return "0";
  }
  
  return minorUnitStr;
}

export function formatMinorUnitToAmount(minorUnitStr: string, exponent: number = 2): string {
  minorUnitStr = minorUnitStr.trim();
  if (!/^\d+$/.test(minorUnitStr)) return "0.00"; // Or throw, but this is formatting
  
  const padded = minorUnitStr.padStart(exponent + 1, "0");
  const integerPart = padded.slice(0, -exponent);
  const fractionalPart = padded.slice(-exponent);
  
  return `${integerPart}.${fractionalPart}`;
}
