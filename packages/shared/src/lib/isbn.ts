/**
 * ISBN helpers shared by the API (metadata lookup, normalisation) and the web
 * app (form validation, barcode → lookup). Pure functions, no I/O.
 */

export interface IsbnPair {
  /** Ten-digit form, `null` for 979-prefixed ISBN-13s which have no ISBN-10. */
  isbn10: string | null;
  isbn13: string;
}

/** Drop hyphens, spaces and a leading "ISBN" label; upper-case the check digit. */
export function cleanIsbn(raw: string): string {
  return raw
    .trim()
    .replace(/^isbn(?:-1[03])?:?\s*/i, '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

export function isValidIsbn10(value: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const char = value[i]!;
    const digit = char === 'X' ? 10 : Number(char);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(value: string): boolean {
  if (!/^97[89][0-9]{10}$/.test(value)) return false;
  return isbn13CheckDigit(value.slice(0, 12)) === value[12];
}

function isbn13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

function isbn10CheckDigit(first9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(first9[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

/** `0441013597` → `9780441013593`. Expects a clean, valid ISBN-10. */
export function isbn10To13(isbn10: string): string {
  const first12 = `978${isbn10.slice(0, 9)}`;
  return first12 + isbn13CheckDigit(first12);
}

/** `9780441013593` → `0441013597`; `null` for 979-prefixed numbers. */
export function isbn13To10(isbn13: string): string | null {
  if (!isbn13.startsWith('978')) return null;
  const first9 = isbn13.slice(3, 12);
  return first9 + isbn10CheckDigit(first9);
}

/**
 * Parse anything a user or a barcode could hand us. Returns both forms when
 * the input is a well-formed ISBN with a correct check digit, else `null`.
 */
export function parseIsbn(raw: string): IsbnPair | null {
  const value = cleanIsbn(raw);
  if (isValidIsbn10(value)) return { isbn10: value, isbn13: isbn10To13(value) };
  if (isValidIsbn13(value)) return { isbn10: isbn13To10(value), isbn13: value };
  return null;
}

/**
 * Whether a scanned EAN-13 is a book barcode ("Bookland": 978/979 prefix).
 * Other EAN-13s (groceries, magazines) are ignored by the scanner.
 */
export function isBooklandEan(code: string): boolean {
  return isValidIsbn13(code);
}

/** Find the first valid ISBN in free text (OCR output, pasted descriptions). */
export function findIsbnInText(text: string): IsbnPair | null {
  // Candidates: runs of digits, hyphens and spaces of plausible length, optional X.
  const pattern = /(?:97[89][\s-]?)?(?:[0-9][\s-]?){9}[0-9X]/gi;
  for (const match of text.matchAll(pattern)) {
    const parsed = parseIsbn(match[0]);
    if (parsed) return parsed;
  }
  return null;
}
