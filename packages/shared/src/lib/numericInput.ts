/** Digits only — for "no spinner, no decimals" numeric inputs (quantities, egg counts). */
export function filterIntegerText(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** Digits with an optional leading "-" — for count-update-style quantities that can go negative (a correction subtracting from stock). */
export function filterSignedIntegerText(raw: string): string {
  const negative = raw.trimStart().startsWith("-");
  const digits = raw.replace(/[^0-9]/g, "");
  return negative ? `-${digits}` : digits;
}

/** Digits plus at most one decimal point — for currency/decimal-quantity inputs. */
export function filterDecimalText(raw: string): string {
  let digits = raw.replace(/[^0-9.]/g, "");
  const firstDot = digits.indexOf(".");
  if (firstDot !== -1) digits = digits.slice(0, firstDot + 1) + digits.slice(firstDot + 1).replace(/\./g, "");
  return digits;
}

/** "", ".", and a bare "-" all mean "nothing entered yet" for a numeric field's value. */
export function parseNumericText(text: string): number {
  return text === "" || text === "." || text === "-" ? 0 : Number(text);
}

/** "01" -> "1", "007" -> "7" — collapses unnecessary leading zeros as the user types, without touching a lone "0" (so typing "0" then "1" right after isn't fighting itself mid-keystroke). */
export function stripLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, "");
}
