import { describe, expect, it } from 'vitest';
import {
  cleanIsbn,
  findIsbnInText,
  isBooklandEan,
  isbn10To13,
  isbn13To10,
  isValidIsbn10,
  isValidIsbn13,
  parseIsbn,
} from '../src/lib/isbn';

describe('cleanIsbn', () => {
  it('strips separators, labels and lower-case check digits', () => {
    expect(cleanIsbn(' 978-0-441-01359-3 ')).toBe('9780441013593');
    expect(cleanIsbn('ISBN 0-8044-2957-x')).toBe('080442957X');
    expect(cleanIsbn('ISBN-13: 978 0 441 01359 3')).toBe('9780441013593');
    expect(cleanIsbn('isbn-10:0441013597')).toBe('0441013597');
  });
});

describe('check digits', () => {
  it('validates ISBN-10 including the X check digit', () => {
    expect(isValidIsbn10('0441013597')).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
    expect(isValidIsbn10('0441013598')).toBe(false);
    expect(isValidIsbn10('04410135')).toBe(false);
    expect(isValidIsbn10('X441013597')).toBe(false);
  });

  it('validates ISBN-13 (978 and 979 prefixes only)', () => {
    expect(isValidIsbn13('9780441013593')).toBe(true);
    expect(isValidIsbn13('9791234567896')).toBe(true);
    expect(isValidIsbn13('9780441013594')).toBe(false);
    expect(isValidIsbn13('9770441013593')).toBe(false);
    expect(isValidIsbn13('978044101359')).toBe(false);
  });
});

describe('conversion', () => {
  it('converts ISBN-10 → ISBN-13 and back', () => {
    expect(isbn10To13('0441013597')).toBe('9780441013593');
    expect(isbn13To10('9780441013593')).toBe('0441013597');
    expect(isbn10To13('080442957X')).toBe('9780804429573');
    expect(isbn13To10('9780804429573')).toBe('080442957X');
  });

  it('has no ISBN-10 for 979 numbers', () => {
    expect(isbn13To10('9791234567896')).toBeNull();
  });

  it('round-trips every check digit value', () => {
    for (let i = 0; i < 20; i += 1) {
      const first9 = String(100000000 + i * 7919);
      const isbn13 = isbn10To13(`${first9}0`).slice(0, 12);
      const full13 = `${isbn13}${(10 - ([...isbn13].reduce((s, d, j) => s + Number(d) * (j % 2 === 0 ? 1 : 3), 0) % 10)) % 10}`;
      expect(isValidIsbn13(full13)).toBe(true);
      const isbn10 = isbn13To10(full13)!;
      expect(isValidIsbn10(isbn10)).toBe(true);
      expect(isbn10To13(isbn10)).toBe(full13);
    }
  });
});

describe('parseIsbn', () => {
  it('returns both forms for either input', () => {
    expect(parseIsbn('0-441-01359-7')).toEqual({ isbn10: '0441013597', isbn13: '9780441013593' });
    expect(parseIsbn('9780441013593')).toEqual({ isbn10: '0441013597', isbn13: '9780441013593' });
    expect(parseIsbn('979-12-3456-789-6')).toEqual({ isbn10: null, isbn13: '9791234567896' });
  });

  it('rejects malformed numbers and bad check digits', () => {
    expect(parseIsbn('')).toBeNull();
    expect(parseIsbn('12')).toBeNull();
    expect(parseIsbn('0441013598')).toBeNull();
    expect(parseIsbn('9780441013594')).toBeNull();
    expect(parseIsbn('5901234123457')).toBeNull();
  });
});

describe('isBooklandEan', () => {
  it('accepts only 978/979 EAN-13 codes with a valid check digit', () => {
    expect(isBooklandEan('9780441013593')).toBe(true);
    expect(isBooklandEan('5901234123457')).toBe(false);
    expect(isBooklandEan('9780441013594')).toBe(false);
  });
});

describe('findIsbnInText', () => {
  it('finds hyphenated and spaced ISBNs inside OCR noise', () => {
    const text = 'PENGUIN CLASSICS\nISBN 978-0-14-143951-8\n$9.99 CAN $12.99';
    expect(findIsbnInText(text)).toEqual({ isbn10: '0141439513', isbn13: '9780141439518' });
    expect(findIsbnInText('isbn 0 441 01359 7 fiction')).toEqual({
      isbn10: '0441013597',
      isbn13: '9780441013593',
    });
  });

  it('skips digit runs that are not valid ISBNs', () => {
    expect(findIsbnInText('call 555 0100 1234 5678 now')).toBeNull();
    expect(findIsbnInText('barcode 5901234123457 groceries')).toBeNull();
    expect(findIsbnInText('nothing here')).toBeNull();
  });
});
